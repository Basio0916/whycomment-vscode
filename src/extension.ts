import * as vscode from 'vscode';
import { getConfig, onConfigChange } from './config';
import { anyGlobMatch, getLineCommentToken, revealPosition, showInfo } from './utils';
import { getDiffForFile } from './git';
// Static heuristics removed per project decision (LLM-only)
import { analyzeWithLLM } from './llm';
import { Suggestion } from './types';
import { SuggestionStore } from './suggestions';
import { SuggestionTreeProvider } from './tree';

let store: SuggestionStore;
let tree: SuggestionTreeProvider;
let treeView: vscode.TreeView<any>;
const debounceTimers = new Map<string, NodeJS.Timeout>();
const cache = new Map<string, Suggestion[]>(); // diff-hash -> suggestions
// Keep last analyzed file text to send incremental diffs only
const previousTextByFile = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
  store = new SuggestionStore();
  tree = new SuggestionTreeProvider(() => collectAllSuggestions());
  treeView = vscode.window.createTreeView('whycommentView', { treeDataProvider: tree });

  context.subscriptions.push(
    treeView,
    onConfigChange(() => showInfo('Configuration updated')),
    vscode.workspace.onDidChangeTextDocument(onDocChanged),
    vscode.workspace.onDidSaveTextDocument(doc => scheduleAnalyze(doc.uri)),
    vscode.commands.registerCommand('whycomment.analyzeSelection', analyzeSelection),
    // Register clear-all to fix view title button error
    vscode.commands.registerCommand('whycomment.clearAll', clearAllSuggestions),
    vscode.commands.registerCommand('whycomment.applySuggestion', applySuggestion),
    vscode.commands.registerCommand('whycomment.ignoreSuggestion', ignoreSuggestion),
    vscode.commands.registerCommand('whycomment.toggleAutoAnalyze', toggleAutoAnalyze),
    vscode.commands.registerCommand('whycomment.chooseLanguage', chooseLanguage)
  );
}

export function deactivate() {}

function collectAllSuggestions(): Suggestion[] {
  return store.all().filter(s => !s.applied && !s.ignored);
}

function scheduleAnalyze(uri: vscode.Uri) {
  const cfg = getConfig();
  if (!cfg.autoAnalyze) return;
  const key = uri.toString();
  clearTimeout(debounceTimers.get(key) as NodeJS.Timeout);
  const timer = setTimeout(() => {
    void analyzeUri(uri);
  }, cfg.debounceMs);
  debounceTimers.set(key, timer);
}

// analyzeCurrentFile command removed per request

async function analyzeSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const selection = editor.selection;
  if (!selection || selection.isEmpty) {
    void vscode.window.showInformationMessage('WhyComment: 選択範囲がありません。');
    return;
  }
  const cfg = getConfig();
  const startLine = selection.start.line;
  const endLine = selection.end.line;
  const endChar = selection.end.character;
  // Determine inclusive last line of content
  const lastLine = endChar === 0 && endLine > startLine ? endLine - 1 : endLine;
  const len = lastLine - startLine + 1;
  // Build a minimal unified diff containing only added lines for the selection
  const lines: string[] = [];
  lines.push(`@@ -${startLine + 1},${len} +${startLine + 1},${len} @@`);
  for (let i = startLine; i <= lastLine; i++) {
    lines.push('+' + doc.lineAt(i).text);
  }
  const diff = lines.join('\n');

  try {
    const llmKey = cfg.apiKey?.trim();
    let suggestions: Suggestion[] = [];
    if (llmKey) {
      const quotaOk = await withinDailyLimit(0);
      if (!quotaOk) {
        void vscode.window.showInformationMessage('WhyComment: 1日の上限に達しました。');
        return;
      }
      const model = cfg.apiProvider === 'openai' ? cfg.openaiModel : cfg.claudeModel;
      suggestions = await analyzeWithLLM(doc.uri, diff, { apiKey: llmKey, provider: cfg.apiProvider, language: cfg.outputLanguage, model });
      // Re-anchor suggestions to the current document content to avoid line drift
      suggestions = await resolveSuggestionLocations(doc.uri, suggestions);
      await incrementDailyCount();
    } else {
      void vscode.window.showInformationMessage('WhyComment: LLMのAPIキーが設定されていません。');
      return;
    }

    // Keep only suggestions that fall within the selected range
    const filtered = suggestions.filter(s => s.line >= startLine && s.line <= lastLine);
    if (!filtered.length) {
      showInfo('No suggestions for selection');
      return;
    }
    const existing = store.getForFile(doc.uri);
    const merged = appendAndDedupe(existing, filtered);
    store.setForFile(doc.uri, merged);
    tree.refresh();
    // Optionally reveal first suggestion
    const first = filtered[0];
    revealPosition(first.uri, new vscode.Position(first.line, 0));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showWarningMessage(`WhyComment selection analysis failed: ${msg}`);
  }
}

