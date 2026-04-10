# SPEC: グラフ詳細 + 深掘り転記 + ホーム再設計 v3

> 確定日: 2026/04/10
> 前提: FEEDBACK_v1.md の確定方針をベース

---

## §1. グラフ画面 — 静止配置 + 位置記憶

### 1-1. 位置永続化

**ストレージ:** localStorage `ideamemo-graph-positions`

```typescript
type GraphPositions = {
  [nodeId: string]: { x: number; y: number };
};
```

**フロー:**
1. 画面オープン → localStorage読む
2. 保存済み位置があるノード → `fx`, `fy` にセットして固定配置
3. 新規ノード（保存位置なし）のみ force simulation で空きスペースに配置
4. simulation 完了（`simulation.on("end")` 発火）→ 全ノードの最終位置を localStorage に書き戻し
5. 以降 simulation は停止。ノードは完全に静止

**初回（位置データなし）:**
- 全ノードを force simulation で配置
- simulation 完了後に全位置を保存
- 2回目以降は保存位置を使うため、simulation は新規ノード分のみ

### 1-2. ドラッグ移動

D3 `d3.drag()` をノードグループにバインド。

```
dragstart → simulation.alphaTarget(0) ← 物理演算は再開しない
drag      → d.fx = event.x; d.fy = event.y
dragend   → localStorage に { [d.id]: { x: d.fx, y: d.fy } } を更新
```

**タップ vs ドラッグの判定:**
- `dragstart` で `startPos = { x: event.x, y: event.y }` を記録
- `dragend` で移動距離を算出
- **5px 以下 → タップ扱い**（handleNodeClick発火）
- **5px 超 → ドラッグ完了**（位置保存のみ、クリックイベントなし）

### 1-3. タップ → 滑らかズーム → ローカルグラフ展開

**シングルタップフロー（メモノード）:**

```
タップ判定（5px以下移動）
  ↓
① 選択済みノードと同じノード → /memo/{id} に遷移（詳細ページ）
  ↓
② 未選択 or 別ノード：
  → selectedNode を更新
  → D3 zoom.transform でそのノードを画面中央にズームイン
     - scale: 1.8
     - duration: 600ms
     - ease: d3.easeCubicOut
  → ズーム完了コールバックで外部知識ノードを放射状展開
     - そのノードに紐づく connections (type=external_knowledge) を取得
     - 親ノード中心に 60度間隔で均等配置（最大6ノード）
     - ノードはscale 0→1のアニメーション（300ms, ease-out）
     - 展開ノードサイズ: baseR * 0.5
  → ミニパネルを画面下部に表示
```

**ミニパネル（展開時）:**

```
┌─────────────────────────────────────┐
│ 通勤ラッシュの非合理さ               │  ← summary（1行、truncate）
│ 通勤ラッシュ · 時間分散 · 同調行動    │  ← keywords（小さく）
│                                     │
│ detail →        × combine           │  ← アクションリンク
└─────────────────────────────────────┘
```

- `detail →` → /memo/{id}
- `× combine` → 掛け合わせモード開始

**ピンチアウトで戻る:**
- zoom の `on("zoom")` 内で `event.transform.k < 0.9` を検知
- 検知したら：
  - 展開中の外部知識ノードをフェードアウト（200ms）
  - selectedNode を null に
  - ミニパネルを非表示
  - zoom を identity（全体表示）にアニメーション遷移（400ms）

**外部知識ノードのタップ:**
- タップ → ミニパネルの内容がその外部知識の詳細に切り替わる
  - タイトル、サマリー、source URL
- 再タップ → 何もしない（詳細ページはない）

### 1-4. 紐付け操作

**方式: ミニパネル内ボタンからの2ステップ選択**

※ 長押しドラッグはパン操作・ドラッグ移動と競合するため不採用。

