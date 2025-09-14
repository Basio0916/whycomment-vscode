import * as vscode from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

export function isUnderWorkspace(uri: vscode.Uri): boolean {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return !!folder;
}

// Minimal glob matcher supporting ** and * only.
export function matchesGlob(pattern: string, filePath: string): boolean {
  // Normalize to posix-like for matching
  const normalized = filePath.replace(/\\/g, '/');
  const normPat = pattern.replace(/\\/g, '/');

  // Escape regex special chars except *
  const esc = (s: string) => s.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  let rx = esc(normPat)
    .replace(/\*\*/g, '§§DOUBLESTAR§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§DOUBLESTAR§§/g, '.*');
  rx = `^${rx}$`;
  return new RegExp(rx).test(normalized);
}

export function anyGlobMatch(patterns: string[], filePath: string): boolean {
  return patterns.some(p => matchesGlob(p, filePath));
}

export function getLineCommentToken(languageId: string): string {
  // Best-effort mapping; default to '//'
  switch (languageId) {
    case 'python':
    case 'ruby':
    case 'shellscript':
    case 'yaml':
    case 'makefile':
    case 'toml':
      return '#';
    case 'haskell':
      return '--';
    case 'lua':
      return '--';
    default:
      return '//';
  }
}

export function showInfo(message: string): void {
  void vscode.window.setStatusBarMessage(`WhyComment: ${message}`, 3000);
}

export function revealPosition(uri: vscode.Uri, pos: vscode.Position): void {
  const opts: vscode.TextDocumentShowOptions = {
    preview: true,
    preserveFocus: true,
    selection: new vscode.Range(pos, pos)
  };
  void vscode.window.showTextDocument(uri, opts);
}

export function relativeToWorkspace(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return uri.fsPath;
  return path.relative(folder.uri.fsPath, uri.fsPath) || path.basename(uri.fsPath);
}
