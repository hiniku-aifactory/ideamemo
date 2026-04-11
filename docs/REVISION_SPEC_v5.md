# REVISION SPEC v5 — 拡張グラフ + 深掘りチャット改善

> **実行者:** Claude Code
> **前提:** `docs/DESIGN_v2.md`（カラー・フォント・トーン）、`CLAUDE.md`（運用ルール）
> **v4との関係:** v4のグラフ実装（force simulation + ズーム展開）を全面書き換え。チャットは既存を拡張。

---

## 全体方針

- 各§完了ごとに `FIX: §N [内容]` プレフィックスでコミット
- 各§完了時に `npx tsc --noEmit` でエラーなしを確認してから次へ
- MOCK_MODE=true のまま進める。外部API呼び出しはゼロ
- CSS custom properties（`var(--xxx)`）を使う。ハードコードした色コードは禁止
- アニメーション: `ease-out` 基本。bounce/spring/overshoot 禁止
- テキストトーン: 命令しない。提案しない。事実を端的に

---

## §0. グラフ画面 — カードリスト（エントリポイント）

**対象:** `src/app/graph/page.tsx`（大幅書き換え）

### 概要

v4のforce-directed graphを廃止。グラフタブを開くと最初にカードリスト画面を表示。カードタップで拡張グラフビューに遷移する。

### カードリストUI

```
┌─────────────────────────────────────┐
│ ideamemo                      ⚙     │  固定ヘッダー
│                                     │
│ 8 nodes · 12 links     connectivity▾│  11px mono, --text-muted / --text-secondary
│                                     │
│ ┌───────────────────────────────┐   │
│ │ (○合理)  合理性の罠           ●●●●●│  選択中（border太い）
│ │          5 connections · 3d ago│   │
│ └───────────────────────────────┘   │
│ ┌───────────────────────────────┐   │
│ │ (○一歩)  最初の一歩           ●●●  │
│ │          3 connections · 2d ago│   │
│ └───────────────────────────────┘   │
│ ┌───────────────────────────────┐   │
│ │ (○集団)  集団心理のロック      ●●●  │
│ │          3 connections · 1d ago│   │
│ └───────────────────────────────┘   │
│ ...                                 │
└─────────────────────────────────────┘
```

### カード構成要素

左側：円形ラベル（44px、border 0.5px --border-default、背景 --bg-secondary）
- 円内テキスト: summary先頭2-3文字、11px、--text-secondary

中央：
- 上段: summary全文、14px weight 500、--text-primary
- 下段: `{N} connections · {relative_time}`、11px mono、--text-muted

右側：接続数ドット
- 各ドット 6px circle、--border-default
- 接続数分だけ塗り（--text-secondary）、最大6ドット表示

### ソート

右上の「connectivity▾」タップでソート切替:
- `connectivity` — 接続数の多い順（デフォルト）
- `newest` — created_at降順
- `oldest` — created_at昇順

ドロップダウンやモーダルは不要。タップでトグル切替。現在のソートラベルを表示。

### カードタップ

タップで `/graph/explore?root={ideaId}` に遷移（§1の拡張グラフビュー）。

### エンプティステート（メモ0件）

v4と同じ同心円SVG + 「0 nodes」 + 偉人の言葉。

### 新規ファイル/ルーティング構成

```
src/app/graph/page.tsx          ← カードリスト（本§）
src/app/graph/explore/page.tsx  ← 拡張グラフビュー（§1）
```

commit: `FIX: §0 グラフ — カードリスト画面`

---

## §1. グラフ画面 — 拡張グラフビュー（Expanding Graph）

**対象:** `src/app/graph/explore/page.tsx`（新規）

### 概要

カードタップ or ホームのノードプレビュータップで遷移。選択したノードを中心にグラフが表示される。衛星ノードをタップすると**その先の接続が枝分かれして広がる**。画面はパン/ピンチで移動・拡大。

### 初期表示

