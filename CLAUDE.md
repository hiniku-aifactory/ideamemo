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

**必ず `docs/DESIGN_v2.md` を読んでから実装すること。**

- 白基調 (#FAFAFA) + モノクロ (#222/#888/#CCC)
- アクセントカラーはリンクのみ (#6B7B8D)
- フォント: system-ui (見出し・本文), JetBrains Mono (数字)
- 行間: 本文1.8、見出し1.4
- 原則P1「幾何学が語る」P2「白が呼吸する」P3「テキストは最小」P4「品のある静けさ」
- アニメーション: ease-out基本。bounce/spring/overshoot禁止
- テキストトーン: 命令しない。提案しない。事実を端的に

## モックモード

`NEXT_PUBLIC_MOCK_MODE=true` で全外部APIをモックに切替。
モックデータは `src/lib/mock/` 配下。API繋ぎ込み時はフラグをfalseにするだけ。

## ビルド順序（v2）

F2v2(ペルソナ選択) → F1v2(ペルソナ別接続) → F5(チャット) → F4(グラフ) → F6(管理) → F7(設定) → 横断

## タスク仕様書

`../product-factory/products/ideamemo/tasks/` に各フローの仕様書がある。
- `BUILD_ORDER_v2.md` — 最新ビルド順序
- `v1_product_spec.md` (docs/) — v1全体仕様書（設計判断の根拠）
- `f2_v2_persona.md` — F2v2: ペルソナ選択追加 ← **次に実行すべきタスク**
- `f1_v2_pipeline.md` — F1v2: ペルソナ別接続+Brave Search+FB
- `f5_chat.md` — F5: 深掘りチャット
- `f4_graph.md` — F4: グラフ+掛け合わせ
- `f6_management.md` — F6: メモ管理（最小版）
- `f7_settings.md` — F7: 設定（最小版）
- `cross_cutting.md` — 横断: プロファイル自動生成+上限+empty state

### 旧仕様（実行済み、参考用）
- `f1_record_connect.md` — 旧F1仕様
- `f1_revision_spec.md` — F1修正仕様（実行済み）
- `f2_auth_onboarding.md` — 旧F2仕様

## 運用ルール

1. APIのモデル名・エンドポイントは実装前に公式ドキュメントで確認
2. 全APIクライアントに環境変数存在チェック（undefinedで実行させない）
3. エラーハンドリング: 全API routeにtry-catch + ログ
4. コミットメッセージ: `F1: 録音画面UI実装` のようにフロー番号をプレフィックス。修正は `FIX: ナビバーSP対応` のようにFIXプレフィックス
5. PRは不要（mainに直push。レビューはShotaの実機確認で代替）
