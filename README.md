# WhyComment

Detect "why?" moments in code changes and suggest comments.

## Features

- Watches file saves (debounced) and computes Git diff vs HEAD.
- Analyzes changed lines using heuristics and optionally an LLM.
- Shows suggestions in a side panel with Apply/Ignore.
- Inserts a line comment above the target line.

## Commands

- `WhyComment: Analyze Current File` — Run analysis for the active file.
- `WhyComment: Toggle Auto Analyze` — Enable/disable auto analyze on save.

## Settings

```json
{
  "whycomment.enabled": true,
  "whycomment.apiKey": "",
  "whycomment.apiProvider": "openai",
  "whycomment.openaiModel": "gpt-4o-mini",
  "whycomment.claudeModel": "claude-3-5-sonnet-latest",
  "whycomment.contextLines": 10,
  "whycomment.excludePatterns": ["**/*.test.*", "**/*.spec.*"],
  "whycomment.autoAnalyze": true,
  "whycomment.dailyLimit": 100,
  "whycomment.debounceMs": 3000,
  "whycomment.maxChangedLines": 200
}
```

## How it works

1. On save, the extension debounces and then runs `git diff` for the saved file.
2. The diff is analyzed:
   - Heuristics (local, offline): magic numbers, complex conditions, regexes, empty catch, bitwise ops, etc.
   - LLM (optional): if `apiKey` is set, sends a compact prompt with diff context.
3. Suggestions appear in the WhyComment view. Apply inserts a comment above the line.

## Requirements

- Git-initialized workspace, Node.js 18+, VS Code 1.80+
- Optional: OpenAI or Claude API key for LLM.

## Known limits

- Large diffs (200+ changed lines) are skipped for performance.
- Language comment token detection is best-effort; common languages supported.

## Development

```bash
npm install
npm run watch
# Press F5 in VS Code to launch Extension Host
```
