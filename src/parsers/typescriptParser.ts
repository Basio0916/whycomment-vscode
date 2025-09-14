import { BaseParser } from './baseParser';
import { FunctionInfo } from '../types';

/**
 * Parser for TypeScript and JavaScript files
 */
export class TypeScriptParser extends BaseParser {
	language = 'typescript';
	fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

	private readonly functionPatterns = [
		/^\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
		/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\(/,
		/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*)?=>/,
		/^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*{/, // Method in class/object
		/^\s*(?:public|private|protected|static)?\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/
	];

	private readonly classPatterns = [
		/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
		/^\s*(?:export\s+)?interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
		/^\s*(?:export\s+)?type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
	];

	parseFunctions(lines: string[]): FunctionInfo[] {
		const functions: FunctionInfo[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Check for classes/interfaces
			for (const pattern of this.classPatterns) {
				const match = line.match(pattern);
				if (match) {
					const name = match[1];
					const endLine = this.findBlockEnd(lines, i);
					functions.push({
						name,
						startLine: i,
						endLine,
						type: pattern.source.includes('class') ? 'class' : 'interface'
					});
					break;
				}
			}

			// Check for functions
			for (const pattern of this.functionPatterns) {
				const match = line.match(pattern);
				if (match) {
					const name = match[1];
					const endLine = this.findFunctionEnd(lines, i);
					functions.push({
						name,
						startLine: i,
						endLine,
						type: this.isInClass(functions, i) ? 'method' : 'function'
					});
					break;
				}
			}
		}

		return functions;
	}

	isCommentLine(line: string): boolean {
		const trimmed = line.trim();
		return trimmed.startsWith('//') || 
			   trimmed.startsWith('/*') || 
			   trimmed.startsWith('*') || 
			   trimmed.endsWith('*/') ||
			   (trimmed.startsWith('/**') && trimmed.endsWith('*/'));
	}

	private findFunctionEnd(lines: string[], startLine: number): number {
		const startingLine = lines[startLine];
		
		// If it's an arrow function on a single line
		if (startingLine.includes('=>') && !startingLine.includes('{')) {
			return startLine;
		}

		// For functions with blocks
		return this.findBlockEnd(lines, startLine);
	}

	private isInClass(functions: FunctionInfo[], lineNumber: number): boolean {
		return functions.some(fn => 
			fn.type === 'class' && 
			lineNumber > fn.startLine && 
			lineNumber <= fn.endLine
		);
	}
}