```
ノードAタップ → ミニパネル表示 → 「🔗 link」ボタンタップ
  ↓
リンクモード開始
  - バナー表示:「接続先のノードをタップ」（上部、accent背景）
  - ノードAにaccentリング
  ↓
ノードBタップ
  ↓
即座にエッジ追加（APIコール不要）
  - connection_type: 手動の場合は 'manual'（新タイプ）
  - source: 'manual'
  - 線スタイル: 細い実線（#CCCCCC, stroke-width: 0.5）
  - combination: 太い実線 | external_knowledge: 破線 | manual: 細い実線
  ↓
mockDb.connections.insert() + グラフ再描画
リンクモード終了
```

**キャンセル:** 背景タップ or バナータップでリンクモード解除

### 1-5. ノードの視覚仕様（確定）

| 属性 | メモノード | 外部知識ノード |
|------|-----------|--------------|
| サイズ | baseR（60-70px直径） | baseR * 0.5 |
| サイズ変動 | 接続数に応じて拡大（+接続数*3px、上限 baseR*1.5） | 固定 |
| ラベル文字数 | 7-8文字（9px） | 5-6文字（8px） |
| 塗り | #FFFFFF | #FFFFFF |
| 線 | #CCCCCC 実線 1px | #BBBBBB 破線 1px |
| 選択時 | accent色リング + scale 1.3 | accent色リング |

### 1-6. エッジの視覚仕様（確定）

| タイプ | 色 | 太さ | スタイル |
|--------|-----|------|---------|
| external_knowledge | #CCCCCC | 0.5px | 破線 `4 2` |
| combination | #999999 | 1.5px | 実線 |
| manual | #CCCCCC | 0.5px | 実線 |
| chat_derived | #CCCCCC | 0.5px | 点線 `2 2` |

### 1-7. フィルタ

**v1方針: データ構造のみ設計。UIは15ノード超過時に表示。**

現状の時間フィルタ（all/7d/30d）は維持。以下を将来用に定義。

```typescript
type GraphFilter = {
  time: 'all' | '7d' | '30d' | '90d';
  connectivity: 'all' | 'connected' | 'isolated';
  source: 'all' | 'voice' | 'chat_insight';
};
```

| フィルタ | 値 | 意味 |
|---------|---|------|
| time | all / 7d / 30d / 90d | 作成日 |
| connectivity | all / connected / isolated | 接続有無 |
| source | all / voice / chat_insight | ノードの出自 |

**UI出現条件:** `ideas.length > 15`

---

## §2. 深掘りチャット → ノード転記（案C）

### 2-1. 新テーブル: chat_insights

```sql
CREATE TABLE chat_insights (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  summary      TEXT NOT NULL,          -- ノードラベル用 7-8文字
  full_text    TEXT NOT NULL,          -- 気づきの全文 2-3文
  keywords     TEXT[] DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'suggested',  -- 'suggested' | 'accepted' | 'dismissed'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_insights_session ON chat_insights(session_id);
CREATE INDEX idx_chat_insights_status ON chat_insights(status);
```

### 2-2. ideas テーブル拡張

```sql
ALTER TABLE ideas ADD COLUMN source TEXT DEFAULT 'voice';
-- 'voice' | 'chat_insight'

ALTER TABLE ideas ADD COLUMN parent_session_id TEXT REFERENCES chat_sessions(id);
-- chat_insight の場合のみ。元のチャットセッション
```

### 2-3. connection_type 拡張

```typescript
export type ConnectionType =
  | "external_knowledge"
  | "combination"
  | "manual"         // 新規: グラフ上の手動紐付け
  | "chat_derived";  // 新規: チャットから生まれたノードと元メモの接続
```

### 2-4. 抽出トリガー

| 条件 | 動作 |
|------|------|
| assistant メッセージ 6回到達 | 自動で抽出APIコール → 候補表示 |
| ユーザーが「まとめる」ボタンタップ | 手動で抽出APIコール → 候補表示 |
| チャット画面離脱時（3往復以上） | 「気づきをまとめますか？」確認ダイアログ |

### 2-5. 抽出API

`POST /api/chat/extract-insights`

