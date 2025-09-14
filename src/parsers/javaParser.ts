import { BaseParser } from './baseParser';
import { FunctionInfo } from '../types';

/**
 * Parser for Java files
 */
export class JavaParser extends BaseParser {
	language = 'java';
	fileExtensions = ['.java'];

	private readonly methodPatterns = [
		/^\s*(?:public|private|protected)?\s*(?:static)?\s*(?:final)?\s*(?:synchronized)?\s*\w+\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
		/^\s*(?:public|private|protected)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/  // Constructor
	];

	private readonly classPatterns = [
		/^\s*(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
		/^\s*(?:public|private|protected)?\s*interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
		/^\s*(?:public|private|protected)?\s*enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
	];

	parseFunctions(lines: string[]): FunctionInfo[] {
		const functions: FunctionInfo[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Skip lines that are clearly not declarations
			if (this.isCommentLine(line) || line.trim().startsWith('@')) {
				continue;
			}

			// Check for classes/interfaces/enums
			for (const pattern of this.classPatterns) {
				const match = line.match(pattern);
				if (match) {
					const name = match[1];
					const endLine = this.findBlockEnd(lines, i);
					let type: 'class' | 'interface' = 'class';
					
					if (pattern.source.includes('interface')) {
						type = 'interface';
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

			// Check for methods
			for (const pattern of this.methodPatterns) {
				const match = line.match(pattern);
				if (match && this.isMethodDeclaration(line)) {
					const name = match[1];
					const endLine = this.findMethodEnd(lines, i);
					functions.push({
						name,
						startLine: i,
						endLine,
						type: 'method'
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

	/**
	 * Check if a line is actually a method declaration (not a method call)
	 */
	private isMethodDeclaration(line: string): boolean {
		// Method declarations typically have visibility modifiers or return types
		const hasVisibility = /\b(public|private|protected)\b/.test(line);
		const hasReturnType = /\b(void|int|String|boolean|long|double|float|char|byte|short|\w+(\[\])?)\s+\w+\s*\(/.test(line);
		const isNotCall = !line.includes('.') || line.trim().indexOf('(') < line.trim().indexOf('.');
		
		return (hasVisibility || hasReturnType) && isNotCall;
	}

	/**
	 * Find the end of a method, handling both block methods and abstract methods
	 */
	private findMethodEnd(lines: string[], startLine: number): number {
		const startingLine = lines[startLine];
		
		// Abstract method (ends with semicolon)
		if (startingLine.includes(';') && !startingLine.includes('{')) {
			return startLine;
		}

		// Method with body
		return this.findBlockEnd(lines, startLine);
	}
}