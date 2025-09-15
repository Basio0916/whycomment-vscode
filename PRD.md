# WhyComment - VS Code Extension PRD

## 概要

コード変更時に「なぜ？」と疑問が生まれる箇所を検出し、適切な説明コメントの追加を提案する拡張機能。

## 主要機能

- 自動分析: 保存後に Git 差分を取得し、LLM で変更行を分析
- 結果表示: サイドパネルに行番号・質問・推奨コメントを一覧表示
- 挿入動作: 対象行の直上に、インデントを保ってコメントを挿入
- 選択範囲分析: エディタで選択した範囲のみを右クリックから分析

## コマンド

- WhyComment: Analyze Selection
- WhyComment: Toggle Auto Analyze
- WhyComment: Clear All Suggestions

## 設定

```
{
  "whycomment.apiKey": "",
  "whycomment.apiProvider": "claude",
  "whycomment.claudeModel": "claude-3-5-haiku-latest",
  "whycomment.openaiModel": "gpt-4o-mini",
  "whycomment.contextLines": 10,
  "whycomment.excludePatterns": ["**/*.test.*", "**/*.spec.*"],
  "whycomment.autoAnalyze": true,
  "whycomment.debounceMs": 3000
}
```

## 実装メモ

- LLM には選択/差分に最小限のユニファイド差分を渡す
- 結果はアンカーで現在行に再マッピングしてドリフトを軽減
- 行挿入/削除時は簡易的に行番号を追従

## 既知の制限

- 言語ごとの行コメントトークン検出は簡易対応
- ネットワーク/APIキーが必要（オフライン時はLLM機能なし）
