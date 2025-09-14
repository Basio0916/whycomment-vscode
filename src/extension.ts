// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitDiffService } from './GitDiffService';

interface DebounceTimer {
	[filePath: string]: NodeJS.Timeout;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('WhyComment extension is now active!');

	const gitDiffService = new GitDiffService();
	const debounceTimers: DebounceTimer = {};
	const debounceDelayMs = 3000; // 3 seconds as specified in PRD

	// Register file save event listener
	const onDidSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
		const filePath = document.uri.fsPath;
		
		console.log(`File saved: ${filePath}`);
		
		// Clear existing timer for this file
		if (debounceTimers[filePath]) {
			clearTimeout(debounceTimers[filePath]);
		}

		// Set new debounced timer
		debounceTimers[filePath] = setTimeout(async () => {
			try {
				await analyzeFileChanges(filePath, gitDiffService);
			} catch (error) {
				handleGitError(error);
			} finally {
				// Clean up timer
				delete debounceTimers[filePath];
			}
		}, debounceDelayMs);
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
			await analyzeFileChanges(activeEditor.document.uri.fsPath, gitDiffService);
		} catch (error) {
			handleGitError(error);
		}
	});

	// Add disposables to context
	context.subscriptions.push(onDidSaveDisposable, helloWorldDisposable, analyzeChangesDisposable);
}

async function analyzeFileChanges(filePath: string, gitDiffService: GitDiffService): Promise<void> {
	console.log(`Starting analysis for: ${filePath}`);

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

	// Display results (for now, just log and show info message)
	console.log('Git diff analysis completed:', {
		file: fileDiff.filePath,
		changesCount: fileDiff.changes.length,
		addedLines: fileDiff.changes.filter(c => c.type === 'added').length,
		modifiedLines: fileDiff.changes.filter(c => c.type === 'modified').length,
		deletedLines: fileDiff.changes.filter(c => c.type === 'deleted').length,
	});

	// Show analysis results to user
	const addedCount = fileDiff.changes.filter(c => c.type === 'added').length;
	const modifiedCount = fileDiff.changes.filter(c => c.type === 'modified').length;
	
	if (addedCount > 0 || modifiedCount > 0) {
		vscode.window.showInformationMessage(
			`WhyComment detected ${addedCount + modifiedCount} changed lines in ${fileDiff.filePath}. ` +
			`Added: ${addedCount}, Modified: ${modifiedCount}`
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
