# ideamemo プロジェクト全体の流れ

## プロダクト概要

声でアイデアを録音 → AIが構造化+外部知識と接続 → 気づきが繋がって育つPWAアプリ。
ファクトリーの2つ目のプロダクト（1つ目はArtTalk/ArtLens）。

---

## Phase 1: 企画・設計（Session 26-27）

### Gate1: アイデア評価
- コンセプト: 「日々の気づきを声で貯める。AIが勝手に外の知識と繋げる」
- ヤング「アイデアのつくり方」5ステップの自動化がコア理論
- Gate1 GO

### Gate2: プロダクト設計（Session 26-27）
- 感情遷移マップv3 策定（❶好奇心 → ❷素材投入 → ❸最初のひらめき → … → ❽活用）
- ヤング第3ステップ「放置（Incubation）」の自動化 = Incubation delay通知
- 5タイプ接続エンジン設計 + bisociation理論
- ペルソナ3人 + エッジケース12件
- トーン&ボイス: 断定調、問いかけなし、外部知識リッチ
- Gate2 GO（2026-04-09）

### v1スコープ確定（Session 27）
- **入れる:** F1録音+接続 / F2認証+オンボ / F4グラフ+掛け合わせ / F5深掘りチャット / F6管理 / F7設定
- **入れない:** F3通知 / 自動メモ生成 / Slack連携 / 課金 / incubation delay
- ペルソナ選択方式（「何者か」でキャリブレーション、出口のフレーミングだけ変える）
- 無料、メモ上限20件

---

## Phase 2: 基盤構築（Session 28-29）

### インフラ（Session 28-29）
- `hiniku-aifactory/ideamemo` リポ作成
- Vercel連携（初回ビルドは空で失敗、正常）
- CLAUDE.md + .env.example + MOCK_MODE設計

### Gate3開始: フロー分解（Session 28）
- Gate3はフロー別構築（ArtTalkのカテゴリ別とは変更）
- 7フロー定義: F1録音→接続 / F2認証 / F4グラフ / F5チャット / F6管理 / F7設定 / 横断
- F1仕様書 + F2仕様書 + BUILD_ORDER 作成
- 技術スタック確定: Next.js 15 + Supabase + Claude API + Gemini API

### 初期実装（Session 29、Claude Codeで実行）
- F2認証 → F1録音+接続の順でモックモード実装
- f1_revision_spec.md で §0-§8 実行完了（safe-area、ホーム、ナビバー、録音フロー、波形バー、接続カード、メモ詳細）

---

## Phase 3: v1仕様固め + UI大幅改修（Session 30）

### v1設計の深掘り（Session 30）
- モード再設計: 思考レンズ方式 → ペルソナ選択方式に落ち着く
- 「知識の提示」から「アイデアの生成」に出力方針転換（「へー面白い」→「あ、これやりたい」）
- F3-F7の詳細仕様書作成（f4_graph / f5_chat / f6_management / f7_settings / cross_cutting）
- フィードバック反映システム + プロファイル自動生成の設計