1. URLパラメータ `root={ideaId}` のノードを画面中央に配置
2. そのノードに直接接続する idea ノードを放射状配置
3. そのノードに紐づく external_knowledge ノードも配置（破線円）

### ノード配置ロジック（D3 force不使用）

D3のforce simulationは使わない。幾何学的に計算する:

```typescript
// 中心ノード
const center = { x: viewportWidth / 2, y: viewportHeight / 2 };

// 直接接続ノードの配置
function layoutSatellites(
  centerPos: { x: number; y: number },
  count: number,
  distance: number,
  startAngle: number = -90
): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + (360 / count) * i;
    const rad = (angle * Math.PI) / 180;
    return {
      x: centerPos.x + distance * Math.cos(rad),
      y: centerPos.y + distance * Math.sin(rad),
    };
  });
}

// idea衛星: distance = 140px
// external_knowledge衛星: distance = 100px, 親ノード起点
```

### ノードサイズ

| 種類 | 半径 | ストローク | テキスト |
|------|------|-----------|---------|
| 中心（選択中） | 42px | 1.5px --node-selected | 13px weight500 --text-primary + 10px --text-muted |
| idea衛星 | 20-28px（接続数で変動） | 0.5px --border-default | 11px --text-secondary |
| external_knowledge | 14px | 0.5px破線 --border-default | 9px --text-muted |

idea衛星サイズ: `r = Math.min(28, 20 + connCount * 2)` （connCountはそのノードの総接続数）

### ノード内テキスト

- 中心ノード: summary全文（13px、自動改行なし、溢れたら末尾…）+ 「N connections」
- idea衛星: summary先頭5文字 + 「…」、11px
- external_knowledge: title先頭4文字 + 「…」、9px

### エッジスタイル

v4から維持:

| タイプ | 色 | 太さ | スタイル |
|--------|-----|------|---------| 
| external_knowledge | #CCCCCC | 0.5px | 破線 `4 2` |
| combination | #999999 | 1.5px | 実線 |
| manual | #CCCCCC | 0.5px | 実線 |
| chat_derived | #CCCCCC | 0.5px | 点線 `2 2` |

### タップ操作

```
衛星ノード（idea）をタップ:
  ↓
① そのノードが画面中央へ移動（パン+スケール、600ms ease-out）
② そのノードが「中心ノード」スタイルに変化（r=42、太枠）
③ 元の中心は衛星サイズに縮小（ただし表示は残る）
④ 新しい中心の接続先が放射状に追加展開（300ms fade-in）
⑤ 既に表示済みのノードは位置維持（再配置しない）
⑥ 下部に詳細パネル表示（§2）
```

**重要: 既存ノードは消さない。** タップするたびにグラフが**広がる**。新しい接続先だけ追加される。

### 衛星ノード追加時の衝突回避

新規ノードを配置する際、既存ノードと重なる場合:
- startAngleを30度ずらして再計算
- distanceを20px伸ばして再計算
- 3回試行して全て衝突する場合はdistance +40pxで配置

### external_knowledgeノードタップ

- タップ → 詳細パネルに外部知識の情報を表示（タイトル+サマリー+source URL）
- 中心ノードは切り替わらない
- 展開はしない

### パン / ピンチ

D3 zoom をSVG全体に適用:
- `d3.zoom().scaleExtent([0.3, 3])`
- ドラッグ = パン操作（ノード移動ではない）
- ピンチ = ズーム
- ノードへのタップはzoomイベントと競合しないようにする（§1-1参照）

### §1-1. タップ vs パン判定

```typescript
// ノードにpointerdown/pointerupイベントを直接バインド
// pointerdown位置とpointerup位置の距離が5px以下 → タップ
// 5px超 → パン操作（SVG zoomが処理）

let pointerStart = { x: 0, y: 0 };

nodeGroup.on("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

nodeGroup.on("pointerup", (event, d) => {
  const dist = Math.hypot(
    event.clientX - pointerStart.x,
    event.clientY - pointerStart.y
  );
  if (dist <= 5) {
    handleNodeTap(d);
  }
});
```

