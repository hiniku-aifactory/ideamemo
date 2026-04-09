# REVISION SPEC v2 — ideamemo デザイン刷新 + 機能変更

## 概要

ダーク+アンバーのデザインを白+モノクロ+幾何学に全面刷新。
外部知識カードを「アイデア生成」から「知識紐づけ」に変更。
グラフ画面に外部知識展開 + 簡易紐付けを追加。

## 前提

- DESIGN_v2.md を docs/ に配置済みであること
- USER_FLOWS_v2.md を docs/ に配置済みであること
- CLAUDE.md のデザイン準拠セクションを更新済みであること

## 実行順序

§0 → §1 → §2 → §3 → §4 → §5 → §6 → §7 → §8
各セクション完了ごとに `FIX:` プレフィックスでcommit。

---

## §0: ドキュメント配置 + CLAUDE.md更新

1. `docs/DESIGN_v2.md` を配置
2. `docs/USER_FLOWS_v2.md` を配置
3. `CLAUDE.md` のデザイン準拠セクションを以下に書き換え:

```
## デザイン準拠

**必ず `docs/DESIGN_v2.md` を読んでから実装すること。**

- 白基調 (#FAFAFA) + モノクロ (#222/#888/#CCC)
- アクセントカラーはリンクのみ (#6B7B8D)
- フォント: system-ui (見出し・本文), JetBrains Mono (数字)
- 行間: 本文1.8、見出し1.4
- 原則P1「幾何学が語る」P2「白が呼吸する」P3「テキストは最小」P4「品のある静けさ」
- アニメーション: ease-out基本。bounce/spring/overshoot禁止
- テキストトーン: 命令しない。提案しない。事実を端的に
```

commit: `FIX: §0 DESIGN_v2 + USER_FLOWS_v2 配置`

---

## §1: CSS変数 + グローバルスタイル刷新

**対象:** `src/app/layout.tsx` + `globals.css`（存在すれば）

1. 全CSS custom propertiesを DESIGN_v2.md のカラーシステムに置換:

```css
:root {
  --bg-primary: #FAFAFA;
  --bg-secondary: #FFFFFF;
  --bg-tertiary: #F5F5F3;
  
  --text-primary: #222222;
  --text-body: #555555;
  --text-secondary: #888888;
  --text-muted: #BBBBBB;
  --text-hint: #CCCCCC;
  
  --border: #E0E0E0;
  --border-light: #EBEBEB;
  --border-strong: #999999;
  
  --accent: #6B7B8D;  /* リンクのみ */
  --accent-dim: #6B7B8D;
  
  --error: #C44;
  
  --font-primary: system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

2. ダーク系の旧変数 (`--bg-secondary: #141414` 等) を完全削除
3. `body` の `background` を `var(--bg-primary)` に
4. Noto Serif JP / Noto Sans JP / EB Garamond のフォント読み込みを削除
5. 時間グラデーション機能（`time-gradient-provider.tsx`）を無効化 or 削除

commit: `FIX: §1 CSS変数 + グローバルスタイル刷新`

---

## §2: タブバー刷新

**対象:** `src/components/tab-bar.tsx`

1. テキストラベル全削除。アイコンのみ
2. アイコンを DESIGN_v2.md のタブバーアイコンに置換（SVGインライン）:
   - ホーム: 4つの正方形
   - 録音: 円の中に塗り円（大きめ、40x40）
   - グラフ: 3つの円 + 接続線
3. 色: 非選択 #CCC / 選択 #222
4. 背景: transparent → `var(--bg-primary)`
5. 上部ボーダー: `0.5px solid var(--border-light)`

commit: `FIX: §2 タブバー刷新`

---

## §3: ホーム画面刷新

**対象:** `src/app/page.tsx`

1. ヘッダー:
   - ロゴを幾何学モチーフ（同心円+十字線のSVG）に変更
   - 中央にメモ数（mono, text-muted）: `4 memos`
   - 右にハンバーガーアイコン（3本線SVG）→ フォルダ/設定へのリンク
2. メモ一覧:
   - 各行: summary (text-primary, 13px) + 相対時間 (text-muted, 11px)
   - 右端: 外部知識数をドット表示（小circle, 5x5, #DDD or #CCC）
   - セパレーター: `0.5px solid var(--border-light)`
3. Noto Serif JP のfontFamily参照を全削除
4. エンプティステート: 幾何学モチーフSVG + `0 nodes`（mono, text-muted）

commit: `FIX: §3 ホーム画面刷新`

---

## §4: 録音画面 + 外部知識カード刷新

**対象:** `src/app/record/page.tsx` + `src/components/connection-card.tsx`

