// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitDiffService } from './GitDiffService';
import { ContextExtractionService, ContextData } from './ContextExtractionService';

interface DebounceTimer {
	[filePath: string]: NodeJS.Timeout;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('WhyComment extension is now active!');

	const gitDiffService = new GitDiffService();
	const contextService = new ContextExtractionService();
	const debounceTimers: DebounceTimer = {};
	
	// Get debounce delay from configuration
	const getDebounceDelay = () => vscode.workspace.getConfiguration('whycomment').get('debounceMs', 3000);

	// Register file save event listener
	const onDidSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
		const filePath = document.uri.fsPath;
		
		// Check if auto-analysis is enabled
		const autoAnalyze = vscode.workspace.getConfiguration('whycomment').get('autoAnalyze', true);
		if (!autoAnalyze) {
			return;
		}
		
		console.log(`File saved: ${filePath}`);
		
		// Clear existing timer for this file
		if (debounceTimers[filePath]) {
			clearTimeout(debounceTimers[filePath]);
		}

		// Set new debounced timer
		debounceTimers[filePath] = setTimeout(async () => {
			try {
				await analyzeFileChanges(filePath, gitDiffService, contextService);
			} catch (error) {
				handleGitError(error);
			} finally {
				// Clean up timer
				delete debounceTimers[filePath];
			}
		}, getDebounceDelay());
	});

	// Register configuration change listener
	const onDidChangeConfigurationDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('whycomment.contextLines')) {
			contextService.updateContextLines();
		}
	});

	// Register commands
	const helloWorldDisposable = vscode.commands.registerCommand('whycomment.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from WhyComment!');
	});

	const analyzeChangesDisposable = vscode.commands.registerCommand('whycomment.analyzeChanges', async () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showWarningMessage('No active file to analyze');
			return;
		}

		try {
			await analyzeFileChanges(activeEditor.document.uri.fsPath, gitDiffService, contextService);
		} catch (error) {
			handleGitError(error);
		}
	});

	// Add disposables to context
	context.subscriptions.push(
		onDidSaveDisposable, 
		onDidChangeConfigurationDisposable,
		helloWorldDisposable, 
		analyzeChangesDisposable
	);
}

async function analyzeFileChanges(
	filePath: string, 
	gitDiffService: GitDiffService, 
	contextService: ContextExtractionService
): Promise<void> {
	console.log(`Starting analysis for: ${filePath}`);

	// Check if WhyComment is enabled
	const enabled = vscode.workspace.getConfiguration('whycomment').get('enabled', true);
	if (!enabled) {
		console.log('WhyComment is disabled in configuration');
		return;
	}

	// Check if workspace has git repository
	const isGitRepo = await gitDiffService.isGitRepository();
	if (!isGitRepo) {
		vscode.window.showWarningMessage('Git repository not found. WhyComment requires a git repository to analyze changes.');
		return;
	}

	// Check if file has uncommitted changes
	const hasChanges = await gitDiffService.hasUncommittedChanges(filePath);
	if (!hasChanges) {
		console.log(`No uncommitted changes detected for: ${filePath}`);
		return;
	}

	// Get the diff for the file
	const fileDiff = await gitDiffService.getFileDiff(filePath);
	if (!fileDiff || fileDiff.changes.length === 0) {
		console.log(`No changes found in diff for: ${filePath}`);
		return;
	}

	// Check if changes exceed limit (50 lines as per PRD)
	const changedLinesCount = fileDiff.changes.filter(change => change.type === 'added' || change.type === 'modified').length;
	if (changedLinesCount > 50) {
		vscode.window.showWarningMessage(`Too many changes detected (${changedLinesCount} lines). WhyComment works best with smaller changes (max 50 lines).`);
		return;
	}

	// Extract context around changed lines
	let contextData: ContextData[];
	try {
		contextData = await contextService.extractContext(filePath, fileDiff.changes);
	} catch (error) {
		console.error('Error extracting context:', error);
		vscode.window.showErrorMessage(`Failed to extract context: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}

	// Display results (for now, just log and show info message)
	console.log('Context extraction completed:', {
		file: fileDiff.filePath,
		changesCount: fileDiff.changes.length,
		contextDataCount: contextData.length,
		addedLines: fileDiff.changes.filter(c => c.type === 'added').length,
		modifiedLines: fileDiff.changes.filter(c => c.type === 'modified').length,
		deletedLines: fileDiff.changes.filter(c => c.type === 'deleted').length,
	});

	// Log detailed context information
	for (const context of contextData) {
		console.log(`Line ${context.lineNumber} (${context.changeType}):`, {
			content: context.content.trim(),
			functionName: context.functionName,
			className: context.className,
			isComment: context.isComment,
			contextBeforeLines: context.contextBefore.length,
			contextAfterLines: context.contextAfter.length
		});
	}

	// Show analysis results to user
	const addedCount = contextData.filter(c => c.changeType === 'added').length;
	const modifiedCount = contextData.filter(c => c.changeType === 'modified').length;
	const contextLines = vscode.workspace.getConfiguration('whycomment').get('contextLines', 10);
	
	if (addedCount > 0 || modifiedCount > 0) {
		const functionsDetected = contextData.filter(c => c.functionName).length;
		const commentsDetected = contextData.filter(c => c.isComment).length;
		
		vscode.window.showInformationMessage(
			`WhyComment analyzed ${addedCount + modifiedCount} changes with ${contextLines}-line context. ` +
			`Functions detected: ${functionsDetected}, Comment lines: ${commentsDetected}`
		);
	}
}

function handleGitError(error: any): void {
	const errorMessage = error instanceof Error ? error.message : String(error);
	console.error('WhyComment git error:', errorMessage);

	if (errorMessage.includes('Not a git repository')) {
		vscode.window.showWarningMessage('Git repository not found. Please initialize git in your workspace.');
	} else if (errorMessage.includes('Git not initialized')) {
		vscode.window.showErrorMessage('WhyComment failed to initialize git. Please ensure git is installed.');
	} else {
		vscode.window.showErrorMessage(`WhyComment encountered an error: ${errorMessage}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
