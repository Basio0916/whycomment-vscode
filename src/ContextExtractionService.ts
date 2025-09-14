import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DiffLine } from './GitDiffService';

export interface ContextData {
    changeType: 'added' | 'modified' | 'deleted';
    lineNumber: number;
    content: string;
    contextBefore: string[];
    contextAfter: string[];
    functionName?: string;
    className?: string;
    isComment: boolean;
}

export interface FunctionBoundary {
    name: string;
    startLine: number;
    endLine: number;
    type: 'function' | 'method' | 'class';
}

export class ContextExtractionService {
    private readonly contextLines: number;

    constructor() {
        // Get configurable context lines (default 10 as per PRD)
        this.contextLines = vscode.workspace.getConfiguration('whycomment').get('contextLines', 10);
    }

    /**
     * Extract context around changed lines for LLM analysis
     */
    public async extractContext(filePath: string, changes: DiffLine[]): Promise<ContextData[]> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        const fileExtension = path.extname(filePath).toLowerCase();
        
        // Detect function/class boundaries based on file type
        const boundaries = this.detectBoundaries(lines, fileExtension);
        
        const contextDataList: ContextData[] = [];

        for (const change of changes) {
            // Skip deleted lines for context extraction (they don't exist in current file)
            if (change.type === 'deleted') {
                contextDataList.push({
                    changeType: change.type,
                    lineNumber: change.lineNumber,
                    content: change.content,
                    contextBefore: [],
                    contextAfter: [],
                    isComment: this.isCommentLine(change.content, fileExtension)
                });
                continue;
            }

            const lineIndex = change.lineNumber - 1; // Convert to 0-based index
            
            // Extract context before (respecting file boundaries)
            const contextBeforeStart = Math.max(0, lineIndex - this.contextLines);
            const contextBefore = lines.slice(contextBeforeStart, lineIndex);
            
            // Extract context after (respecting file boundaries)
            const contextAfterEnd = Math.min(lines.length, lineIndex + this.contextLines + 1);
            const contextAfter = lines.slice(lineIndex + 1, contextAfterEnd);
            
            // Find the function/class containing this line
            const containingBoundary = this.findContainingBoundary(change.lineNumber, boundaries);
            
            const contextData: ContextData = {
                changeType: change.type,
                lineNumber: change.lineNumber,
                content: change.content,
                contextBefore,
                contextAfter,
                functionName: containingBoundary?.type === 'function' || containingBoundary?.type === 'method' 
                    ? containingBoundary.name : undefined,
                className: containingBoundary?.type === 'class' 
                    ? containingBoundary.name : undefined,
                isComment: this.isCommentLine(change.content, fileExtension)
            };

            contextDataList.push(contextData);
        }

