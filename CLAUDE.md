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

## ビルド順序（v4）

REVISION_SPEC_v4.md で以下を実行済み:
- §0-1: types拡張 + モックDB拡張
- §2-3: ホーム再設計 + quotes拡充
- §4-6: グラフ刷新（静止配置+位置記憶+ズーム展開+紐付け）
- §7: 深掘りチャット気づき抽出
- §8: FB反映（波形+ヘッダー+フォルダ削除+タブ3化）

## ビルド順序（v5）

REVISION_SPEC_v5.md で以下を実行:
- §0: types拡張（graph_label, tags）+ seed data
- §1-§4: グラフ全面書き換え（タグクラスタ→ノード展開→拡張グラフ+詳細パネル+combine）
- §5: パンくず+ガイドライン適用
- §6: チャットコンテキストヘッダー
- §7: サジェスト質問ボタン
- §8: メモ詳細 — 全接続カードに深掘りボタン
- §9: 録音結果画面刷新（具体→抽象可視化）
- §10: ホーム — タグクラスタプレビュー

## タスク仕様書

`../product-factory/products/ideamemo/tasks/` に各フローの仕様書がある。
- `BUILD_ORDER_v2.md` — 最新ビルド順序
- `v1_product_spec.md` (docs/) — v1全体仕様書（設計判断の根拠）
- `SPEC_GRAPH_HOME_v3.md` (docs/) — グラフ詳細+深掘り転記+ホーム再設計の設計根拠
- `REVISION_SPEC_v4.md` (docs/) — 実行仕様書（v4）
- `REVISION_SPEC_v5.md` (docs/) — 実行仕様書（v5: 拡張グラフ+チャット改善）
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
