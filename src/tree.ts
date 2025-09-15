import * as vscode from 'vscode';
import { Suggestion } from './types';
import { relativeToWorkspace } from './utils';

export class SuggestionTreeProvider implements vscode.TreeDataProvider<SuggestionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SuggestionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private getItems: () => Suggestion[]) {}

  refresh(): void { this._onDidChangeTreeData.fire(); }

  getTreeItem(element: SuggestionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SuggestionTreeItem): Thenable<SuggestionTreeItem[]> {
    const items = this.getItems();

    // Root: list files only
    if (!element) {
      const grouped = new Map<string, Suggestion[]>();
      for (const s of items) {
        const k = s.uri.toString();
        const arr = grouped.get(k) ?? [];
        arr.push(s);
        grouped.set(k, arr);
      }
      const roots: SuggestionTreeItem[] = [];
      for (const [k, arr] of grouped) {
        const uri = vscode.Uri.parse(k);
        const fileLabel = relativeToWorkspace(uri);
        const fileItem = new SuggestionTreeItem(fileLabel, vscode.TreeItemCollapsibleState.Expanded);
        fileItem.contextValue = 'file';
        fileItem.resourceUri = uri;
        fileItem.description = `${arr.length}`;
        roots.push(fileItem);
      }
      return Promise.resolve(roots);
    }

    // Children of a file node: the suggestions for that file
    if (element.contextValue === 'file' && element.resourceUri) {
      const fileUri = element.resourceUri;
      const arr = items.filter(s => s.uri.toString() === fileUri.toString());
      const leaves: SuggestionTreeItem[] = [];
      for (const s of arr) {
        const messagePreview = truncate(s.message, 80);
        const label = `L${s.line + 1}: ${messagePreview}`;
        const leaf = new SuggestionTreeItem(label, vscode.TreeItemCollapsibleState.None);
        (leaf as any).suggestion = s;
        // Show a short hint on the right; keep icons from overlapping by avoiding inline commands in package.json
        const right = s.source ? s.source : '';
        leaf.description = right;
        leaf.contextValue = 'suggestion';
        (leaf as any).viewItem = 'suggestion';
        (leaf as any).viewItemApplied = !!s.applied;
        (leaf as any).viewItemIgnored = !!s.ignored;
        leaf.command = {
          title: 'Open',
          command: 'vscode.open',
          arguments: [s.uri, { selection: new vscode.Range(s.line, 0, s.line, 0) }]
        } as vscode.Command;
        // Tooltip shows the message (why question)
        leaf.tooltip = s.message;
        leaf.iconPath = new vscode.ThemeIcon(s.applied ? 'pass' : s.ignored ? 'circle-slash' : 'comment');
        leaves.push(leaf);
      }
      return Promise.resolve(leaves);
    }

    // Leaf nodes have no children
    return Promise.resolve([]);
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + '…';
}

export class SuggestionTreeItem extends vscode.TreeItem {}
