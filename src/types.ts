/**
 * Core types and interfaces for WhyComment context extraction service
 */

export interface ContextData {
	changeType: 'added' | 'modified' | 'deleted';
	lineNumber: number;
	content: string;
	contextBefore: string[];
	contextAfter: string[];
	functionName?: string;
	className?: string;
}

export interface ChangeInfo {
	filePath: string;
	lineNumber: number;
	changeType: 'added' | 'modified' | 'deleted';
	content: string;
}

export interface ContextExtractionConfig {
	contextLines: number;
	supportedLanguages: string[];
	excludeComments: boolean;
}

export interface FileContext {
	filePath: string;
	language: string;
	lines: string[];
	changes: ChangeInfo[];
}

export interface FunctionInfo {
	name: string;
	startLine: number;
	endLine: number;
	type: 'function' | 'method' | 'class' | 'interface';
}

export interface LanguageParser {
	language: string;
	fileExtensions: string[];
	
	/**
	 * Extract function/class information from file content
	 */
	parseFunctions(lines: string[]): FunctionInfo[];
	
	/**
	 * Check if a line is a comment
	 */
	isCommentLine(line: string): boolean;
	
	/**
	 * Check if a line is executable code (not comment or whitespace)
	 */
	isExecutableLine(line: string): boolean;
}