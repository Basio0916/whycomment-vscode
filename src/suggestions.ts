import * as vscode from 'vscode';
import { Suggestion } from './types';

export class SuggestionStore {
  private byFile = new Map<string, Suggestion[]>();

  getForFile(uri: vscode.Uri): Suggestion[] {
    return this.byFile.get(uri.toString()) ?? [];
  }

  setForFile(uri: vscode.Uri, items: Suggestion[]): void {
    this.byFile.set(uri.toString(), items);
  }

  clearForFile(uri: vscode.Uri): void {
    this.byFile.delete(uri.toString());
  }

  clearAll(): void {
    this.byFile.clear();
  }

  update(s: Suggestion): void {
    const key = s.uri.toString();
    const items = this.byFile.get(key) ?? [];
    const idx = items.findIndex(i => i.id === s.id);
    if (idx >= 0) items[idx] = s; else items.push(s);
    this.byFile.set(key, items);
  }

  all(): Suggestion[] {
    const out: Suggestion[] = [];
    for (const arr of this.byFile.values()) out.push(...arr);
    return out;
  }
}