        return contextDataList;
    }

    /**
     * Detect function and class boundaries based on file type
     */
    private detectBoundaries(lines: string[], fileExtension: string): FunctionBoundary[] {
        const boundaries: FunctionBoundary[] = [];

        switch (fileExtension) {
            case '.ts':
            case '.js':
            case '.tsx':
            case '.jsx':
                return this.detectJavaScriptBoundaries(lines);
            case '.py':
                return this.detectPythonBoundaries(lines);
            case '.java':
                return this.detectJavaBoundaries(lines);
            default:
                return boundaries;
        }
    }

    /**
     * Detect JavaScript/TypeScript function and class boundaries
     */
    private detectJavaScriptBoundaries(lines: string[]): FunctionBoundary[] {
        const boundaries: FunctionBoundary[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;

            // Match class declarations
            const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
            if (classMatch) {
                boundaries.push({
                    name: classMatch[1],
                    startLine: lineNumber,
                    endLine: this.findClosingBrace(lines, i),
                    type: 'class'
                });
            }

            // Match function declarations (various patterns)
            const functionPatterns = [
                /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,  // function name()
                /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,  // const name = () =>
                /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,  // const name = function
                /^(\w+)\s*\([^)]*\)\s*\{/,  // name() {
                /^(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/,  // async name() {
            ];

            for (const pattern of functionPatterns) {
                const match = line.match(pattern);
                if (match) {
                    boundaries.push({
                        name: match[1],
                        startLine: lineNumber,
                        endLine: this.findClosingBrace(lines, i),
                        type: 'function'
                    });
                    break;
                }
            }

            // Match method declarations in classes (improved pattern)
            const methodMatch = line.match(/^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*[{:]/);
            if (methodMatch && !line.includes('function') && !line.includes('=') && !line.includes('class')) {
                // Exclude constructor and common non-method patterns
                const methodName = methodMatch[1];
                if (methodName !== 'constructor' && methodName !== 'if' && methodName !== 'for' && methodName !== 'while') {
                    boundaries.push({
                        name: methodName,
                        startLine: lineNumber,
                        endLine: this.findClosingBrace(lines, i),
                        type: 'method'
                    });
                }
            }
        }

        return boundaries;
    }

    /**
     * Detect Python function and class boundaries
     */
    private detectPythonBoundaries(lines: string[]): FunctionBoundary[] {
        const boundaries: FunctionBoundary[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // Match class declarations
            const classMatch = line.match(/^class\s+(\w+)/);
            if (classMatch) {
                boundaries.push({
                    name: classMatch[1],
                    startLine: lineNumber,
                    endLine: this.findPythonBlockEnd(lines, i),
                    type: 'class'
                });
            }

            // Match function/method declarations
            const functionMatch = line.match(/^(?:\s*)def\s+(\w+)/);
            if (functionMatch) {
                const indentLevel = line.length - line.trimStart().length;
                const isMethod = indentLevel > 0; // Simplified method detection
                
                boundaries.push({
                    name: functionMatch[1],
                    startLine: lineNumber,
                    endLine: this.findPythonBlockEnd(lines, i),
                    type: isMethod ? 'method' : 'function'
                });
            }
        }

        return boundaries;
    }

    /**
     * Detect Java function and class boundaries
     */
    private detectJavaBoundaries(lines: string[]): FunctionBoundary[] {
        const boundaries: FunctionBoundary[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;

            // Match class declarations
            const classMatch = line.match(/^(?:public\s+|private\s+|protected\s+)?class\s+(\w+)/);
            if (classMatch) {
                boundaries.push({
                    name: classMatch[1],
                    startLine: lineNumber,
                    endLine: this.findClosingBrace(lines, i),
                    type: 'class'
                });
            }

            // Match method declarations
            const methodMatch = line.match(/^(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*[{]/);
            if (methodMatch && !line.includes('class')) {
                boundaries.push({
                    name: methodMatch[1],
                    startLine: lineNumber,
                    endLine: this.findClosingBrace(lines, i),
                    type: 'method'
                });
            }
        }

        return boundaries;
    }

    /**
     * Find the closing brace for a block starting at the given line
     */
    private findClosingBrace(lines: string[], startLine: number): number {
        let braceCount = 0;
        let foundOpeningBrace = false;

        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            
            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                    foundOpeningBrace = true;
                } else if (char === '}') {
                    braceCount--;
                    if (foundOpeningBrace && braceCount === 0) {
                        return i + 1; // Convert to 1-based line number
                    }
                }
            }
        }

        return lines.length; // If no closing brace found, assume end of file
    }

    /**
     * Find the end of a Python block (by indentation)
     */
    private findPythonBlockEnd(lines: string[], startLine: number): number {
        const startIndent = this.getIndentLevel(lines[startLine]);
        
        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines and comments
            if (line.trim() === '' || line.trim().startsWith('#')) {
                continue;
            }
            
            const currentIndent = this.getIndentLevel(line);
            
            // If we find a line with same or less indentation, the block has ended
            if (currentIndent <= startIndent) {
                return i; // Return 1-based line number
            }
        }

        return lines.length; // If no end found, assume end of file
    }

    /**
     * Get indentation level (number of spaces/tabs at start of line)
     */
    private getIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            } else if (char === '\t') {
                indent += 4; // Treat tab as 4 spaces
            } else {
                break;
            }
        }
        return indent;
    }

    /**
     * Find the boundary (function/class) that contains the given line number
     */
    private findContainingBoundary(lineNumber: number, boundaries: FunctionBoundary[]): FunctionBoundary | undefined {
        // Find the most specific (innermost) boundary containing this line
        let containingBoundary: FunctionBoundary | undefined;
        let smallestRange = Infinity;

        for (const boundary of boundaries) {
            if (lineNumber >= boundary.startLine && lineNumber <= boundary.endLine) {
                const range = boundary.endLine - boundary.startLine;
                if (range < smallestRange) {
                    smallestRange = range;
                    containingBoundary = boundary;
                }
            }
        }

        return containingBoundary;
    }

    /**
     * Check if a line is a comment based on file type
     */
    private isCommentLine(content: string, fileExtension: string): boolean {
        const trimmed = content.trim();
        
        switch (fileExtension) {
            case '.ts':
            case '.js':
            case '.tsx':
            case '.jsx':
            case '.java':
                return trimmed.startsWith('//') || 
                       trimmed.startsWith('/*') || 
                       trimmed.startsWith('*') ||
                       (trimmed.startsWith('/*') && trimmed.endsWith('*/'));
            
            case '.py':
                return trimmed.startsWith('#') || 
                       trimmed.startsWith('"""') || 
                       trimmed.startsWith("'''");
            
            default:
                return false;
        }
    }

    /**
     * Update context lines configuration
     */
    public updateContextLines(): void {
        const newContextLines = vscode.workspace.getConfiguration('whycomment').get('contextLines', 10);
        if (newContextLines !== this.contextLines) {
            (this as any).contextLines = newContextLines;
        }
    }
}