### 録音画面
1. ヘッダー: `←` SVGアイコンのみ（テキスト「新しいメモ」削除）
2. 録音ボタン: 円の中に塗り円。border #222。録音中は pulse リング（#E0E0E0）
3. 処理中テキスト: 「文字起こし中...」→「transcribing」、「構造化中...」→「structuring」、「繋がりを探索中...」→「searching」（英語小文字、mono、text-muted）
4. 文字起こし表示: ラベル「聞き取れた内容」削除。テキストのみ直接表示
5. keyword tags: アンバー背景 → border 0.5px #E0E0E0 + text-muted
6. abstract_principle のイタリック表示は残す（text-secondary）

### connection-card.tsx 全面書き換え → knowledge-card.tsx にリネーム
1. Props変更:
   - `personaLabel` 削除
   - `connectionType` 削除  
   - `sourceIdeaSummary` 削除
   - `actionSuggestion` 削除
   - 追加: `latentQuestion: string`
   - 追加: `bookmarked: boolean`
   - 追加: `onBookmark: () => void`
   - `externalTitle` → `title`
   - `externalSummary` → `description`
   - `externalUrl` → `sourceUrl`
2. レイアウト: タイムライン構造
   - 左に縦線（0.5px, border-default）
   - 各カードの左にノード点（5px circle, border #BBB）
   - 見出し（text-body, weight 500）
   - 事実説明（text-body, line-height 1.8, 2-3文）
   - ソースリンク（accent-link, 10px, ↗）
   - ♡ ブックマークアイコン（14x14, アウトライン/塗り切替）
3. 旧要素完全削除: 左右比較カード、TRY THIS、reason、参照セクション、フィードバックボタン

### latent_question の表示
- タイムラインの最上部に表示
- 幾何学モチーフ（同心円アイコン 20x20）+ italic + text-secondary
- connection-card群の共通見出しとして1つだけ表示

### フィードバック関連
- `src/components/feedback-button.tsx` 削除
- 代わりにknowledge-card内にブックマークアイコンを組み込み

commit: `FIX: §4 録音画面 + 外部知識カード刷新`

---

## §5: AI パイプライン変更

**対象:** `src/lib/ai/pipeline.ts` + `src/lib/ai/index.ts` + `src/lib/types.ts`

### types.ts
1. `Idea` に `latent_question: string` フィールド追加
2. `Connection` から以下を削除しない（DB互換性維持）が、UIでは使用しない:
   - `action_suggestion` → AIは生成しない。空文字列で保存
   - `source_idea_summary` → 空文字列で保存
3. `Connection` に `bookmarked: boolean` フィールド追加（default: false）

### ai/index.ts
1. `Structured` 型に `latent_question: string` 追加
2. mock データに `latent_question` フィールド追加

### ai/pipeline.ts — 接続合成プロンプト全面書き換え
1. 検索クエリ生成: 変更なし（searchAngle ベース）
2. 合成プロンプトを「アイデア生成」→「知識紐づけ」に変更:

```
system: あなたはリサーチャー。ユーザーの気づきに関連する外部知識を見つけて、事実を端的に紐づける。

出力ルール:
- 見出し: その外部知識を一言で表す名詞句（10-20字）
- 説明: 事実のみ。2-3文。数字・社名・年号を含める
- 命令しない。提案しない。事実を述べる
- 「〜かもしれません」「〜してみてください」禁止
- JSON形式のみ出力
```

3. JSON出力フォーマット変更:
```json
{
  "title": "見出し（名詞句、10-20字）",
  "description": "事実の説明（2-3文）",
  "source_url": "URL",
  "source_title": "引用元タイトル",
  "quality_score": 0.0-1.0
}
```

4. `action_suggestion` の生成を削除
5. `source_idea_summary` の生成を削除
6. `quality_score` < 0.6 の自動再生成は行わない（ユーザーの「more」で対応）

### 構造化プロンプトに latent_question 追加
```
構造化出力に以下フィールドを追加:
"latent_question": "この気づきの根にある問いを1文で（15-40字、「なぜ」「何が」「どういう」で始める）"
```

### personas.ts
- ペルソナ定義は残す（オンボーディングで選択、出力の文体に影響）
- 3角度の固定は行わない（ペルソナのsearchAngleを使って検索）
- 設定画面でペルソナ変更可能（既存のまま）

commit: `FIX: §5 AIパイプライン変更`

---

## §6: API Route変更

**対象:** `src/app/api/ideas/route.ts`

1. SSE の `connection` イベントのペイロード変更:
```typescript
send("connection", {
  id: conn.id,
  title: parsed.title,
  description: parsed.description,
  source_url: parsed.source_url,
  source_title: parsed.source_title,
  quality_score: parsed.quality_score,
  bookmarked: false,
});
```

2. `structured` イベントに `latent_question` を含める:
```typescript
send("structured", {
  summary: structured.summary,
  keywords: structured.keywords,
  abstract_principle: structured.abstract_principle,
  domain: structured.domain,
  latent_question: structured.latent_question,
});
```

3. Idea保存時に `latent_question` を含める

### ブックマークAPI追加
**新規:** `src/app/api/connections/[id]/bookmark/route.ts`
- POST: bookmarked を true/false にトグル
- レスポンス: `{ bookmarked: boolean }`

