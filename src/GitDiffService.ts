import * as vscode from 'vscode';
import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import * as path from 'path';

export interface DiffLine {
    lineNumber: number;
    content: string;
    type: 'added' | 'modified' | 'deleted';
}

export interface FileDiff {
    filePath: string;
    changes: DiffLine[];
}

export class GitDiffService {
    private git: SimpleGit | null = null;
    private workspaceRoot: string | null = null;

    constructor() {
        this.initializeGit();
    }

    private initializeGit(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.workspaceRoot = null;
            return;
        }

        this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        const options: Partial<SimpleGitOptions> = {
            baseDir: this.workspaceRoot,
            binary: 'git',
            maxConcurrentProcesses: 1,
            trimmed: false,
        };

        this.git = simpleGit(options);
    }

    /**
     * Check if the current workspace is a git repository
     */
    public async isGitRepository(): Promise<boolean> {
        if (!this.git || !this.workspaceRoot) {
            return false;
        }

        try {
            await this.git.status();
            return true;
        } catch (error) {
            console.log('Not a git repository or git not available:', error);
            return false;
        }
    }

    /**
     * Get diff for a specific file compared to the last commit
     */
    public async getFileDiff(filePath: string): Promise<FileDiff | null> {
        if (!this.git || !this.workspaceRoot) {
            throw new Error('Git not initialized or no workspace');
        }

        if (!(await this.isGitRepository())) {
            throw new Error('Not a git repository');
        }

        try {
            // Get relative path from workspace root
            const relativePath = path.relative(this.workspaceRoot, filePath);
            
            // Get the diff for the specific file compared to HEAD
            const diffResult = await this.git.diff(['HEAD', '--', relativePath]);
            
            if (!diffResult) {
                return null; // No changes
            }

            const changes = this.parseDiffOutput(diffResult);
            
            return {
                filePath: relativePath,
                changes
            };
        } catch (error) {
            console.error('Error getting git diff:', error);
            throw error;
        }
    }

    /**
     * Parse git diff output and extract changed line numbers
     */
    private parseDiffOutput(diffOutput: string): DiffLine[] {
        const lines = diffOutput.split('\n');
        const changes: DiffLine[] = [];
        let currentLineNumber = 0;
        let inHunk = false;

        for (const line of lines) {
            // Parse hunk headers like @@ -1,4 +1,6 @@
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
                if (match) {
                    currentLineNumber = parseInt(match[1], 10);
                    inHunk = true;
                }
                continue;
            }

            if (!inHunk) {
                continue;
            }

            // Skip file headers
            if (line.startsWith('+++') || line.startsWith('---') || 
                line.startsWith('diff --git') || line.startsWith('index')) {
                continue;
            }

            if (line.startsWith('+') && !line.startsWith('+++')) {
                // Added line
                changes.push({
                    lineNumber: currentLineNumber,
                    content: line.substring(1), // Remove the + prefix
                    type: 'added'
                });
                currentLineNumber++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                // Deleted line (don't increment line number)
                changes.push({
                    lineNumber: currentLineNumber,
                    content: line.substring(1), // Remove the - prefix
                    type: 'deleted'
                });
            } else if (line.startsWith(' ')) {
                // Context line (unchanged)
                currentLineNumber++;
            }
        }

        return changes;
    }

    /**
     * Get all changed files since last commit
     */
    public async getChangedFiles(): Promise<string[]> {
        if (!this.git || !this.workspaceRoot) {
            throw new Error('Git not initialized or no workspace');
        }

        if (!(await this.isGitRepository())) {
            throw new Error('Not a git repository');
        }

        try {
            const status = await this.git.status();
            const changedFiles: string[] = [];

            // Include modified, added, and renamed files
            changedFiles.push(...status.modified);
            changedFiles.push(...status.created);
            changedFiles.push(...status.renamed.map(file => file.to));

            return changedFiles.map(file => path.join(this.workspaceRoot!, file));
        } catch (error) {
            console.error('Error getting changed files:', error);
            throw error;
        }
    }

    /**
     * Check if file has uncommitted changes
     */
    public async hasUncommittedChanges(filePath: string): Promise<boolean> {
        if (!this.git || !this.workspaceRoot) {
            return false;
        }

        try {
            const relativePath = path.relative(this.workspaceRoot, filePath);
            const status = await this.git.status();
            
            return status.modified.includes(relativePath) || 
                   status.created.includes(relativePath) ||
                   status.renamed.some(file => file.to === relativePath);
        } catch (error) {
            console.error('Error checking uncommitted changes:', error);
            return false;
        }
    }
}