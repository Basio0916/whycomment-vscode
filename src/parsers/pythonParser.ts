import { BaseParser } from './baseParser';
import { FunctionInfo } from '../types';

/**
 * Parser for Python files
 */
export class PythonParser extends BaseParser {
	language = 'python';
	fileExtensions = ['.py', '.pyw'];

	private readonly functionPattern = /^\s*(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
	private readonly classPattern = /^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/;

	parseFunctions(lines: string[]): FunctionInfo[] {
		const functions: FunctionInfo[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Check for classes
			const classMatch = line.match(this.classPattern);
			if (classMatch) {
				const name = classMatch[1];
				const endLine = this.findPythonBlockEnd(lines, i);
				functions.push({
					name,
					startLine: i,
					endLine,
					type: 'class'
				});
			}

			// Check for functions
			const funcMatch = line.match(this.functionPattern);
			if (funcMatch) {
				const name = funcMatch[1];
				const endLine = this.findPythonBlockEnd(lines, i);
				functions.push({
					name,
					startLine: i,
					endLine,
					type: this.isInClass(functions, i) ? 'method' : 'function'
				});
			}
		}

		return functions;
	}

	isCommentLine(line: string): boolean {
		const trimmed = line.trim();
		return trimmed.startsWith('#') ||
			   (trimmed.startsWith('"""') || trimmed.startsWith("'''")) ||
			   (trimmed.endsWith('"""') || trimmed.endsWith("'''"));
	}

	/**
	 * Find the end of a Python block based on indentation
	 */
	private findPythonBlockEnd(lines: string[], startLine: number): number {
		const startIndent = this.getIndentLevel(lines[startLine]);
		
		for (let i = startLine + 1; i < lines.length; i++) {
			const line = lines[i];
			
			// Skip empty lines and comments
			if (line.trim() === '' || this.isCommentLine(line)) {
				continue;
			}
			
			const currentIndent = this.getIndentLevel(line);
			
			// If we find a line with same or less indentation, the block has ended
			if (currentIndent <= startIndent) {
				return i - 1;
			}
		}
		
		return lines.length - 1;
	}

	/**
	 * Calculate indentation level (number of spaces/tabs)
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

	private isInClass(functions: FunctionInfo[], lineNumber: number): boolean {
		return functions.some(fn => 
			fn.type === 'class' && 
			lineNumber > fn.startLine && 
			lineNumber <= fn.endLine
		);
	}
}