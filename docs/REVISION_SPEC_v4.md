# REVISION SPEC v4 — グラフ刷新 + ホーム再設計 + 深掘り転記 + FB反映

> **実行者:** Claude Code (Sonnet 4.6)
> **前提:** `docs/SPEC_GRAPH_HOME_v3.md` が設計の根拠。判断に迷ったら参照せよ
> **必読:** `docs/DESIGN_v2.md`（カラー・フォント・トーン）、`CLAUDE.md`（運用ルール）

---

## 全体方針

- 各§完了ごとに `FIX: §N [内容]` プレフィックスでコミット
- 各§完了時に `npx tsc --noEmit` でエラーなしを確認してから次へ
- MOCK_MODE=true のまま進める。外部API呼び出しはゼロ
- CSS custom properties（`var(--xxx)`）を使う。ハードコードした色コードは禁止
- アニメーション: `ease-out` 基本。bounce/spring/overshoot 禁止
- テキストトーン: 命令しない。提案しない。事実を端的に

---

## §0. types.ts 拡張

**対象:** `src/lib/types.ts`

### 変更内容

```typescript
// ConnectionType に2つ追加
export type ConnectionType =
  | "external_knowledge"
  | "combination"
  | "manual"          // NEW: グラフ上の手動紐付け
  | "chat_derived";   // NEW: チャットから生まれたノードと元メモの接続

// IdeaSource 新規追加
export type IdeaSource = "voice" | "chat_insight";

// Idea に2フィールド追加
export interface Idea {
  // ...既存フィールドすべて維持...
  source: IdeaSource;               // NEW (default: 'voice')
  parent_session_id: string | null;  // NEW (chat_insight の場合のみ)
}

// ChatInsight 新規追加
export interface ChatInsight {
  id: string;
  session_id: string;
  summary: string;       // ノードラベル用 7-8文字
  full_text: string;     // 気づきの全文 2-3文
  keywords: string[];
  status: "suggested" | "accepted" | "dismissed";
  created_at: string;
}
```

### 注意
- 既存の Idea を参照している全ファイルで `source` と `parent_session_id` のデフォルト値が必要
- `src/lib/mock/seed.ts` の全 SEED_IDEAS に `source: "voice"`, `parent_session_id: null` を追加

commit: `FIX: §0 types拡張 — ConnectionType/IdeaSource/ChatInsight`

---

## §1. モックDB拡張

**対象:** `src/lib/mock/db.ts`, `src/lib/mock/seed.ts`

### 変更内容

1. `db.ts` に `ChatInsight` 型と CRUD を追加:

```typescript
export interface ChatInsight {
  id: string;
  session_id: string;
  summary: string;
  full_text: string;
  keywords: string[];
  status: "suggested" | "accepted" | "dismissed";
  created_at: string;
}

// chatInsights の配列管理 + list/insert/updateStatus メソッド追加
```

2. `seed.ts` の全 SEED_IDEAS に `source: "voice"`, `parent_session_id: null` を追加

3. connection を参照する箇所で `"manual"` と `"chat_derived"` の connection_type が処理可能であることを確認

commit: `FIX: §1 モックDB拡張 — ChatInsight CRUD + Idea source フィールド`

---

## §2. ホーム画面再設計

**対象:** `src/app/page.tsx` (大幅書き換え)
**新規:** `src/components/node-preview.tsx`, `src/lib/home-picker.ts`

### 現状の問題
- 現在のホームはメモの一覧表示。決定方針は「メモ一覧なし、ノードプレビュー+偉人の言葉」

### 新しいホーム画面構成

```
┌─────────────────────────────────────┐
│ ideamemo                     ⚙      │  固定ヘッダー
│                                     │
│         [NodePreview SVG]           │  タップで /memo/{id}
│         (メインノード120-140px       │
│          + 衛星ノード1-3個          │
│          + 接続線)                  │
│                                     │
│  {summary全文}                      │  16px, --text-primary
│                                     │
│  {N} connections · {X} days ago     │  11px, --text-muted, mono
│                                     │
│  ───────────────────────────        │  0.5px区切り線
│                                     │
│  "{偉人の言葉}"                     │  13px, --text-secondary, italic
│                      — {人名}       │  12px, --text-muted, 右寄せ
│                                     │
└─────────────────────────────────────┘
```