commit: `FIX: §6 API Route変更`

---

## §7: グラフ画面刷新

**対象:** `src/app/graph/page.tsx`

### ビジュアル
1. 背景: `var(--bg-primary)`
2. ノード: fill #FFF, stroke #DDD 0.5px, テキスト #888 9px
3. 接続線: stroke #E0E0E0 0.5px
4. ヘッダー: フィルタ（all/7d/30d）左寄せ + ノード/リンク数 右寄せ（mono, text-muted）
5. 凡例テキスト削除（アイコンとラベルのみだったが、それも不要）
6. Lucideアイコン参照を削除、SVGインラインに

### ノードタップ → ミニパネル
1. BottomSheet を廃止
2. グラフ下部（タブバーの上）に固定位置のミニパネルを表示:
   ```
   [summary / 1行]  [keyword tags]
   [→ 詳細リンク]  [⊕ 展開ボタン]
   ```
3. ミニパネルは translateY アニメーションで出現
4. 別ノードタップ or 空白タップで閉じる

### 外部知識展開（⊕）
1. ⊕ タップで、選択ノードに紐づく connections（external_knowledge タイプ）を取得
2. 各外部知識を小ノードとしてグラフに追加:
   - r: 12（メモノードより小さい）
   - stroke: dashed #CCC
   - テキスト: title の先頭4文字程度
   - メモノードとの間に dashed line
3. 外部知識ノードタップ → ミニパネルに title + description + ソースリンク + ♡
4. もう一度 ⊕ or 別メモノードタップで外部知識ノードを削除

### 掛け合わせ（2ノード選択）
1. ノードAタップ → 選択状態（stroke #222）
2. ノードBタップ → dashed line 描画（アニメーション）
3. /api/combine を呼び出し
4. 結果をミニパネル（拡大版）に表示:
   ```
   [● A名] x [● B名]
   [掛け合わせテキスト]
   [♡]  [deep dive →]
   ```
5. グラフ上の線が solid に変わる

### 簡易紐付け（長押しドラッグ）
1. ノード長押し(500ms) → ドラッグモード
2. 指の位置まで線が伸びる（thin, #CCC）
3. 別ノード上でドロップ → 即座に接続追加（API: 簡易接続保存）
4. 掛け合わせAIは走らない（手動リンクのみ）
5. 後からその線をタップすると「掛け合わせを実行」の選択肢

commit: `FIX: §7 グラフ画面刷新`

---

## §8: モックデータ + 横断更新

**対象:** `src/lib/mock/` 全ファイル

### mock/structured.ts
- 全エントリに `latent_question` フィールド追加

### mock/connections.ts
- `action_suggestion` を空文字列に
- `source_idea_summary` を空文字列に
- `title`（旧 `external_knowledge_title`）を名詞句の見出しに変更
- `description`（旧 `external_knowledge_summary`）を事実のみの端的な説明に変更
- `bookmarked: false` 追加
- テキストトーンを DESIGN_v2.md に準拠

### mock/db.ts
- bookmark トグルのメソッド追加

### 横断
- `src/app/memo/[id]/page.tsx`: 旧 ConnectionCard → 新 KnowledgeCard に
- `src/app/settings/page.tsx`: デザイントークン更新のみ
- `src/app/login/page.tsx`: デザイントークン更新のみ
- `src/app/onboarding/page.tsx`: デザイントークン更新 + テキストトーン変更
- `src/app/chat/page.tsx`: デザイントークン更新のみ
- `src/app/folders/` 系: デザイントークン更新のみ

### 削除ファイル
- `src/components/connection-card.tsx`（knowledge-card.tsx に置換済み）
- `src/components/feedback-button.tsx`
- `src/components/time-gradient-provider.tsx`（使用箇所からの参照も削除）

### package.json
- `@next/font` の Noto Serif JP / Noto Sans JP / EB Garamond 削除（system-ui に統一）

commit: `FIX: §8 モックデータ + 横断更新`

---

## 検証チェックリスト（全§完了後）

- [ ] `npm run build` エラーなし
- [ ] 全画面で旧カラー (#0A0A0A, #D4896A, #141414) の参照がゼロ
- [ ] 全画面で Noto Serif / Noto Sans / EB Garamond の参照がゼロ
- [ ] タブバーにテキストラベルなし
- [ ] 録音結果画面で「TRY THIS」「使える」「ピンとこない」のテキストなし
- [ ] 外部知識カードに ♡ ブックマークアイコンあり
- [ ] グラフ画面でノードタップ → ミニパネル表示（BottomSheetではない）
- [ ] グラフ画面で ⊕ → 外部知識が小ノードとして展開
- [ ] 掛け合わせ結果に action_suggestion 表示なし
- [ ] 全テキストで「〜してみて」「〜かもしれません」がゼロ
- [ ] latent_question が構造化データ + 録音結果UIに存在
