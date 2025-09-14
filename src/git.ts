import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

function execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }>
{ return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      if (err) {
        reject(Object.assign(new Error(`git ${args.join(' ')} failed: ${stderr || err.message}`), { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export async function getRepoRoot(uri: vscode.Uri): Promise<string | undefined> {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return undefined;
  try {
    const { stdout } = await execGit(['rev-parse', '--show-toplevel'], folder.uri.fsPath);
    return stdout.trim();
  } catch {
    return undefined;
  }
}

export async function getDiffForFile(uri: vscode.Uri, contextLines: number): Promise<string> {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) throw new Error('Workspace folder not found for file');
  const repoRoot = await getRepoRoot(uri);
  if (!repoRoot) throw new Error('Git repository not found');
  const rel = path.relative(repoRoot, uri.fsPath);
  // Use unified diff with context lines against HEAD
  const args = ['-C', repoRoot, 'diff', `--unified=${contextLines}`, '--no-color', 'HEAD', '--', rel];
  const { stdout } = await execGit(args, repoRoot);
  if (stdout && stdout.trim()) return stdout;
  // Fallback for untracked files: synthesize a diff from empty
  const tracked = await isTracked(repoRoot, rel);
  if (!tracked) {
    const data = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(data).toString('utf8');
    const lines = content.split(/\r?\n/);
    const header = [
      `diff --git a/${rel} b/${rel}`,
      `new file mode 100644`,
      `--- /dev/null`,
      `+++ b/${rel}`,
      `@@ -0,0 +1,${lines.length} @@`
    ];
    const body = lines.map(l => `+${l}`);
    return header.concat(body).join('\n');
  }
  return stdout;
}

async function isTracked(repoRoot: string, rel: string): Promise<boolean> {
  try {
    await execGit(['-C', repoRoot, 'ls-files', '--error-unmatch', '--', rel], repoRoot);
    return true;
  } catch { return false; }
}