### `src/lib/home-picker.ts` — ピックアップロジック

```typescript
// 重み付きランダム選択
// - 接続数が多いノード → weight += connCount * 2
// - 3日以上前のノード → weight += 3（再浮上価値）
// - ランダム成分 → weight += Math.random() * 2
// sessionStorage に選択結果を保存。同一セッション内は同じノード
```

### `src/components/node-preview.tsx` — 静的SVGプレビュー

D3は使わない。静的SVGで以下を描画:
- メインノード: 半径65px、#FFFFFF塗り、#CCCCCC枠線 1px
- メインノード内テキスト: summary先頭7文字、13px、#888888
- 衛星ノード（接続先）: 最大3個、半径12px、#FFFFFF塗り、#E0E0E0枠線、ラベルなし
- 衛星ノード位置: メインノード中心から120度間隔、距離115px
- 接続線: メインから衛星へ、#E0E0E0、0.5px
- SVG viewBox: "0 0 360 280"

### エンプティステート（メモ0件）
- NodePreview 非表示
- 同心円SVGモチーフ + "0 nodes"
- 偉人の言葉だけ表示

### 偉人の言葉
- `src/lib/quotes.ts` から選出: `quotes[dayOfYear % quotes.length]`
- 既存の quotes.ts を利用。日本語の偉人も追加する（最低20件に拡充）

### タップ動作
- NodePreview エリア全体タップ → `/memo/{id}`

commit: `FIX: §2 ホーム再設計 — ノードプレビュー+偉人の言葉`

---

## §3. quotes.ts 拡充

**対象:** `src/lib/quotes.ts`

### 変更内容
- 最低30件に拡充（現状の件数を確認して不足分を追加）
- 日本の偉人を10件以上追加（岡本太郎、宮崎駿、松下幸之助、本田宗一郎、黒澤明、etc）
- 各エントリに日本語訳フィールド `ja` を追加（英語の言葉の場合）
- ホーム画面では日本語訳を表示。原文は下に小さく

```typescript
interface Quote {
  text: string;       // 原文
  author: string;
  ja?: string;        // 日本語訳（英語の場合のみ）
}
```

commit: `FIX: §3 quotes拡充 — 30件+日本語対応`

---

## §4. グラフ画面 — 静止配置 + 位置記憶 + ドラッグ移動

**対象:** `src/app/graph/page.tsx` (大幅書き換え)

### 4-1. 静止配置

現状の問題: force simulation が毎回ランダム配置→アニメーション→微動。

変更:
1. localStorage `ideamemo-graph-positions` にノード位置を保存
2. 保存済みノード → `fx`, `fy` で固定配置（simulation不要）
3. 新規ノードのみ simulation で空きスペースに配置
4. simulation 完了後 → 全位置を localStorage に書き戻し
5. **simulation 完了後はノードは完全静止**。微動アニメーション（sin波）を**削除**

```typescript
type GraphPositions = { [nodeId: string]: { x: number; y: number } };

// 読み込み
const saved = JSON.parse(localStorage.getItem("ideamemo-graph-positions") || "{}");

// ノード初期化時
nodes.forEach(n => {
  const pos = saved[n.id];
  if (pos) { n.fx = pos.x; n.fy = pos.y; n.x = pos.x; n.y = pos.y; }
});

// simulation end → 保存
simulation.on("end", () => {
  const positions: GraphPositions = {};
  nodes.forEach(n => { positions[n.id] = { x: n.x!, y: n.y! }; });
  localStorage.setItem("ideamemo-graph-positions", JSON.stringify(positions));
});
```

### 4-2. ドラッグ移動

D3 `d3.drag()` をノードグループにバインド:

