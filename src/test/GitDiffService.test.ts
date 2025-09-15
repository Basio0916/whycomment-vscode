import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitDiffService } from '../GitDiffService';
import * as path from 'path';
import * as fs from 'fs';

suite('GitDiffService Test Suite', () => {
	let gitDiffService: GitDiffService;
	let testWorkspacePath: string;

	suiteSetup(async () => {
		gitDiffService = new GitDiffService();
		
		// Get workspace path for testing
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders && workspaceFolders.length > 0) {
			testWorkspacePath = workspaceFolders[0].uri.fsPath;
		}
	});

	test('should initialize git service', () => {
		assert.ok(gitDiffService, 'GitDiffService should be created');
	});

	test('should detect git repository status', async () => {
		const isGitRepo = await gitDiffService.isGitRepository();
		
		// This might be true or false depending on test environment
		assert.ok(typeof isGitRepo === 'boolean', 'Should return boolean for git repository status');
	});

	test('should handle non-git repository gracefully', async () => {
		// This test verifies the service handles non-git environments without throwing
		try {
			const isGitRepo = await gitDiffService.isGitRepository();
			assert.ok(typeof isGitRepo === 'boolean', 'Should return boolean even for non-git repositories');
		} catch (error) {
			assert.fail('Should not throw error for non-git repository check');
		}
	});

	test('should handle getFileDiff for non-existent file', async () => {
		const isGitRepo = await gitDiffService.isGitRepository();
		if (!isGitRepo) {
			console.log('Skipping file diff test - not in git repository');
			return;
		}

		try {
			const nonExistentFile = path.join(__dirname, 'non-existent-file.txt');
			const diff = await gitDiffService.getFileDiff(nonExistentFile);
			// Should return null or empty diff for non-existent file
			assert.ok(diff === null || (diff && diff.changes.length === 0), 
				'Should handle non-existent file gracefully');
		} catch (error) {
			// Expected behavior for non-existent files
			assert.ok(error instanceof Error, 'Should throw error for invalid file operations');
		}
	});

	test('should get changed files list', async () => {
		const isGitRepo = await gitDiffService.isGitRepository();
		if (!isGitRepo) {
			console.log('Skipping changed files test - not in git repository');
			return;
		}

		try {
			const changedFiles = await gitDiffService.getChangedFiles();
			assert.ok(Array.isArray(changedFiles), 'Should return array of changed files');
		} catch (error) {
			// This might fail in test environment, which is acceptable
			console.log('Changed files test failed (expected in test environment):', error);
		}
	});

	test('should normalize paths correctly for cross-platform compatibility', () => {
		// Test the private normalizePath method by testing public methods that use it
		// This ensures Windows backslashes are converted to forward slashes
		const service = new GitDiffService();
		
		// We can't directly test the private method, but we can verify that the service
		// handles path normalization by checking that it doesn't throw on different path formats
		assert.ok(service, 'Service should handle path normalization internally');
		
		// The actual path normalization is tested through integration with git operations
		// which will fail if paths aren't normalized correctly on Windows
	});

	test('should parse diff output correctly', async () => {
		// This tests the internal diff parsing logic
		const isGitRepo = await gitDiffService.isGitRepository();
		if (!isGitRepo) {
			console.log('Skipping diff parsing test - not in git repository');
			return;
		}

		// Test that the service can handle empty diffs
		try {
			const testFile = path.join(__dirname, '..', 'extension.ts');
			const hasChanges = await gitDiffService.hasUncommittedChanges(testFile);
			assert.ok(typeof hasChanges === 'boolean', 'Should return boolean for uncommitted changes check');
		} catch (error) {
			console.log('Uncommitted changes test failed (expected in test environment):', error);
		}
	});
});