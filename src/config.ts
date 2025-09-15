import * as vscode from 'vscode';

export interface WhyConfig {
  apiKey: string;
  apiProvider: 'openai' | 'claude';
  contextLines: number;
  excludePatterns: string[];
  autoAnalyze: boolean;
  debounceMs: number;
  outputLanguage: 'auto' | 'en' | 'ja';
  openaiModel: string;
  claudeModel: string;
}

export function getConfig(): WhyConfig {
  const c = vscode.workspace.getConfiguration('whycomment');
  return {
    apiKey: c.get('apiKey', ''),
    apiProvider: c.get('apiProvider', 'claude'),
    contextLines: c.get('contextLines', 1),
    excludePatterns: c.get('excludePatterns', ["**/*.test.*", "**/*.spec.*"]),
    autoAnalyze: c.get('autoAnalyze', true),
    debounceMs: c.get('debounceMs', 1000),
    outputLanguage: c.get('outputLanguage', 'auto'),
    openaiModel: c.get('openaiModel', 'gpt-4o-mini'),
    claudeModel: c.get('claudeModel', 'claude-3-5-haiku-latest')
  } satisfies WhyConfig;
}

export function onConfigChange(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('whycomment')) listener();
  });
}