```typescript
// Request
{
  session_id: string;
}

// Response
{
  insights: Array<{
    id: string;
    summary: string;      // 7-8文字
    full_text: string;     // 2-3文（50字以内）
    keywords: string[];
  }>;
}
```

**抽出プロンプト骨子:**

```
あなたはメモアプリの気づき抽出エンジンです。

## 入力
- 元のメモ: {idea.summary}
- チャット全文: {messages}

## タスク
このチャットの中で、元のメモにはなかった**新しい発見・視点・つながり**を最大3つ抽出してください。

## ルール
- 元のメモの言い換えは除外する
- チャットの中で初めて出てきた概念・事例・構造のみ
- 各 summary は7-8文字（ノードラベル用）
- 各 full_text は50字以内
- keywords は2-3個

## 出力（JSON）
{ "insights": [ { "summary": "...", "full_text": "...", "keywords": [...] } ] }
```

### 2-6. 候補表示UI（チャット画面内）

```
┌─────────────────────────────────────┐
│            チャット本文              │
│              ...                    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💡 新しい気づきが見つかりました  │ │  ← 自動表示 or 「まとめる」後
│ │                                 │ │
│ │ ┌─────────────────────────┐     │ │
│ │ │ 制約の質と量            │     │ │  ← summary
│ │ │ 制約が多ければいいので  │     │ │  ← full_text（2行）
│ │ │ はなく、質が創造性を    │     │ │
│ │ │ 左右する               │     │ │
│ │ │        [ノードに追加] [×]│     │ │
│ │ └─────────────────────────┘     │ │
│ │                                 │ │
│ │ ┌─────────────────────────┐     │ │
│ │ │ 偶然の設計              │     │ │
│ │ │ ...                     │     │ │
│ │ │        [ノードに追加] [×]│     │ │
│ │ └─────────────────────────┘     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2-7. 「ノードに追加」処理フロー

```
「ノードに追加」タップ
  ↓
① chat_insights.status → 'accepted'
  ↓
② ideas テーブルに INSERT:
   - id: uuid生成
   - summary: insight.summary
   - keywords: insight.keywords
   - abstract_principle: insight.full_text
   - latent_question: ""（空。チャット派生なので問い変換不要）
   - source: 'chat_insight'
   - parent_session_id: session.id
  ↓
③ connections テーブルに INSERT:
   - idea_from_id: 元のメモ（session.idea_id）
   - idea_to_id: 新しいidea.id
   - connection_type: 'chat_derived'
   - source: 'ai'
  ↓