```typescript
const drag = d3.drag<SVGGElement, GraphNode>()
  .on("start", (event, d) => {
    dragStartPos = { x: event.x, y: event.y };
  })
  .on("drag", (event, d) => {
    d.fx = event.x;
    d.fy = event.y;
    d.x = event.x;
    d.y = event.y;
    // ノードとリンクの位置を即時更新（simulation再開なし）
    d3.select(event.sourceEvent.target.parentNode)
      .attr("transform", `translate(${event.x},${event.y})`);
    // このノードに繋がるリンクも更新
    linkEls.filter(l => (l.source as GraphNode).id === d.id || (l.target as GraphNode).id === d.id)
      .attr("x1", l => (l.source as GraphNode).x ?? 0)
      .attr("y1", l => (l.source as GraphNode).y ?? 0)
      .attr("x2", l => (l.target as GraphNode).x ?? 0)
      .attr("y2", l => (l.target as GraphNode).y ?? 0);
  })
  .on("end", (event, d) => {
    const dist = Math.hypot(event.x - dragStartPos.x, event.y - dragStartPos.y);
    if (dist <= 5) {
      // タップ扱い → handleNodeClick(d)
      handleNodeClick(d);
    } else {
      // ドラッグ完了 → 位置保存
      const saved = JSON.parse(localStorage.getItem("ideamemo-graph-positions") || "{}");
      saved[d.id] = { x: d.fx, y: d.fy };
      localStorage.setItem("ideamemo-graph-positions", JSON.stringify(saved));
    }
  });

nodeGroup.call(drag);
```

### 4-3. ノードサイズ（接続数で変動）

```typescript
const connCountMap = new Map<string, number>();
filteredConnections.forEach(c => {
  connCountMap.set(c.idea_from_id, (connCountMap.get(c.idea_from_id) || 0) + 1);
  if (c.idea_to_id) connCountMap.set(c.idea_to_id, (connCountMap.get(c.idea_to_id) || 0) + 1);
});

// baseR = 30 (直径60px)
// 接続数に応じて拡大: +接続数*3px、上限 baseR*1.5
const r = Math.min(baseR * 1.5, baseR + (connCountMap.get(idea.id) || 0) * 3);
```

### 4-4. ノード内テキスト

- メモノード: summary先頭7文字 + 「…」（8文字目以降あれば）、10px、#888888
- 外部知識ノード: title先頭5文字 + 「…」、8px、#BBBBBB

### 4-5. エッジスタイル

| タイプ | 色 | 太さ | スタイル |
|--------|-----|------|---------|
| external_knowledge | #CCCCCC | 0.5px | 破線 `4 2` |
| combination | #999999 | 1.5px | 実線 |
| manual | #CCCCCC | 0.5px | 実線 |
| chat_derived | #CCCCCC | 0.5px | 点線 `2 2` |

### 4-6. ズーム挙動

- `d3.zoom().scaleExtent([0.3, 3])` 維持
- **ズームの duration を 600ms, ease d3.easeCubicOut に変更**（現状は速すぎるというFB）

commit: `FIX: §4 グラフ静止配置+位置記憶+ドラッグ移動+ノードサイズ`

---

## §5. グラフ画面 — タップ→ズーム→ローカルグラフ展開

**対象:** `src/app/graph/page.tsx` (§4の続き)

### タップフロー（メモノード）

```
タップ判定（§4のドラッグ5px以下）
  ↓
① 既に selectedNode と同じ → /memo/{id} に遷移
  ↓
② 別ノード or 未選択:
  a. selectedNode を更新
  b. D3 zoom.transform でそのノードを画面中央にズームイン
     - scale: 1.8
     - duration: 600ms
     - ease: d3.easeCubicOut
     - transition 使用: svg.transition().duration(600).call(zoom.transform, ...)
  c. ズーム完了 (.on("end")) で外部知識ノードを放射状展開
     - そのノードに紐づく connections (type=external_knowledge) を取得
     - 親ノード中心に 60度間隔で均等配置（最大6ノード）
     - ノードは opacity 0→1 のアニメーション（300ms）
     - 展開ノードサイズ: baseR * 0.5
  d. ミニパネルを画面下部に表示
```

### ミニパネル（§5版、§4のものを拡張）

