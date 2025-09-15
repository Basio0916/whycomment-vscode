import * as vscode from 'vscode';
import { Suggestion } from './types';
import { sha1 } from './utils';

// Minimal unified-diff hunk parser (local)
interface DiffHunk {
  newStart: number; // 1-based
  newLines: number;
  lines: string[]; // with leading +/-/space
}

function parseUnifiedDiff(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diff.split(/\r?\n/);
  let current: DiffHunk | null = null;
  const hunkHeader = /^@@\s+-(\d+),(\d+)\s+\+(\d+),(\d+)\s+@@/;
  for (const line of lines) {
    const m = line.match(hunkHeader);
    if (m) {
      if (current) hunks.push(current);
      current = { newStart: parseInt(m[3], 10), newLines: parseInt(m[4], 10), lines: [] };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
      current.lines.push(line);
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

interface LLMRequestOptions {
  apiKey: string;
  provider: 'openai' | 'claude';
  language: 'auto' | 'en' | 'ja';
  model: string;
}

export async function analyzeWithLLM(uri: vscode.Uri, diff: string, opts: LLMRequestOptions): Promise<Suggestion[]> {
  if (!opts.apiKey) return [];
  const annotated = annotateDiffWithNewLines(diff);
  if (!annotated.trim()) return [];
  const effectiveLang: 'en' | 'ja' = opts.language === 'auto'
    ? ((vscode.env.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en')
    : opts.language;
  const system = buildSystemPrompt(effectiveLang);
  const user = buildUserPrompt(annotated, effectiveLang);
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
  try {
    const completion = opts.provider === 'claude'
      ? await callClaudeWithMessages(messages, opts.apiKey, opts.model)
      : await callOpenAIWithMessages(messages, opts.apiKey, opts.model);
    return parseLLMResponse(uri, completion, effectiveLang);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showWarningMessage(`WhyComment LLM failed: ${msg}`);
    return [];
  }
}

function buildSystemPrompt(lang: 'en' | 'ja'): string {
  const langInstr = lang === 'ja' ? 'Language: Japanese.' : 'Language: English.';
  return [
    'Role: Reviewer for contextual "why" (rationale/assumptions).',
    'No style/refactor advice. Keep questions short and context-first.',
    'Skip if same line or <= 3 lines above already has a comment.',
    'Focus: comment where a reader would pause and need rationale - non-obvious ordering/early-continue/special-cases, unexplained constants/thresholds, math/tax/discount order, truncation/limits, init/sleep/heartbeat, complex conditions/regex/bitwise. Treat these as cues, not a checklist.',
    'Style for message: start with "Why" (en) or "\u306a\u305c" (ja), end with "?", keep <= 80 chars, and make it specific to the line and its surrounding context.',
    'Style for suggestedComment: a concise explanatory comment to insert above the line (one sentence). No code fences, no markdown, no leading comment token.',
    langInstr
  ].join('\n');
}

function buildUserPrompt(annotatedDiff: string, lang: 'en' | 'ja'): string {
  return [
    'Given an annotated unified git diff for a single file:',
    '- Each added line is prefixed with its absolute NEW FILE line number in square brackets, e.g. "[42] +const x = 1".',
    'Task: Identify added lines that feel contextually surprising and would prompt a "why" explanation. Only consider added lines (+).',
    (lang === 'ja' ? 'Output language: Japanese.' : 'Output language: English.'),
    'Strict format: Return exactly one JSON object { "items": [ { "line": <0-based absolute new-file line>, "message": <Why-question>, "suggestedComment": <best explanatory comment to insert>, "anchor": <exact code text> } ] }. No extra keys/markdown/code fences. If none, return { "items": [] }.',
    '',
    '- Derive "line" from the bracketed line numbers (absolute NEW FILE lines). Convert to 0-based. Only output JSON.',
    '',
    annotatedDiff
  ].join('\n');
}

function annotateDiffWithNewLines(diff: string): string {
  const hunks = parseUnifiedDiff(diff);
  const out: string[] = [];
  for (const h of hunks) {
    let newLine = h.newStart;
    for (const l of h.lines) {
      const type = l[0];
      const text = l.slice(1);
      if (type === ' ') {
        newLine++;
      } else if (type === '+') {
        out.push(`[${newLine}] ${type}${text}`);
        newLine++;
      } else if (type === '-') {
        // ignore deletions
      }
    }
  }
  return out.join('\n');
}

async function callOpenAIWithMessages(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
  const fetchFn = (globalThis as any).fetch as (input: any, init?: any) => Promise<any>;
  if (!fetchFn) throw new Error('fetch is not available in this environment');
  const body = {
    model: model || 'gpt-4o-mini',
    messages,
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: 'json_object' }
  } as any;
  const resp = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content ?? '[]';
}

async function callClaudeWithMessages(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
  const fetchFn = (globalThis as any).fetch as (input: any, init?: any) => Promise<any>;
  if (!fetchFn) throw new Error('fetch is not available in this environment');
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? 'You output only JSON, nothing else.';
  const msgList = messages.filter(m => m.role !== 'system');
  const body = {
    model: model || 'claude-3-5-haiku-latest',
    max_tokens: 1500,
    temperature: 0.2,
    system: systemMsg,
    messages: msgList
  } as any;
  const resp = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`Claude HTTP ${resp.status}`);
  const data = await resp.json() as any;
  return data?.content?.[0]?.text ?? '[]';
}

function parseLLMResponse(uri: vscode.Uri, completion: string, lang: 'en' | 'ja'): Suggestion[] {
  // Try strict parse first
  let arr: any = tryParseJSON(completion);
  if (arr && Array.isArray(arr.items)) arr = arr.items;
  if (!Array.isArray(arr)) {
    // Fallback: extract JSON objects and parse individually
    const objs: any[] = [];
    const re = /\{[\s\S]*?\}/g;
    const matches = completion.match(re) || [];
    for (const m of matches) {
      const o = tryParseJSON(m);
      if (o && typeof o === 'object' && ('line' in o || 'suggestedComment' in o)) {
        objs.push(o);
      }
    }
    arr = objs;
  }
  if (!Array.isArray(arr)) return [];
  const out: Suggestion[] = [];
  for (const it of arr) {
    const line = typeof it.line === 'number' ? it.line : 0;
    const message = String(it.message ?? (lang === 'ja' ? '\\u306a\\u305c\\uff1f' : 'Why?'));
    const suggestedComment = String(it.suggestedComment ?? (lang === 'ja' ? '\u3053\u306e\u610f\u56f3\u30fb\u524d\u63d0\u30fb\u5236\u7d04\u3092\u7c21\u6d01\u306b\u8aac\u660e\u3057\u3066\u304f\u3060\u3055\u3044\u3002' : 'Explain the intent and constraints.'));
    const anchor = typeof it.anchor === 'string' ? it.anchor : undefined;
    out.push({
      id: sha1(`${uri.toString()}:${line}:${message}:${suggestedComment}:llm`),
      uri,
      line,
      message,
      suggestedComment,
      anchor,
      source: 'llm',
      createdAt: Date.now()
    });
  }
  return out;
}

function tryParseJSON(text: string): any | undefined {
  try {
    return JSON.parse(text);
  } catch {
    // Try to find top-level array
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
    return undefined;
  }
}
