import * as vscode from 'vscode';

export interface WhyConfig {
  enabled: boolean;
  apiKey: string;
  apiProvider: 'openai' | 'claude';
  contextLines: number;
  excludePatterns: string[];
  autoAnalyze: boolean;
  dailyLimit: number;
  debounceMs: number;
  maxChangedLines: number;
  outputLanguage: 'auto' | 'en' | 'ja';
  openaiModel: string;
  claudeModel: string;
  preferLLM: boolean;
}

export function getConfig(): WhyConfig {
  const c = vscode.workspace.getConfiguration('whycomment');
  return {
    enabled: c.get('enabled', true),
    apiKey: c.get('apiKey', ''),
    apiProvider: c.get('apiProvider', 'openai'),
    contextLines: c.get('contextLines', 1),
    excludePatterns: c.get('excludePatterns', ["**/*.test.*", "**/*.spec.*"]),
    autoAnalyze: c.get('autoAnalyze', true),
    dailyLimit: c.get('dailyLimit', 100),
    debounceMs: c.get('debounceMs', 3000),
    maxChangedLines: c.get('maxChangedLines', 200),
    outputLanguage: c.get('outputLanguage', 'auto'),
    openaiModel: c.get('openaiModel', 'gpt-4o-mini'),
    claudeModel: c.get('claudeModel', 'claude-3-5-sonnet-latest'),
    preferLLM: c.get('preferLLM', true)
  } satisfies WhyConfig;
}

export function onConfigChange(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('whycomment')) listener();
  });
}
