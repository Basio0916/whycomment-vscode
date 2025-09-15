# WhyComment

Detect "why?" moments in code changes and suggest comments.

## Features

- Watches file saves (debounced) and computes Git diff vs HEAD.
- Analyzes changed lines using an LLM.
- Shows suggestions in a side panel with Apply/Ignore.
- Inserts a line comment above the target line, preserving indentation.

## Commands

- `WhyComment: Analyze Selection`  Run analysis for the selected range.
- `WhyComment: Toggle Auto Analyze`  Enable/disable auto analyze on save.
- `WhyComment: Clear All Suggestions`  Clear all current suggestions.

## Settings

```
{
  "whycomment.apiKey": "",
  "whycomment.apiProvider": "claude",
  "whycomment.claudeModel": "claude-3-5-haiku-latest",
  "whycomment.openaiModel": "gpt-4o-mini",
  "whycomment.contextLines": 10,
  "whycomment.excludePatterns": ["**/*.test.*", "**/*.spec.*"],
  "whycomment.autoAnalyze": true,
  "whycomment.debounceMs": 3000,
  "whycomment.outputLanguage": "auto"
}
```

## How it works

1. On save, the extension debounces and then runs `git diff` for the saved file.
2. The diff is analyzed by the configured LLM with a compact prompt.
3. Suggestions appear in the WhyComment view. Apply inserts a comment above the line.

## Requirements

- Git-initialized workspace, Node.js 18+, VS Code 1.80+
- OpenAI or Claude API key for LLM.

## Known limits

- Language comment token detection is best-effort; common languages supported.

## Development

```
npm install
npm run watch
# Press F5 in VS Code to launch Extension Host
```