```
┌─────────────────────────────────────┐
│ {summary 1行 truncate}              │  13px, --text-primary
│ {keyword1} · {keyword2} · {kw3}     │  10px, --text-muted
│                                     │
│ detail →     🔗 link     × combine  │  11px
└─────────────────────────────────────┘
```

- `detail →` → /memo/{id} （accent色）
- `🔗 link` → 紐付けモード開始（§6）
- `× combine` → 掛け合わせモード開始（既存ロジック維持）

### 外部知識ノードタップ

- タップ → ミニパネルの内容がその外部知識の詳細に切り替わる（タイトル+サマリー+sourceリンク）
- 再タップ → 何もしない

### ピンチアウトで戻る

```typescript
zoom.on("zoom", (event) => {
  g.attr("transform", event.transform);
  if (event.transform.k < 0.9 && expandedNodeId) {
    // 展開ノードをフェードアウト（200ms）
    // selectedNode = null
    // ミニパネル非表示
    // expandedNodeId = null
  }
});
```

commit: `FIX: §5 タップ→ズーム→ローカルグラフ展開`

---

## §6. グラフ画面 — 紐付け操作

**対象:** `src/app/graph/page.tsx` (§5の続き)

### 2ステップ選択

```
ミニパネルの「🔗 link」タップ
  ↓
linkMode = true
  - 画面上部にバナー表示: 「接続先のノードをタップ」
    - background: var(--bg-tertiary)
    - text: var(--text-secondary)、12px
  - ノードAにaccent色リング（stroke: var(--accent), strokeWidth: 2）
  ↓
ノードBタップ
  ↓
mockDb.connections.insert({
  id: `conn-manual-${Date.now()}`,
  idea_from_id: nodeA.id,
  idea_to_id: nodeB.id,
  connection_type: "manual",
  source: "manual",
  persona_label: null,
  reason: "",
  action_suggestion: "",
  quality_score: null,
  external_knowledge_title: null,
  external_knowledge_url: null,
  external_knowledge_summary: null,
  source_idea_summary: null,
  user_note: null,
  feedback: null,
  feedback_at: null,
  bookmarked: false,
  created_at: new Date().toISOString(),
})
  ↓
グラフにエッジ追加（細い実線 #CCCCCC 0.5px）
linkMode = false
バナー非表示
ミニパネル非表示
```

**キャンセル:** 背景タップ or バナータップで linkMode 解除

commit: `FIX: §6 紐付け操作（2ステップ選択）`

---

## §7. 深掘りチャット — 気づき抽出UI

**対象:** `src/app/chat/page.tsx` (変更), `src/app/api/chat/extract-insights/route.ts` (新規)

### 「まとめる」ボタン追加

チャット画面の入力フィールドの左に「まとめる」テキストリンクを追加（11px, --text-muted）。
表示条件: メッセージ数 >= 6 (assistant 3回以上)

### 自動トリガー

assistant メッセージが6回に到達したら自動で抽出APIコール。
重複防止: 既に候補を表示済みの場合はスキップ。

### 抽出APIエンドポイント（モック版）

`POST /api/chat/extract-insights`

```typescript
// Request: { session_id: string }
// Response（モック）: { insights: ChatInsight[] }
// モック固定レスポンス:
const MOCK_INSIGHTS = [
  {
    id: `insight-${Date.now()}-1`,
    session_id: req.session_id,
    summary: "コスト変換の原理",
    full_text: "社会的コストを物理的動作に変換することで、集団の行動ロックを解除できる。アンドン紐、付箋、スレッドが同じ構造。",
    keywords: ["コスト変換", "行動設計", "ロック解除"],
    status: "suggested",
    created_at: new Date().toISOString(),
  },
  {
    id: `insight-${Date.now()}-2`,
    session_id: req.session_id,
    summary: "デフォルトの力",
    full_text: "行動の選択肢ではなくデフォルトを変えることで、意思決定なしに集団行動が変わる。オプトアウト vs オプトイン。",
    keywords: ["デフォルト", "ナッジ", "選択設計"],
    status: "suggested",
    created_at: new Date().toISOString(),
  },
];
```

