# DESIGN v2 — ideamemo

## コンセプト

声で気づきを貯める。AIが外の知識と紐づける。ノードで気づき同士をぶつけてアイデアが生まれる。

## デザイン原則

1. **幾何学が語る** — 円・線・点で情報構造を視覚化する。装飾のためのグラフィックは存在しない
2. **白が呼吸する** — 余白は空白ではなく設計要素。要素間の距離が情報の重みを伝える
3. **テキストは最小** — UIラベルよりアイコン。説明より構造。ユーザーの思考を邪魔しない
4. **品のある静けさ** — 命令しない。提案しない。事実を端的に提示する

## カラーシステム

```
--bg-primary:    #FAFAFA    // 全画面ベース
--bg-secondary:  #FFFFFF    // カード・浮き要素
--bg-tertiary:   #F5F5F3    // セクション区切り・サーフェス

--text-primary:  #222222    // 見出し・強調
--text-body:     #555555    // 本文
--text-secondary:#888888    // 補足
--text-muted:    #BBBBBB    // タイムスタンプ・極小ラベル
--text-hint:     #CCCCCC    // プレースホルダー・凡例

--border-default:#E0E0E0    // 区切り線・ノードストローク
--border-light:  #EBEBEB    // セパレーター
--border-strong: #999999    // 選択状態のノード

--accent-link:   #6B7B8D    // リンクテキストのみ使用
--node-selected: #222222    // 選択ノードのストローク
```

アクセントカラーはリンクのみ。UI要素に色は使わない。

## タイポグラフィ

```
--font-primary:  system-ui, -apple-system, sans-serif
--font-mono:     'JetBrains Mono', ui-monospace, monospace

見出し:    15px / weight 500 / tracking -0.01em / color text-primary
本文:      13px / weight 400 / line-height 1.8 / color text-body
補足:      11px / weight 400 / color text-secondary
極小ラベル: 10px / weight 400 / color text-muted
数字:      font-mono / 11px / color text-muted
```

日本語Webフォントは使わない。system-uiで十分。読み込みゼロ。

## アイコン体系

テキストラベルではなくSVGアイコンで操作を伝える。Lucideベースだが、線幅とサイズを統一。

```
ナビゲーション: 20x20 / stroke-width 1 / color #CCC (非選択) #222 (選択)
インライン操作: 14x14 / stroke-width 0.7 / color #CCC
幾何学モチーフ: カスタムSVG / stroke-width 0.5-0.7

タブバーアイコン:
  ホーム   = 4つの正方形グリッド (rect x4)
  録音     = 円の中に塗り円 (circle + filled circle)
  グラフ   = 3つの円 + 接続線 (circle x3 + line x2)
```

## スペーシング

```
ページ横余白:     20px
セクション間:     16px
カード内パディング: 14px 16px
要素間最小:       6px
タブバー上区切り:  0.5px solid border-light
```

## コンポーネント

### メモカード（ホーム一覧）
```
[メモタイトル（summary）]        [●●● ドット = 外部知識数]
[相対時間]
---separator---
```
テキストのみ。タップでメモ詳細へ。

### 外部知識カード（録音結果・メモ詳細）
```
○ [latent_question / italic / text-secondary]

│ ● [見出し / text-body / weight 500]
│   [事実の説明 / text-body / 2-3文]
│   [ソースリンク ↗ / accent-link / 10px]  [♡ bookmark]
│
│ ● [見出し]
│   [事実の説明]
│   [ソースリンク ↗]  [♡ bookmark]
│
│ ● [見出し]
│   [事実の説明]
│   [ソースリンク ↗]  [♡ bookmark]
```
タイムライン構造（縦線 + ノード点）。

### グラフノード
```
通常:   circle / fill #FFF / stroke #DDD 0.5px / テキスト text-secondary
選択:   circle / fill #FFF / stroke #222 1.5px / テキスト text-primary
関連:   circle / fill #FFF / stroke #999 1px / 外周に点線リング
非関連: opacity 0.3
外部知識: 小さめcircle / stroke #CCC dashed / テキスト text-muted
掛け合わせ線: stroke #222 1px dashed / opacity 0.4
既存接続線: stroke #E0E0E0 0.5px solid
```

### 掛け合わせ結果カード
```
[● ノードA名] x [● ノードB名]
[掛け合わせテキスト / text-body / 品のある説明調]
[♡ bookmark]  [deep dive →]
```
グラフ下部にスライドイン。ボトムシート不使用。

### ブックマーク（旧フィードバック）
```
未保存: ♡ アウトライン / stroke #CCC / 14x14
保存済: ♡ 塗り / fill #999 / 14x14
```
ハートアイコン1つ。タップでトグル。

### キーワードタグ
```
font-size 10px / color text-muted / padding 2px 7px
border 0.5px solid border-default / border-radius 3px
```

## テキストトーン

### 原則
- 命令しない（「〜しろ」「〜してみて」禁止）
- 提案しない（「〜かもしれません」禁止）
- 事実を述べる。構造を指摘する。端的に
- 敬体でも常体でもない。体言止め・名詞句を多用

### 例
```
旧: 「次の会議で最初に自分の失敗談を共有してみて」
新: 「沈黙1分あたりのコストを時給と人数から算出する仕組み。全社導入後、会議時間が33%減少した。」

旧: 「つながりを探索中...」
新: 「探索中」

旧: 「まだメモがありません。最初のメモを録音するとここにあなたの思考の地図が表示されます」
新: （幾何学モチーフのアイコンのみ。テキストなし、もしくは極小で「0 nodes」）

旧: 「聞き取れた内容」
新: （ラベルなし。文字起こしテキストがそのまま表示される）

旧: 「ホームに戻る」ボタン
新: ← アイコンのみ
```

### 掛け合わせ結果のトーン
```
良い: 「会議の沈黙と散歩の気づきには共通構造がある。どちらも観察者の態度が変数。沈黙を観察対象として扱うと、同じ会議が異なる情報源になる。」
悪い: 「会議で沈黙が起きたら、散歩みたいに観察してみましょう！新しい発見があるかもしれません。」
```

## アニメーション

```
ページ遷移:      opacity 0→1 / 200ms ease-out
カード出現:       translateY(8px)→0 + opacity / 300ms ease-out
ノード微動:       sin/cos で ±0.3px / 連続
ノード選択:       stroke-width 0.5→1.5 / 150ms
非関連フェード:    opacity 1→0.3 / 200ms
掛け合わせ線描画: stroke-dashoffset アニメーション / 400ms
結果スライドイン:  translateY(20px)→0 / 300ms ease-out
ブックマークタップ: scale 1→1.15→1 / 200ms
```

bounce、spring、overshoot禁止。ease-out基本。

## レスポンシブ

モバイルファースト。横幅 320px〜428px を前提。
グラフは画面いっぱい（padding なし）。ピンチズーム対応。
カードは横余白20px固定。