### デザインシステム確立
- DESIGN_v2.md: 白基調(#FAFAFA) + モノクロ + JetBrains Mono
- 4原則: 「幾何学が語る」「白が呼吸する」「テキストは最小」「品のある静けさ」

### Claude Codeで全フロー仕様書実行
- BUILD_ORDER_v2.md に基づき F1v2→F4→F5→F6→F7→横断 の順
- F1v2パイプライン（ペルソナ別接続+Brave Search+FB）
- 仕様書群を全て push

---

## Phase 4: Shotaの実機FB → 反復改修（Session 30-31）

### v2: Shota実機フィードバック反映（Session 30）
- 波形中央化 / ヘッダー固定 / フォルダ削除 / 3タブ化
- ホーム: 偉人の言葉 + ノードプレビュー
- REVISION_SPEC_v4.md 策定+実行

### v3: グラフ+ホーム設計（Session 30）
- SPEC_GRAPH_HOME_v3.md: グラフ詳細+深掘り転記+ホーム再設計の設計根拠
- 静止配置+位置記憶+ドラッグ+ズーム展開+紐付けで確定
- ノードサイズ7-8文字、60-70px
- 深掘りチャットの気づき → ノード転記のデータモデル設計

### v4: 実行（Session 30-31、Claude Code）
- REVISION_SPEC_v4.md: §0-§8 実行完了
- グラフ刷新 / ホーム再設計 / チャット転記 / FB反映

---

## Phase 5: 拡張グラフ+チャット改善（Session 31）

### v5 設計（Session 31）
- graph_label（抽象ラベル）+ tags（配列、多属性対応）追加
- 録音結果画面刷新: 遷移なし、同一画面で具体→抽象→名言→3カードフェードイン
- チャット改善: コンテキストヘッダー + サジェスト質問ボタン
- REVISION_SPEC_v5.md 策定
- **Level 1→2→3の3段階方式で設計**

### v5 実行（Claude Code）
- §0-§11 全コミット完了（66afd37まで）
- タグクラスタ → ノード展開 → 拡張グラフ + 詳細パネル + combine + パンくず
- チャットコンテキストヘッダー + サジェスト質問ボタン
- メモ詳細に全接続カード深掘りボタン
- 録音結果画面刷新
- ホームのタグクラスタ切り取りプレビュー

### v5 → フラットマップへの方針転換（Session 31後半）
- D3 force simulation 廃止
- Level 1→2→3 の3段階方式 廃止
- **フラットマップ方式を採用:** 1枚のキャンバスに全部見える + ズームで密度制御
- ノードは動かさない。タップで接続線が引かれるだけ
- パンくず廃止
- → v5.1 spec の策定が必要に（v5の§1-§5が丸ごと無駄に）

---

## Phase 6: フラットマップ化（Session 32 = 現在）

### v5.1 設計+指示書（Session 32）
- REVISION_SPEC_v5_1.md: グラフ画面のフラットマップ化仕様
  - LOD（Level of Detail）ズーム制御: k<0.5 / 0.5≤k<1.0 / k≥1.0 の3段階
  - フォーカス: ノードタップ → 接続線+外部知識一時展開+詳細パネル
  - 外部知識はフォーカス時のみ展開、解除で完全消滅
  - パンくず削除、resetボタンでfit-all
- TASK_v5_1.md: Claude Code実行指示書
- GATE3振り返り実施（RETRO_GATE3_SESSION32.md）

### 残タスク
- Claude Code で v5.1 実行
- プロンプト設計（意外性のある外部知識生成）— 未着手
- Stripe / 課金設計 — 未着手
- GATE4-5 設計 — 未着手
- E2Eテスト導入 — 未着手

---

## タイムライン概要

```
Session 26-27  Gate1→Gate2 GO、v1スコープ確定
Session 28-29  インフラ構築、F1/F2仕様書、初期実装
Session 30     v1仕様固め、デザインシステム、全フロー仕様書、v2-v4改修
Session 31     v5設計+実装、フラットマップ方針転換
Session 32     v5.1 spec + 指示書、GATE3振り返り ← 今ここ
```

## 累積成果物（ideamemoリポ）

| ファイル | 状態 |
|---------|------|
| CLAUDE.md | ✅ 最新 |
| docs/DESIGN_v2.md | ✅ 有効 |
| docs/REVISION_SPEC_v4.md | ⚠️ 実行済み（参考用） |
| docs/REVISION_SPEC_v5.md | ⚠️ §6-§11のみ有効。§1-§5はv5.1で置換 |
| docs/REVISION_SPEC_v5_1.md | 🎯 **次に実行するspec** |
| docs/TASK_v5_1.md | 🎯 Claude Code指示書 |
| docs/FEEDBACK_v1.md | ✅ 議論記録 |
| docs/SPEC_GRAPH_HOME_v3.md | ⚠️ 設計根拠（参考用、一部v5.1で上書き） |
| docs/RETRO_GATE3_SESSION32.md | ✅ 振り返り |

## 累積成果物（product-factoryリポ）

| ファイル | 状態 |
|---------|------|
| products/ideamemo/docs/gate1_report.md | ✅ 参考 |
| products/ideamemo/docs/gate2_report.md | ✅ 参考 |
| products/ideamemo/docs/v1_product_spec.md | ⚠️ 初期版、一部古い |
| products/ideamemo/tasks/f1_v2_pipeline.md | ✅ 有効 |
| products/ideamemo/tasks/f4_graph.md | ⚠️ v5.1で設計変更あり |
| products/ideamemo/tasks/f5_chat.md | ✅ 有効 |
| products/ideamemo/tasks/f6_management.md | ✅ 有効 |
| products/ideamemo/tasks/f7_settings.md | ✅ 有効 |
| products/ideamemo/tasks/cross_cutting.md | ✅ 有効 |
| products/ideamemo/tasks/BUILD_ORDER_v2.md | ⚠️ v5.1反映が必要 |
