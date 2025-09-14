import * as vscode from 'vscode';
import * as path from 'path';
import { ContextData, ChangeInfo, FileContext, LanguageParser, ContextExtractionConfig, FunctionInfo } from './types';
import { TypeScriptParser, PythonParser, JavaParser, GoParser } from './parsers';

/**
 * Service for extracting context around code changes for LLM analysis
 */
export class ContextExtractionService {
	private parsers: Map<string, LanguageParser> = new Map();
	private config: ContextExtractionConfig;

	constructor() {
		this.initializeParsers();
		this.config = this.loadConfiguration();
	}

	private initializeParsers(): void {
		const parsers = [
			new TypeScriptParser(),
			new PythonParser(),
			new JavaParser(),
			new GoParser()
		];

		for (const parser of parsers) {
			for (const extension of parser.fileExtensions) {
				this.parsers.set(extension, parser);
			}
		}
	}

	private loadConfiguration(): ContextExtractionConfig {
		const config = vscode.workspace.getConfiguration('whycomment');
		return {
			contextLines: config.get<number>('contextLines', 10),
			supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'go'],
			excludeComments: config.get<boolean>('excludeComments', false)
		};
	}

	/**
	 * Extract context data for a list of changes
	 */
	public async extractContext(changes: ChangeInfo[]): Promise<ContextData[]> {
		const contextDataList: ContextData[] = [];

		// Group changes by file for efficient processing
		const changesByFile = this.groupChangesByFile(changes);

		for (const [filePath, fileChanges] of changesByFile) {
			try {
				const fileContext = await this.loadFileContext(filePath, fileChanges);
				const contextData = this.processFileContext(fileContext);
				contextDataList.push(...contextData);
			} catch (error) {
				console.error(`Error processing file ${filePath}:`, error);
			}
		}

		return contextDataList;
	}

	/**
	 * Extract context for a single change
	 */
	public async extractSingleContext(change: ChangeInfo): Promise<ContextData | null> {
		try {
			const fileContext = await this.loadFileContext(change.filePath, [change]);
			const contextData = this.processFileContext(fileContext);
			return contextData.length > 0 ? contextData[0] : null;
		} catch (error) {
			console.error(`Error processing change in ${change.filePath}:`, error);
			return null;
		}
	}

	private groupChangesByFile(changes: ChangeInfo[]): Map<string, ChangeInfo[]> {
		const grouped = new Map<string, ChangeInfo[]>();
		
		for (const change of changes) {
			if (!grouped.has(change.filePath)) {
				grouped.set(change.filePath, []);
			}
			grouped.get(change.filePath)!.push(change);
		}
		
		return grouped;
	}

	private async loadFileContext(filePath: string, changes: ChangeInfo[]): Promise<FileContext> {
		const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
		const lines = document.getText().split('\n');
		const language = this.detectLanguage(filePath);

		return {
			filePath,
			language,
			lines,
			changes
		};
	}

	private detectLanguage(filePath: string): string {
		const extension = path.extname(filePath).toLowerCase();
		const parser = this.parsers.get(extension);
		return parser?.language || 'unknown';
	}

	private processFileContext(fileContext: FileContext): ContextData[] {
		const { filePath, language, lines, changes } = fileContext;
		const parser = this.getParserForLanguage(language);
		
		if (!parser) {
			return this.createBasicContextData(fileContext);
		}

		// Parse functions/classes in the file
		const functions = parser.parseFunctions(lines);

		return changes.map(change => {
			const contextBefore = this.extractContextBefore(lines, change.lineNumber, parser);
			const contextAfter = this.extractContextAfter(lines, change.lineNumber, parser);
			const functionInfo = this.findContainingFunction(functions, change.lineNumber);

			return {
				changeType: change.changeType,
				lineNumber: change.lineNumber,
				content: change.content,
				contextBefore,
				contextAfter,
				functionName: functionInfo?.name,
				className: this.findContainingClass(functions, change.lineNumber)?.name
			};
		});
	}

	private getParserForLanguage(language: string): LanguageParser | undefined {
		for (const parser of this.parsers.values()) {
			if (parser.language === language) {
				return parser;
			}
		}
		return undefined;
	}

	private createBasicContextData(fileContext: FileContext): ContextData[] {
		const { lines, changes } = fileContext;

		return changes.map(change => ({
			changeType: change.changeType,
			lineNumber: change.lineNumber,
			content: change.content,
			contextBefore: this.getLines(lines, 
				Math.max(0, change.lineNumber - this.config.contextLines), 
				change.lineNumber - 1
			),
			contextAfter: this.getLines(lines,
				change.lineNumber + 1,
				Math.min(lines.length - 1, change.lineNumber + this.config.contextLines)
			)
		}));
	}

	private extractContextBefore(lines: string[], lineNumber: number, parser: LanguageParser): string[] {
		const startLine = Math.max(0, lineNumber - this.config.contextLines);
		const contextLines = this.getLines(lines, startLine, lineNumber - 1);
		
		return this.config.excludeComments 
			? contextLines.filter(line => !parser.isCommentLine(line))
			: contextLines;
	}

	private extractContextAfter(lines: string[], lineNumber: number, parser: LanguageParser): string[] {
		const endLine = Math.min(lines.length - 1, lineNumber + this.config.contextLines);
		const contextLines = this.getLines(lines, lineNumber + 1, endLine);
		
		return this.config.excludeComments 
			? contextLines.filter(line => !parser.isCommentLine(line))
			: contextLines;
	}

	private getLines(lines: string[], startLine: number, endLine: number): string[] {
		const result: string[] = [];
		for (let i = startLine; i <= endLine && i < lines.length; i++) {
			result.push(lines[i]);
		}
		return result;
	}

	private findContainingFunction(functions: FunctionInfo[], lineNumber: number): FunctionInfo | undefined {
		return functions.find(func => 
			func.type === 'function' || func.type === 'method' &&
			lineNumber >= func.startLine && 
			lineNumber <= func.endLine
		);
	}

	private findContainingClass(functions: FunctionInfo[], lineNumber: number): FunctionInfo | undefined {
		return functions.find(func => 
			func.type === 'class' &&
			lineNumber >= func.startLine && 
			lineNumber <= func.endLine
		);
	}

	/**
	 * Update configuration when VS Code settings change
	 */
	public updateConfiguration(): void {
		this.config = this.loadConfiguration();
	}

	/**
	 * Get current configuration
	 */
	public getConfiguration(): ContextExtractionConfig {
		return { ...this.config };
	}

	/**
	 * Check if a file type is supported
	 */
	public isFileSupported(filePath: string): boolean {
		const extension = path.extname(filePath).toLowerCase();
		return this.parsers.has(extension);
	}
}