async function analyzeUri(uri: vscode.Uri, opts?: { manual?: boolean }) {
  try {
    const cfg = getConfig();
    const relPath = vscode.workspace.asRelativePath(uri);
    if (anyGlobMatch(cfg.excludePatterns, relPath)) {
      showInfo(`Excluded: ${relPath}`);
      return;
    }

    // Compute incremental diff vs last analyzed snapshot when available; otherwise use git diff vs HEAD
    const doc = await vscode.workspace.openTextDocument(uri);
    const currentText = doc.getText();
    const prevText = previousTextByFile.get(uri.toString());
    let diff: string | undefined;
    if (prevText !== undefined) {
      try {
        const { createTwoFilesPatch } = require('diff') as typeof import('diff');
        diff = createTwoFilesPatch('prev', 'cur', prevText, currentText, '', '', { context: cfg.contextLines });
      } catch {
        diff = await getDiffForFile(uri, cfg.contextLines);
      }
    } else {
      diff = await getDiffForFile(uri, cfg.contextLines);
    }
    if (!diff || !diff.trim()) {
      showInfo('No changes vs HEAD');
      store.clearForFile(uri);
      tree.refresh();
      return;
    }

    // optional: previously limited large diffs; no limit now

    const cacheKey = require('crypto').createHash('sha1').update(diff).digest('hex');
    let suggestions = cache.get(cacheKey);
    if (!suggestions) {
      suggestions = [];
      // LLM only: if configured and within daily limit
      const llmKey = cfg.apiKey?.trim();
      if (llmKey) {
        const quotaOk = await withinDailyLimit(0);
        if (quotaOk) {
          const model = cfg.apiProvider === 'openai' ? cfg.openaiModel : cfg.claudeModel;
          // Call LLM without skipLines; UI handles dedupe
          const llmItems = await analyzeWithLLM(uri, diff, { apiKey: llmKey, provider: cfg.apiProvider, language: cfg.outputLanguage, model });
          suggestions = llmItems;
          await incrementDailyCount();
        } else {
          
        }
      }
      // Resolve only new suggestions against current document using anchors when available
      suggestions = await resolveSuggestionLocations(uri, suggestions);
      // Drop suggestions that are already explained by nearby comments
      suggestions = await filterAlreadyExplained(uri, suggestions);
      // Keep suggestions only on added lines of this diff
      suggestions = filterToAddedLines(diff, suggestions);
      cache.set(cacheKey, suggestions);
    }

    // Append new suggestions to existing list (do not clear) and avoid duplicate lines
    const existing = store.getForFile(uri);
    const existingActive = existing.filter(x => !x.applied && !x.ignored);
    const existingLines = new Set(existingActive.map(x => x.line));
    const filteredIncoming = suggestions.filter(s => !existingLines.has(s.line));
    const merged = appendAndDedupe(existing, filteredIncoming);
    store.setForFile(uri, merged);
    // Update baseline snapshot for incremental diffs
    previousTextByFile.set(uri.toString(), currentText);
    tree.refresh();
    if (opts?.manual && suggestions.length === 0) {
      void vscode.window.showInformationMessage('WhyComment: No suggestions. Nice and clear!');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showWarningMessage(`WhyComment error: ${msg}`);
  }
}

function dedupe(items: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of items) {
    const k = `${s.uri.toString()}:${s.line}:${s.message}`;
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}

function appendAndDedupe(existing: Suggestion[], incoming: Suggestion[]): Suggestion[] {
  const map = new Map<string, Suggestion>();
  for (const s of existing) map.set(s.id, s);
  for (const s of incoming) map.set(s.id, s);
  return Array.from(map.values());
}

async function applySuggestion(item?: any) {
  // When invoked from context menu, item.suggestion is available.
  let s: Suggestion | undefined = item?.suggestion as Suggestion | undefined;
  if (!s) {
    const editor = vscode.window.activeTextEditor;
    const uri = editor?.document.uri;
    if (!uri) return;
    const suggestions = store.getForFile(uri);
    s = suggestions.find(x => x.line === editor.selection.active.line) ?? suggestions[0];
  }
  if (!s) return;
  // Insert the suggested comment from LLM; if empty, prompt the user
  let text = (s.suggestedComment || '').trim();
  if (!text) {
    const langIsJa = (vscode.env.language || '').toLowerCase().startsWith('ja');
    const input = await vscode.window.showInputBox({
      prompt: langIsJa ? '挿入するコメントを入力してください' : 'Enter the comment to insert',
      value: s.message || ''
    });
    if (!input) return;
    text = input.trim();
  }
  await insertCommentAbove({ ...s, suggestedComment: text });
  s.applied = true; store.update(s); tree.refresh();
}

async function ignoreSuggestion(item?: any) {
  // Support ignoring from tree item or from cursor line
  const sFromItem: Suggestion | undefined = item?.suggestion as Suggestion | undefined;
  if (sFromItem) {
    sFromItem.ignored = true; store.update(sFromItem); tree.refresh(); return;
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const uri = editor.document.uri;
  const line0 = editor.selection.active.line;
  const items = store.getForFile(uri);
  const s = items.find(x => x.line === line0) ?? items.find(x => !x.applied && !x.ignored);
  if (!s) return;
  s.ignored = true; store.update(s); tree.refresh();
}

async function insertCommentAbove(s: Suggestion) {
  const doc = await vscode.workspace.openTextDocument(s.uri);
  const editor = await vscode.window.showTextDocument(doc);
  const token = getLineCommentToken(doc.languageId);
  const raw = s.suggestedComment.trim();
  const commentLine = raw.startsWith(token) ? raw : `${token} ${raw}`;
  const targetLine = Math.min(Math.max(0, s.line), doc.lineCount - 1);
  const targetText = doc.lineAt(targetLine).text;
  const indent = (targetText.match(/^\s*/)?.[0]) ?? '';
  const lineWithIndent = indent + commentLine + '\n';
  await editor.edit(edit => {
    edit.insert(new vscode.Position(targetLine, 0), lineWithIndent);
  });
  revealPosition(s.uri, new vscode.Position(targetLine, indent.length));
}

async function toggleAutoAnalyze() {
  const cfg = getConfig();
  const newVal = !cfg.autoAnalyze;
  await vscode.workspace.getConfiguration('whycomment').update('autoAnalyze', newVal, vscode.ConfigurationTarget.Workspace);
  showInfo(`Auto analyze ${newVal ? 'enabled' : 'disabled'}`);
}

async function chooseLanguage() {
  const cfg = getConfig();
  const picked = await vscode.window.showQuickPick([
    { label: 'Auto', value: 'auto' },
    { label: 'English', value: 'en' },
    { label: '日本語', value: 'ja' }
  ], { placeHolder: 'Select output language for suggested comments' });
  if (!picked) return;
  await vscode.workspace.getConfiguration('whycomment').update('outputLanguage', picked.value, vscode.ConfigurationTarget.Workspace);
  showInfo(`Language set to ${picked.label}`);
}

async function clearAllSuggestions() {
  const answer = await vscode.window.showWarningMessage('Clear all WhyComment suggestions?', { modal: true }, 'Clear');
  if (answer !== 'Clear') return;
  store.clearAll();
  tree.refresh();
  showInfo('All suggestions cleared');
}

// chooseOpenAIModel command removed per request

// Daily limit feature removed; keep no-op stubs for compatibility
async function withinDailyLimit(_limit: number): Promise<boolean> { return true; }
async function incrementDailyCount(): Promise<void> { /* no-op */ }

async function resolveSuggestionLocations(uri: vscode.Uri, items: Suggestion[]): Promise<Suggestion[]> {
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const lines = new Array<string>(doc.lineCount);
    for (let i = 0; i < doc.lineCount; i++) lines[i] = doc.lineAt(i).text;
    for (const s of items) {
      if (s.anchor && s.anchor.trim().length > 0) {
        const needle = s.anchor.replace(/^\+|^-|^\s/, '').trim();
        const candidates: number[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === needle || lines[i].includes(needle)) {
            candidates.push(i);
          }
        }
        if (candidates.length) {
          // choose closest to current s.line as a hint
          const target = candidates.reduce((best, cur) => {
            return Math.abs(cur - s.line) < Math.abs(best - s.line) ? cur : best;
          }, candidates[0]);
          s.line = target;
        } else {
          // clamp
          s.line = Math.min(Math.max(0, s.line), doc.lineCount - 1);
        }
      } else {
        s.line = Math.min(Math.max(0, s.line), doc.lineCount - 1);
      }
    }
    return items;
  } catch {
    return items;
  }
}

