import { LanguageParser, FunctionInfo } from '../types';

/**
 * Abstract base class for language-specific parsers
 */
export abstract class BaseParser implements LanguageParser {
	abstract language: string;
	abstract fileExtensions: string[];

	abstract parseFunctions(lines: string[]): FunctionInfo[];
	abstract isCommentLine(line: string): boolean;

	/**
	 * Default implementation for checking if a line is executable
	 */
	isExecutableLine(line: string): boolean {
		const trimmed = line.trim();
		return trimmed.length > 0 && !this.isCommentLine(trimmed);
	}

	/**
	 * Helper method to extract function name from a line
	 */
	protected extractFunctionName(line: string, pattern: RegExp): string | null {
		const match = line.match(pattern);
		return match ? match[1] : null;
	}

	/**
	 * Find the end line of a block (function, class) based on bracket matching
	 */
	protected findBlockEnd(lines: string[], startLine: number, openBracket: string = '{', closeBracket: string = '}'): number {
		let bracketCount = 0;
		let foundStart = false;

		for (let i = startLine; i < lines.length; i++) {
			const line = lines[i];
			
			for (const char of line) {
				if (char === openBracket) {
					bracketCount++;
					foundStart = true;
				} else if (char === closeBracket && foundStart) {
					bracketCount--;
					if (bracketCount === 0) {
						return i;
					}
				}
			}
		}
		
		return lines.length - 1;
	}

	/**
	 * Check if a line matches any of the given patterns
	 */
	protected matchesAnyPattern(line: string, patterns: RegExp[]): boolean {
		return patterns.some(pattern => pattern.test(line));
	}
}