④ トースト表示:「グラフに追加しました ✓」（1.5s、画面下部）
⑤ カードをフェードアウト
```

### 2-8. モック実装

`src/lib/mock/insights.ts` — 固定の抽出結果を返す

```typescript
export const MOCK_INSIGHTS = [
  {
    id: "insight-001",
    summary: "制約の質と量",
    full_text: "制約は多ければいいのではなく、質が創造性を左右する。Twitter 140字は良い制約、官僚的ルールは悪い制約。",
    keywords: ["制約の質", "創造性", "ルール設計"],
  },
  {
    id: "insight-002",
    summary: "偶然の設計",
    full_text: "Spotifyの探索枠のように、偶然の出会いは設計できる。完全なランダムではなく、30%の逸脱。",
    keywords: ["セレンディピティ", "アルゴリズム", "探索"],
  },
];
```

---

## §3. ホーム画面再設計

### 3-1. コンセプト

ホーム = **自分のノードとの偶然の再会 + 偉人の言葉**

### 3-2. レイアウト

```
┌─────────────────────────────────────┐
│ ideamemo                     ⚙      │  ← 固定ヘッダー
│                                     │
│                                     │
│           ╱ ── ╲                    │  ← 接続先ノード（小、ラベルなし）
│          ╱       ╲                  │     16-20px、#E0E0E0
│   ╱ ── ╲    ┌─────────┐            │
│  (小)        │         │    ╱ ── ╲  │
│   ╲         │  ピック  │   (小)    │
│    ── ──── │  アップ  │ ── ──    │  ← メインノード 120-140px
│             │  ノード  │            │     #FFFFFF、border #CCCCCC
│             │ (7-8文字)│            │
│             └─────────┘            │
│                                     │
│  混雑と快適さの逆説                  │  ← summary 全文（16px, --text-primary）
│                                     │
│  3 connections · 4 days ago          │  ← メタ情報（11px, --text-muted, mono）
│                                     │
│                                     │
│  ───────────────────────────        │  ← 区切り線（0.5px, #E0E0E0）
│                                     │
│  "The only way to do great work     │  ← 偉人の言葉（13px, --text-secondary）
│   is to love what you do."          │     イタリック
│                       — Steve Jobs  │     右寄せ（12px, --text-muted）
│                                     │
│  [●]        [◉ rec]        [○-○]   │  ← タブバー
└─────────────────────────────────────┘
```

### 3-3. ピックアップロジック

```typescript
function pickHomeNode(ideas: Idea[], connections: Connection[]): Idea | null {
  if (ideas.length === 0) return null;

  const now = Date.now();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

  const scored = ideas.map((idea) => {
    const connCount = connections.filter(
      (c) => c.idea_from_id === idea.id || c.idea_to_id === idea.id
    ).length;
    const ageMs = now - new Date(idea.created_at).getTime();
    const isOld = ageMs > THREE_DAYS;

    // 重み計算
    let weight = 1;
    weight += connCount * 2;        // 接続が多い → ハブノード、見せる価値高
    if (isOld) weight += 3;          // 古い → 再浮上の価値
    weight += Math.random() * 2;     // ランダム成分

    return { idea, weight };
  });

  // 重み付きランダム選択
  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const s of scored) {
    rand -= s.weight;
    if (rand <= 0) return s.idea;
  }
  return scored[0].idea;
}
```

**セッション単位:** `sessionStorage` に選択結果を保存。同一セッション内は同じノード。リロードで変わる。

### 3-4. ノードプレビューSVG

D3は使わない。静的SVGで描画。

```tsx
function NodePreview({ idea, connections }: { idea: Idea; connections: Connection[] }) {
  const relatedConns = connections.filter(
    (c) => c.idea_from_id === idea.id || c.idea_to_id === idea.id
  ).slice(0, 3); // 最大3本の線

  const mainR = 65; // 半径65px = 直径130px
  const smallR = 12;
  const cx = 180, cy = 140; // SVG中央

  // 接続先ノードの位置（親の周囲に配置）
  const satellites = relatedConns.map((_, i) => {
    const angle = (i * 120 - 90) * (Math.PI / 180); // 120度間隔、上から開始
    const dist = mainR + 50;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  });

  return (
    <svg width="360" height="280" viewBox="0 0 360 280">
      {/* 接続線 */}
      {satellites.map((sat, i) => (
        <line key={i} x1={cx} y1={cy} x2={sat.x} y2={sat.y}
          stroke="#E0E0E0" strokeWidth="0.5" />
      ))}
      {/* 衛星ノード（小、ラベルなし） */}
      {satellites.map((sat, i) => (
        <circle key={i} cx={sat.x} cy={sat.y} r={smallR}
          fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="0.5" />
      ))}
      {/* メインノード */}
      <circle cx={cx} cy={cy} r={mainR}
        fill="#FFFFFF" stroke="#CCCCCC" strokeWidth="1" />
      <text x={cx} y={cy} textAnchor="middle" dy="0.35em"
        fontSize="13" fill="#888888">
        {idea.summary.slice(0, 7)}
      </text>
    </svg>
  );
}
```

### 3-5. エンプティステート（メモ0件）

```
┌─────────────────────────────────────┐
│ ideamemo                     ⚙      │
│                                     │
│                                     │
│                                     │
│          (同心円モチーフ SVG)         │
│             0 nodes                  │
│                                     │
│                                     │
│  ───────────────────────────        │
│                                     │
│  "The only way to do great work     │
│   is to love what you do."          │
│                       — Steve Jobs  │
│                                     │
│  [●]        [◉ rec]        [○-○]   │
└─────────────────────────────────────┘
```

### 3-6. タップ動作

- ノードプレビュー（SVG全体 or メインノード）タップ → `/memo/{id}`
- 偉人の言葉エリアはタップ反応なし

### 3-7. 偉人の言葉の選出

- `src/lib/quotes.ts` から日替わりで選出
- ロジック: `quotes[dayOfYear % quotes.length]`
- セッション中は固定（sessionStorage）

---

## §4. types.ts 変更まとめ

```typescript
// 追加
export type ConnectionType =
  | "external_knowledge"
  | "combination"
  | "manual"          // NEW
  | "chat_derived";   // NEW