### 候補表示UI

メッセージリストの下部に表示。スライドインアニメーション（300ms, ease-out, translateY(20px)→0）。

```
┌─────────────────────────────────────┐
│ 新しい気づき                        │  13px, --text-primary
│                                     │
│ ┌─────────────────────────────┐     │
│ │ コスト変換の原理             │     │  summary: 13px, bold
│ │ 社会的コストを物理的動作に   │     │  full_text: 12px, --text-body
│ │ 変換することで...           │     │
│ │      [ノードに追加]    [×]  │     │  11px, accent / muted
│ └─────────────────────────────┘     │
│                                     │
│ ┌─────────────────────────────┐     │
│ │ デフォルトの力              │     │
│ │ ...                        │     │
│ │      [ノードに追加]    [×]  │     │
│ └─────────────────────────────┘     │
└─────────────────────────────────────┘
```

### 「ノードに追加」処理

```typescript
// 1. mockDb.ideas.insert() — 新しいIdeaを作成
const newIdea: Idea = {
  id: `idea-insight-${Date.now()}`,
  user_id: "mock-user-001",
  transcript: insight.full_text,
  summary: insight.summary,          // ノードラベル用
  keywords: insight.keywords,
  abstract_principle: insight.full_text,
  latent_question: "",
  domain: "その他",
  audio_url: null,
  folder_id: null,
  folder_name: null,
  source: "chat_insight",
  parent_session_id: session.id,
  created_at: new Date().toISOString(),
};

// 2. mockDb.connections.insert() — 元メモとの接続
const newConn: Connection = {
  id: `conn-derived-${Date.now()}`,
  idea_from_id: session.idea_id,     // 元のメモ
  idea_to_id: newIdea.id,
  connection_type: "chat_derived",
  source: "ai",
  // ...他フィールドはデフォルト値
};

// 3. insight.status → 'accepted'
// 4. トースト表示: 「グラフに追加しました ✓」
//    - 画面下部中央、background: var(--text-primary), color: var(--bg-primary)
//    - 1.5秒で fadeOut
// 5. カードをフェードアウト
```

### 「×」処理
- insight.status → 'dismissed'
- カードをフェードアウト

commit: `FIX: §7 深掘りチャット気づき抽出UI+API`

---

## §8. FEEDBACK_v1 反映（小修正バッチ）

**対象:** 複数ファイル

以下の小修正を一括で行う:

### 8-1. 波形アニメーション中央基点化
**対象:** `src/components/waveform-bars.tsx`
- 現状: 左半分しか波が動かない
- 修正: 波形を中央基点に変更。バーが中央付近で最も高く、両端に向かって低くなるように

### 8-2. ヘッダー固定
**対象:** `src/components/app-header.tsx`
- 現状: スクロールでヘッダーが動く
- 修正: `position: sticky; top: 0; z-index: 50;` + 背景色 `var(--bg-primary)` で固定

### 8-3. ロゴタップでホームへ
**対象:** `src/components/app-header.tsx`
- ロゴ（またはタイトル）をクリックで `/` に遷移

### 8-4. フォルダ関連ページの削除
**対象:** `src/app/folders/page.tsx`, `src/app/folders/[name]/page.tsx`
- 確定方針: フォルダ機能は不要。ファイル削除
- タブバーからフォルダタブが残っていれば除去

### 8-5. タブバーからフォルダ除去
**対象:** `src/components/tab-bar.tsx`
- フォルダ関連タブを除去
- 3タブ構成: ホーム（●） / 録音（◉） / グラフ（○-○）
- チャットタブも確認: チャットへの導線はメモ詳細→接続カード→深掘り、またはグラフ→掛け合わせ→deep dive。タブバーにチャットは不要。もし存在していれば除去

### 8-6. アイコンサイズ微増
**対象:** `src/components/tab-bar.tsx`, `src/components/app-header.tsx`
- タブバーアイコン: 現状サイズ+2px
- ヘッダーアイコン: 現状サイズ+2px

