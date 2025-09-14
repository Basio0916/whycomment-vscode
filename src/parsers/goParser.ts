import { BaseParser } from './baseParser';
import { FunctionInfo } from '../types';

/**
 * Parser for Go files
 */
export class GoParser extends BaseParser {
	language = 'go';
	fileExtensions = ['.go'];

	private readonly functionPatterns = [
		/^\s*func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,  // Regular functions
		/^\s*func\s*\([^)]*\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/  // Methods with receivers
	];

	private readonly typePatterns = [
		/^\s*type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+struct/,  // Struct types
		/^\s*type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+interface/,  // Interface types
		/^\s*type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+\w+/  // Type aliases
	];

	parseFunctions(lines: string[]): FunctionInfo[] {
		const functions: FunctionInfo[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Skip comments and empty lines
			if (this.isCommentLine(line) || line.trim() === '') {
				continue;
			}

			// Check for type declarations (structs, interfaces, type aliases)
			for (const pattern of this.typePatterns) {
				const match = line.match(pattern);
				if (match) {
					const name = match[1];
					let endLine = i;
					let type: 'class' | 'interface' = 'class';

					// For struct and interface types, find the closing brace
					const patternStr = pattern.toString();
					if (patternStr.indexOf('struct') !== -1 || patternStr.indexOf('interface') !== -1) {
						endLine = this.findTypeEnd(lines, i);
						if (patternStr.indexOf('interface') !== -1) {
							type = 'interface';
						}
					}
					
					functions.push({
						name,
						startLine: i,
						endLine,
						type
					});
					break;
				}
			}

			// Check for functions and methods
			for (const pattern of this.functionPatterns) {
				const match = line.match(pattern);
				if (match) {
					const name = match[1];
					const endLine = this.findFunctionEnd(lines, i);
					const patternStr = pattern.toString();
					const isMethod = patternStr.indexOf('\\([^)]*\\)') !== -1;  // Has receiver
					
					functions.push({
						name,
						startLine: i,
						endLine,
						type: isMethod ? 'method' : 'function'
					});
					break;
				}
			}
		}

		return functions;
	}

	isCommentLine(line: string): boolean {
		const trimmed = line.trim();
		return trimmed.indexOf('//') === 0 || 
			   trimmed.indexOf('/*') === 0 || 
			   trimmed.indexOf('*') === 0 || 
			   trimmed.indexOf('*/') === (trimmed.length - 2) ||
			   (trimmed.indexOf('/**') === 0 && trimmed.indexOf('*/') === (trimmed.length - 2));
	}

	/**
	 * Find the end of a Go function
	 */
	private findFunctionEnd(lines: string[], startLine: number): number {
		const startingLine = lines[startLine];
		
		// If function declaration doesn't have a body (interface method)
		if (startingLine.indexOf('{') === -1 && 
			!this.hasBodyOnNextLine(lines, startLine)) {
			return startLine;
		}

		// Function with body - find matching closing brace
		return this.findBlockEnd(lines, startLine);
	}

	/**
	 * Find the end of a Go type declaration (struct/interface)
	 */
	private findTypeEnd(lines: string[], startLine: number): number {
		const startingLine = lines[startLine];
		
		// Single line type alias
		if (startingLine.indexOf('{') === -1) {
			return startLine;
		}

		// Multi-line struct/interface
		return this.findBlockEnd(lines, startLine);
	}

	/**
	 * Check if function body starts on the next line
	 */
	private hasBodyOnNextLine(lines: string[], currentLine: number): boolean {
		if (currentLine + 1 >= lines.length) {
			return false;
		}
		
		const nextLine = lines[currentLine + 1].trim();
		return nextLine.indexOf('{') === 0;
	}
}