D3 dragはノードに適用しない。ノードはタップのみ。ドラッグはパンに統一。

### 戻るボタン

ヘッダー左に「←」。タップで `/graph`（カードリスト）に戻る。

### 状態管理

```typescript
interface ExploreState {
  centerNodeId: string;                        // 現在の中心ノード
  expandedNodeIds: Set<string>;                // 展開済みノードID
  nodePositions: Map<string, {x: number, y: number}>;  // 全ノード位置
  visibleNodes: GraphNode[];                   // 表示中ノード一覧
  visibleLinks: GraphLink[];                   // 表示中エッジ一覧
}

// 初期状態: root のみ expanded
// タップ時: expandedNodeIds に追加 → 新規ノード/エッジ計算 → visibleに追加
```

commit: `FIX: §1 拡張グラフビュー`

---

## §2. グラフ画面 — 詳細パネル + combine + link

**対象:** `src/app/graph/explore/page.tsx`（§1の続き）

### 詳細パネル（ノードタップ時）

画面下部に固定表示。`bottom: calc(80px + env(safe-area-inset-bottom))`。

```
┌─────────────────────────────────────┐
│ コスト変換の原理                     │  13px weight500, --text-primary
│ 社会的コストを物理的動作に変換して   │  11px, --text-muted, line-height 1.6
│ 行動ロックを解除                     │
│                                     │
│ detail →     deep dive     combine  │  11px
└─────────────────────────────────────┘
```

- `detail →` → `/memo/{id}`（--accent-link色）
- `deep dive` → `/chat?connection={connId}`（--text-muted）
  - 中心ノードと選択ノード間のconnectionがあればそのIDを使う
  - なければ非表示
- `combine` → combineモード開始（--text-muted）

### 外部知識パネル（外部知識ノードタップ時）

```
┌─────────────────────────────────────┐
│ アンドン紐 — トヨタ生産方式          │  13px weight500, --text-primary
│ 問題発見時に誰でもラインを止められる │  11px, --text-muted, line-height 1.6
│ 仕組みが心理的安全性を担保する       │
│                                     │
│ source ↗                            │  11px, --accent-link
└─────────────────────────────────────┘
```

### パネル非表示

背景タップ → パネル閉じる。

### Combineモード

```
combineボタンタップ
  ↓
パネルの文言が切り替わる:
  「組み合わせる相手をタップ」（キャンセル）
  ↑ キャンセル部分タップで解除
  ↓
表示中のideaノードにインジケータ（薄い点滅 border、800ms ease-in-out infinite）
  ↓
ideaノードタップ → combine API実行（既存 /api/combine を使う）
  ↓
結果パネル表示（v4と同じフォーマット）
```

**Combineモード解除（3通り）:**
1. パネル内「キャンセル」テキストタップ
2. 背景タップ
3. combineボタン再タップ（トグル）

### Linkモード

v4と同じ2ステップ選択を維持。ただしドラッグではなくタップ選択のみ。

```
パネル内「link」ボタン（§2では表示しない → v5.5で追加検討）
```

v5ではlink機能は一旦非表示。combineに集中する。理由: 拡張グラフで操作が複雑になりすぎるため。

commit: `FIX: §2 詳細パネル+combine`

---

## §3. 深掘りチャット — 接続コンテキストヘッダー

**対象:** `src/app/chat/page.tsx`（ChatView コンポーネント変更）

### 現状の問題

`contextSummary` が折りたたみテキスト1行で存在するのみ。何のテーマの深掘りか分かりにくい。

### 変更: 接続カード型固定ヘッダー

```
┌─────────────────────────────────────┐
│ (○) 合理性の罠  ←→  コスト変換の原理│  13px weight500, --text-primary
│ 個人の合理性が集団を壊す構造         │  11px, --text-muted
│                                  ▼  │  展開/折りたたみ
└─────────────────────────────────────┘
```

常時表示。スクロールしても固定（sticky）。

