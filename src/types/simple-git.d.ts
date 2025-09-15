// Type definitions for simple-git module
declare module 'simple-git' {
    export interface SimpleGitOptions {
        baseDir?: string;
        binary?: string;
        maxConcurrentProcesses?: number;
        timeout?: {
            block: number;
        };
    }

    export interface StatusResult {
        current: string;
        tracking: string | null;
        ahead: number;
        behind: number;
        files: StatusFile[];
        modified: string[];
        created: string[];
        deleted: string[];
        renamed: Array<{ from: string; to: string }>;
        conflicted: string[];
        not_added: string[];
    }

    export interface StatusFile {
        path: string;
        index: string;
        working_dir: string;
    }

    export interface SimpleGit {
        status(): Promise<StatusResult>;
        diff(options?: string[]): Promise<string>;
        init(bare?: boolean): Promise<void>;
        add(files: string | string[]): Promise<void>;
        commit(message: string): Promise<void>;
        raw(commands: string[]): Promise<string>;
        checkIsRepo(): Promise<boolean>;
    }

    export function simpleGit(baseDir?: string, options?: SimpleGitOptions): SimpleGit;
}