function filterToAddedLines(diff: string, items: Suggestion[]): Suggestion[] {
  const added = addedLinesFromUnifiedDiff(diff);
  return items.filter(s => added.has(s.line));
}

function addedLinesFromUnifiedDiff(diff: string): Set<number> {
  const set = new Set<number>();
  const lines = diff.split(/\r?\n/);
  let inHunk = false;
  let newLine = 0; // 1-based during walk
  const header = /^@@\s+-(\d+),(\d+)\s+\+(\d+),(\d+)\s+@@/;
  for (const line of lines) {
    const m = line.match(header);
    if (m) {
      inHunk = true;
      newLine = parseInt(m[3], 10);
      continue;
    }
    if (!inHunk) continue;
    if (!line) continue;
    const t = line[0];
    if (t === ' ') {
      newLine++;
    } else if (t === '+') {
      set.add(newLine - 1); // store as 0-based
      newLine++;
    } else if (t === '-') {
      // removed: does not advance newLine
    } else if (t === '@') {
      inHunk = false;
    }
  }
  return set;
}

async function chooseBestComment(s: Suggestion): Promise<string | undefined> {
  const raw = (s.suggestedComment || '').trim();
  const msg = (s.message || '').trim();
  const langIsJa = (vscode.env.language || '').toLowerCase().startsWith('ja');
  const genericEn = 'Explain the intent and constraints.';
  const genericJa = 'この意図・前提・制約を簡潔に説明してください。';
  const genericMsgJa = '理由を説明してください';
  const isGeneric = (txt: string) => !txt || txt === genericEn || txt === genericJa || txt === genericMsgJa;

  // Auto-pick if suggested is specific
  if (!isGeneric(raw)) return raw;

  // Build a reasonable default skeleton
  const skeleton = langIsJa ? 'なぜこの変更？' : 'Why this change?';
  const prefill = !isGeneric(msg) ? msg : skeleton;

  // Ask user to confirm/edit when info is insufficient
  const input = await vscode.window.showInputBox({
    prompt: langIsJa ? '挿入するコメントを確認・編集してください' : 'Confirm or edit the comment to insert',
    value: prefill,
    validateInput: (v) => v.trim().length === 0 ? (langIsJa ? '空のコメントは挿入できません' : 'Comment cannot be empty') : undefined
  });
  return input?.trim();
}

