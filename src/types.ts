import * as vscode from 'vscode';

export type SuggestionSource = 'heuristic' | 'llm';

export interface Suggestion {
  id: string;
  uri: vscode.Uri;
  line: number; // 0-based line index
  message: string;
  suggestedComment: string;
  anchor?: string; // optional code snippet to locate the line
  range?: vscode.Range;
  source: SuggestionSource;
  applied?: boolean;
  ignored?: boolean;
  createdAt: number;
}
