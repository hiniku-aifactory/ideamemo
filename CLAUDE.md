# CLAUDE.md — ideamemo

## プロジェクト概要

声でアイデアを録音→AI構造化→意外な繋がりを発見するPWAアプリ。
ヤング「アイデアのつくり方」5ステップの自動化。

## 技術スタック

- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS + CSS custom properties（デザイントークン優先）
- Supabase (Auth + PostgreSQL + Storage + pgvector)
- Vercel デプロイ
- Claude API (Opus: 接続発見 / Sonnet: 構造化)
- Gemini API (文字起こし)
- OpenAI API (Embedding)

## デザイン準拠

**必ず `../product-factory/products/ideamemo/docs/DESIGN.md` を読んでから実装すること。**

- ダーク基調 (#0A0A0A) + アンバーアクセント (#D4896A)
- 時間グラデーション: accent色が時間帯で変化
- フォント: Noto Serif JP (見出し), Noto Sans JP (本文), JetBrains Mono (数字), EB Garamond (英語引用)
- 行間: 本文1.7、見出し1.4
- 原則P1「余白が語る」P2「暗闇の中の一点」P3「静かに動く」
- アニメーション: ease-out基本。bounceやspring禁止

## モックモード

`NEXT_PUBLIC_MOCK_MODE=true` で全外部APIをモックに切替。
モックデータは `src/lib/mock/` 配下。API繋ぎ込み時はフラグをfalseにするだけ。

## ビルド順序

F2(認証) → F1(録音→繋がり) → F3(通知) → F4(グラフ) → F5(チャット) → F6(メモ管理) → F7(設定)

## タスク仕様書

`../product-factory/products/ideamemo/tasks/` に各フローの仕様書がある。
- `BUILD_ORDER.md` — ビルド順序と手動作業一覧
- `f1_record_connect.md` — F1仕様書（§11にモックモード仕様）
- `f1_revision_spec.md` — F1修正仕様書（v1レビューFB対応。**次に実行すべきタスク**）
- `f2_auth_onboarding.md` — F2仕様書

## 運用ルール

1. APIのモデル名・エンドポイントは実装前に公式ドキュメントで確認
2. 全APIクライアントに環境変数存在チェック（undefinedで実行させない）
3. エラーハンドリング: 全API routeにtry-catch + ログ
4. コミットメッセージ: `F1: 録音画面UI実装` のようにフロー番号をプレフィックス。修正は `FIX: ナビバーSP対応` のようにFIXプレフィックス
5. PRは不要（mainに直push。レビューはShotaの実機確認で代替）