構成要素:
- 左: 元メモのsummary（丸アイコン+テキスト）
- 矢印: `←→`（--text-muted）
- 右: 接続先のsummary
- 下段: 接続理由（connection.reason の先頭50文字）
- ▼アイコン: タップで接続理由の全文展開/折りたたみ

### データ取得

```typescript
// ChatSession から connection_id を取得
const session = mockDb.chatSessions.get(sessionId);
const connection = session?.connection_id
  ? mockDb.connections.list().find(c => c.id === session.connection_id)
  : null;
const ideaFrom = connection
  ? mockDb.ideas.list().find(i => i.id === connection.idea_from_id)
  : null;
const ideaTo = connection?.idea_to_id
  ? mockDb.ideas.list().find(i => i.id === connection.idea_to_id)
  : null;
```

### 元メモタップ動作

丸アイコンまたはsummaryテキストタップ → `/memo/{idea_from_id}` に遷移。

commit: `FIX: §3 チャットコンテキストヘッダー`

---

## §4. 深掘りチャット — サジェスト質問ボタン

**対象:** `src/app/chat/page.tsx`（ChatView コンポーネント変更）

### 初期表示（チャット開始時）

メッセージ一覧の下、入力フィールドの上に3つのサジェストボタンを表示。

```
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ 🔍 この2つが繋がる根本の構造は？│   │  タップで質問送信
│ └───────────────────────────────┘   │
│ ┌───────────────────────────────┐   │
│ │ 🌍 同じ構造が別の分野にある？   │   │
│ └───────────────────────────────┘   │
│ ┌───────────────────────────────┐   │
│ │ 🔄 この逆のパターンは？        │   │
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

### ボタンスタイル

```
background: var(--bg-tertiary)
border: none
border-radius: 20px
padding: 10px 16px
font-size: 13px
color: var(--text-body)
text-align: left
width: 100%
```

アイコンはSVG（16x16）を使う。テキストのみでもOK（P3「テキストは最小」優先なら）。
ただしアイコンなしの場合、頭に短いラベルを付ける:

```
構造 → この2つが繋がる根本の仕組みは？
越境 → 同じ構造が全く違う分野にあるとしたら？
反転 → この逆のパターンは？
```

ラベル部分: 11px weight500 --text-secondary。質問部分: 13px --text-body。

### 質問テンプレート（汎用、接続内容に非依存）

```typescript
const SUGGEST_TEMPLATES = {
  initial: [
    {
      label: "構造",
      text: "この2つが繋がる根本の仕組みは何だろう？",
    },
    {
      label: "越境",
      text: "同じ構造が全く違う分野で起きてるとしたら、それは何？",
    },
    {
      label: "反転",
      text: "この関係性が逆転するケースってある？",
    },
  ],
  followUp: [
    {
      label: "深化",
      text: "今の話をもう一段掘り下げると、何が見える？",
    },
    {
      label: "応用",
      text: "これを自分の仕事や生活にどう活かせる？",
    },
  ],
} as const;
```

### タップ動作

1. ボタンタップ → テンプレートの`text`をそのままユーザーメッセージとして送信
2. 3つのサジェストボタンをフェードアウト（200ms）
3. 通常のチャットフローが開始

### フォローアップサジェスト

- assistantメッセージが3回に達したら `followUp` テンプレートから2つ表示
- 表示位置: メッセージ一覧の末尾（最新のassistantメッセージの直下）
- 表示済みなら再表示しない（セッション内1回のみ）
- タップ → 同様にユーザーメッセージとして送信 → ボタン消える

### 表示条件

- サジェストは接続起点のチャット(`connection_id`あり)の場合のみ表示
- セッション一覧から既存セッションを開いた場合は非表示（既に会話が進行中）
- 新規セッション or メッセージ0件のセッションでのみ `initial` を表示

commit: `FIX: §4 サジェスト質問ボタン`

---

## §5. ホーム画面 — ノードプレビュータップ先変更

**対象:** `src/app/page.tsx`

### 変更内容

現在: ノードプレビュータップ → `/memo/{id}`
変更: ノードプレビュータップ → `/graph/explore?root={id}`

ホームからそのノードの拡張グラフに直接飛べるようにする。

commit: `FIX: §5 ホーム→拡張グラフ遷移`

---

## §6. CLAUDE.md 更新

**対象:** `CLAUDE.md`

ビルド順序セクションに追記:

```markdown
## ビルド順序（v5）

