// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ContextExtractionService } from './contextExtractionService';
import { ChangeInfo } from './types';

let contextService: ContextExtractionService;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "whycomment" is now active!');

	// Initialize the context extraction service
	contextService = new ContextExtractionService();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const helloWorldDisposable = vscode.commands.registerCommand('whycomment.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from WhyComment!');
	});

	// Register context extraction command for testing
	const extractContextDisposable = vscode.commands.registerCommand('whycomment.extractContext', async () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const document = activeEditor.document;
		if (!contextService.isFileSupported(document.fileName)) {
			vscode.window.showWarningMessage(`File type not supported: ${document.fileName}`);
			return;
		}

		// Create a sample change for testing
		const selection = activeEditor.selection;
		const currentLine = selection.active.line;
		const lineText = document.lineAt(currentLine).text;

		const sampleChange: ChangeInfo = {
			filePath: document.fileName,
			lineNumber: currentLine,
			changeType: 'modified',
			content: lineText
		};

		try {
			const contextData = await contextService.extractSingleContext(sampleChange);
			if (contextData) {
				const output = JSON.stringify(contextData, null, 2);
				const outputChannel = vscode.window.createOutputChannel('WhyComment Context');
				outputChannel.clear();
				outputChannel.appendLine('Context extraction result:');
				outputChannel.appendLine(output);
				outputChannel.show();
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Error extracting context: ${error}`);
		}
	});

	// Listen for configuration changes
	const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('whycomment')) {
			contextService.updateConfiguration();
		}
	});

	context.subscriptions.push(helloWorldDisposable, extractContextDisposable, configChangeDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