async function filterAlreadyExplained(uri: vscode.Uri, items: Suggestion[]): Promise<Suggestion[]> {
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const token = getLineCommentToken(doc.languageId);
    const hasAnyComment = (lineText: string): boolean => {
      // 任意のコメントがあれば説明済みとみなす（簡易実装）
      const idx = lineText.indexOf(token);
      return idx !== -1;
    };

    const out: Suggestion[] = [];
    for (const s of items) {
      const line = Math.min(Math.max(0, s.line), doc.lineCount - 1);
      let explained = false;
      // Check same line and up to 3 lines above
      for (let d = 0; d <= 3; d++) {
        const i = line - d;
        if (i < 0) break;
        const text = doc.lineAt(i).text;
        if (hasAnyComment(text)) { explained = true; break; }
        // Stop early if we hit a non-empty, non-comment line above the target (except d==0)
        if (d > 0) {
          const trimmed = text.trim();
          if (trimmed.length > 0 && !trimmed.startsWith(token)) {
            // likely a code barrier; don't scan further up
            break;
          }
        }
      }
      if (!explained) out.push(s);
    }
    return out;
  } catch {
    return items;
  }
}

function onDocChanged(e: vscode.TextDocumentChangeEvent) {
  const uri = e.document.uri;
  const arr = store.getForFile(uri);
  if (!arr.length) return;
  let changed = false;
  for (const change of e.contentChanges) {
    const start = change.range.start.line;
    const end = change.range.end.line;
    const removed = end - start;
    const added = (change.text.match(/\n/g) || []).length;
    const delta = added - removed;
    if (delta === 0) continue;
    for (const s of arr) {
      if (s.applied || s.ignored) continue;
      if (s.line > end) {
        s.line += delta; changed = true;
      } else if (s.line >= start && s.line <= end) {
        // If the change overlaps the suggestion line, snap to start of change
        s.line = Math.max(0, start + added);
        changed = true;
      }
    }
  }
  if (changed) { store.setForFile(uri, arr); tree.refresh(); }
}