REVISION_SPEC_v5.md で以下を実行:
- §0: グラフ — カードリスト画面
- §1: 拡張グラフビュー（expand-in-place）
- §2: 詳細パネル + combine
- §3: チャットコンテキストヘッダー
- §4: サジェスト質問ボタン
- §5: ホーム→拡張グラフ遷移
```

タスク仕様書セクションに追加:

```markdown
- `REVISION_SPEC_v5.md` (docs/) — 実行仕様書（v5: 拡張グラフ+チャット改善）
```

commit: `FIX: §6 CLAUDE.md更新`

---

## 品質チェックリスト（全§完了後）

### カードリスト（§0）
- [ ] グラフタブタップ → カードリストが表示される
- [ ] 接続数の多い順にソートされている
- [ ] ソートラベルタップで切替（connectivity/newest/oldest）
- [ ] 接続数ドットが正しく表示される
- [ ] カードタップ → `/graph/explore?root={id}` に遷移
- [ ] メモ0件 → エンプティステート

### 拡張グラフ（§1）
- [ ] rootノードが画面中央に表示される
- [ ] 直接接続のideaノードが放射状に配置される
- [ ] external_knowledgeノードが破線円で表示される
- [ ] 衛星ノードタップ → そのノードが中央に移動（600msアニメーション）
- [ ] タップしたノードの接続先が新たに追加される（既存ノードは消えない）
- [ ] グラフが探索するほど広がる
- [ ] パン操作（ドラッグ）で画面移動
- [ ] ピンチで拡大/縮小
- [ ] ←ボタンでカードリストに戻る
- [ ] ノードタップとパンが競合しない（5px閾値）

### 詳細パネル + combine（§2）
- [ ] ideaノードタップ → 下部にパネル表示
- [ ] external_knowledgeノードタップ → 外部知識パネル表示
- [ ] 背景タップ → パネル非表示
- [ ] `detail →` → /memo/{id} に遷移
- [ ] `deep dive` → /chat?connection={connId} に遷移（接続がある場合のみ表示）
- [ ] combineタップ → combineモード開始（パネル文言変化）
- [ ] combineモード中、ideaノードに点滅インジケータ
- [ ] 2つ目タップ → combine API実行 → 結果パネル
- [ ] combineキャンセル: パネル内テキスト / 背景タップ / ボタン再タップ（3通り全て動作）

### チャットコンテキストヘッダー（§3）
- [ ] 接続起点のチャット → 上部に接続カード表示
- [ ] 元メモと接続先のsummaryが表示される
- [ ] 接続理由が1行表示、▼で全文展開
- [ ] スクロールしてもヘッダー固定（sticky）
- [ ] 元メモタップ → /memo/{id} に遷移

### サジェスト質問（§4）
- [ ] 新規チャット開始時 → 3つのサジェストボタン表示
- [ ] ボタンタップ → テキストが送信される
- [ ] 送信後ボタンがフェードアウト
- [ ] assistant 3往復後 → フォローアップ2つ表示
- [ ] フォローアップタップ → 送信 → 消える
- [ ] 既存セッション復元時はサジェスト非表示

### ホーム（§5）
- [ ] ノードプレビュータップ → /graph/explore?root={id} に遷移

---

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `src/app/graph/page.tsx` | **大幅書き換え**（カードリスト化） |
| `src/app/graph/explore/page.tsx` | **新規**（拡張グラフビュー） |
| `src/app/chat/page.tsx` | 変更（ヘッダー+サジェスト） |
| `src/app/page.tsx` | 変更（遷移先変更） |
| `CLAUDE.md` | 変更 |