export type IdeaSource = "voice" | "chat_insight";

export interface Idea {
  // 既存フィールドすべて維持
  source: IdeaSource;              // NEW（default: 'voice'）
  parent_session_id: string | null; // NEW（chat_insight の場合のみ）
}

export interface ChatInsight {
  id: string;
  session_id: string;
  summary: string;
  full_text: string;
  keywords: string[];
  status: "suggested" | "accepted" | "dismissed";
  created_at: string;
}

// GraphFilter は将来用。UIは15ノード超過時に出す
export interface GraphFilter {
  time: "all" | "7d" | "30d" | "90d";
  connectivity: "all" | "connected" | "isolated";
  source: "all" | "voice" | "chat_insight";
}
```

---

## §5. 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/lib/types.ts` | 変更 | ConnectionType拡張, IdeaSource, ChatInsight追加 |
| `src/app/graph/page.tsx` | **大幅変更** | 静止配置, 位置記憶, ズーム展開, ドラッグ移動, 紐付け |
| `src/app/page.tsx` | **大幅変更** | ホーム画面再設計（ノードプレビュー + 偉人の言葉） |
| `src/app/chat/page.tsx` | 変更 | 気づき抽出UI + まとめるボタン追加 |
| `src/app/api/chat/extract-insights/route.ts` | **新規** | 抽出API |
| `src/lib/mock/insights.ts` | **新規** | モック抽出結果 |
| `src/lib/mock/db.ts` | 変更 | chatInsights CRUD追加 |
| `src/lib/mock/seed.ts` | 変更 | ideas に source/parent_session_id フィールド追加 |
| `src/lib/home-picker.ts` | **新規** | ピックアップロジック |
| `src/components/node-preview.tsx` | **新規** | ホーム用SVGプレビュー |

---

## §6. 品質チェックリスト

### グラフ
- [ ] ノードが静止している（微動なし）
- [ ] ノードをドラッグで移動できる
- [ ] ドラッグ後にアプリ再起動 → 同じ位置に表示される
- [ ] ノードタップ → 滑らかズーム → 外部知識が放射状に展開
- [ ] 展開済みノード再タップ → /memo/{id} に遷移
- [ ] ピンチアウト → 展開が閉じて全体表示に戻る
- [ ] ミニパネルの「🔗 link」→ 2つ目タップ → エッジ追加
- [ ] 背景タップでリンクモード解除
- [ ] 新規ノード追加 → 既存ノードの位置は変わらない
- [ ] combination / external_knowledge / manual の線スタイルが異なる

### 深掘り転記
- [ ] チャット6往復後に自動で気づき候補が表示される
- [ ] 「まとめる」ボタンで手動抽出可能
- [ ] 「ノードに追加」→ グラフに新ノードが出現
- [ ] 新ノードは元メモと chat_derived エッジで接続されている
- [ ] 「×」で候補を消せる（status = dismissed）

### ホーム
- [ ] メモ1件以上 → ノードプレビューが表示される
- [ ] ノードプレビュータップ → /memo/{id} に遷移
- [ ] 接続線と衛星ノードが表示される（接続がある場合）
- [ ] リロードでピックアップが変わる
- [ ] 偉人の言葉が日替わりで変わる
- [ ] メモ0件 → 同心円 + 0 nodes + 偉人の言葉のみ
- [ ] iPhone SE（375px）でレイアウト崩れなし
