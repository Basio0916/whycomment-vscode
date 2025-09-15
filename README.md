# WhyComment

AI-assisted “why?” comments for your code changes. WhyComment scans diffs and highlights lines that deserve a short rationale, then helps you insert concise comments where they matter most.

## Features

- Auto-analyzes saved files (debounced) using a compact Git diff.
- “Analyze Selection” to focus on a specific range.
- Side panel to review suggestions and jump to lines.
- One-click “Apply” to insert a comment above the line, preserving indentation.
- “Suggest Comment Variants” to pick from 3 AI-generated one-liners.
- Stable line mapping and duplicate suppression for reliable results.

## Quick Start

1) Install the extension from the Marketplace.
2) Set an LLM API key in Settings (WhyComment: Api Key). Supports Claude (default) and OpenAI.
3) Save a file or right-click and run “WhyComment: Analyze Selection”.
4) Open the WhyComment view in the Explorer, review items, and Apply or Ignore.

## Commands

- `WhyComment: Analyze Selection` – Analyze the current selection.
- `WhyComment: Suggest Comment Variants` – Generate 3 comment candidates for a line.
- `WhyComment: Toggle Auto Analyze` – Enable/disable auto analysis on save.
- `WhyComment: Clear All Suggestions` – Clear all current suggestions.

## Behavior

- Debounced auto-analysis (default 1s) on save for workspace files only.
- VS Code configs (e.g., `.code-workspace`, `.vscode/*`) are ignored by default.
- Respects exclude patterns for auto-analysis; manual “Analyze Selection” still runs.
- Inserted comments align to the target line’s indentation.
- Existing UI items prevent duplicate suggestions for the same line.

## Providers & Models

- Works with Claude (default) and OpenAI. Choose provider/model in Settings.
- The extension sends a compact, annotated diff to the provider to minimize payload.

## Privacy & Data

- No code is sent unless you configure an API key.
- Only compact diffs (and locale) are sent to generate suggestions.
- No data is stored by the extension beyond VS Code state for UX.

## Requirements

- VS Code 1.80+ and a Git-initialized workspace.
- An API key for your chosen LLM provider.

## Troubleshooting

- “No suggestions”: ensure the file has changes vs HEAD, or try Analyze Selection.
- “Not analyzing this file”: check exclude patterns and that it’s inside the workspace.
- Progress indicator shows during LLM calls. Errors surface as VS Code notifications.