commit: `FIX: §8 FB反映 — 波形中央化+ヘッダー固定+フォルダ削除+タブ3化+アイコン拡大`

---

## §9. CLAUDE.md 更新

**対象:** `CLAUDE.md`

### 変更内容

ビルド順序セクションを更新:

```markdown
## ビルド順序（v4）

REVISION_SPEC_v4.md で以下を実行済み:
- §0-1: types拡張 + モックDB拡張
- §2-3: ホーム再設計 + quotes拡充
- §4-6: グラフ刷新（静止配置+位置記憶+ズーム展開+紐付け）
- §7: 深掘りチャット気づき抽出
- §8: FB反映（波形+ヘッダー+フォルダ削除+タブ3化）
```

タスク仕様書セクションに追加:

```markdown
- `SPEC_GRAPH_HOME_v3.md` (docs/) — グラフ詳細+深掘り転記+ホーム再設計の設計根拠
- `REVISION_SPEC_v4.md` (docs/) — 実行仕様書（本ファイル）
```

commit: `FIX: §9 CLAUDE.md更新`

---

## 品質チェックリスト（全§完了後）

### ホーム
- [ ] メモ1件以上 → ノードプレビュー（SVG）が表示される
- [ ] ノードプレビュータップ → /memo/{id} に遷移
- [ ] 衛星ノードと接続線が表示される（接続がある場合）
- [ ] リロードでピックアップが変わることがある
- [ ] 偉人の言葉が日本語で表示される
- [ ] メモ0件 → 同心円 + 0 nodes + 偉人の言葉のみ
- [ ] メモ一覧は表示されない（旧UI除去済み）

### グラフ
- [ ] ノードが静止している（微動・sin波なし）
- [ ] ノードをドラッグで移動できる
- [ ] ドラッグ後にページ再訪問 → 同じ位置に表示される
- [ ] ノードタップ → 滑らかズーム（600ms）→ 外部知識が放射状に展開
- [ ] 展開済みノード再タップ → /memo/{id} に遷移
- [ ] ピンチアウト（scale < 0.9）→ 展開が閉じて全体表示に戻る
- [ ] ミニパネルの「🔗 link」→ バナー表示 → 2つ目タップ → エッジ追加
- [ ] 背景タップでリンクモードが解除される
- [ ] ノードサイズが接続数に応じて異なる
- [ ] combination(太実線) / external_knowledge(破線) / manual(細実線) の線が異なる

### チャット
- [ ] チャット一覧にダミーセッション3件が表示される
- [ ] セッション選択でメッセージが表示される
- [ ] メッセージが6往復以上あるセッション → 「まとめる」リンクが表示される
- [ ] 「まとめる」タップ → 気づき候補カードが表示される
- [ ] 「ノードに追加」→ トースト表示 → カードがフェードアウト
- [ ] 「×」→ カードがフェードアウト

### FB反映
- [ ] 波形が中央基点で動く
- [ ] ヘッダーがスクロールで固定（sticky）
- [ ] ロゴタップで / に遷移
- [ ] /folders ページが404になる（削除済み）
- [ ] タブバーが3タブ（ホーム/録音/グラフ）
- [ ] iPhone SE（375px）でレイアウト崩れなし

---

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `src/lib/types.ts` | 変更 |
| `src/lib/mock/db.ts` | 変更 |
| `src/lib/mock/seed.ts` | 変更 |
| `src/app/page.tsx` | **大幅書き換え** |
| `src/components/node-preview.tsx` | **新規** |
| `src/lib/home-picker.ts` | **新規** |
| `src/lib/quotes.ts` | 変更（拡充） |
| `src/app/graph/page.tsx` | **大幅書き換え** |
| `src/app/chat/page.tsx` | 変更 |
| `src/app/api/chat/extract-insights/route.ts` | **新規** |
| `src/components/waveform-bars.tsx` | 変更 |
| `src/components/app-header.tsx` | 変更 |
| `src/components/tab-bar.tsx` | 変更 |
| `src/app/folders/page.tsx` | **削除** |
| `src/app/folders/[name]/page.tsx` | **削除** |
| `CLAUDE.md` | 変更 |
