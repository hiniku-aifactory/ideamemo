# REVISION SPEC v5.1 — グラフ画面フラットマップ化

> **実行者:** Claude Code (Sonnet)
> **前提:** 実装前に `CLAUDE.md` → `docs/DESIGN_v2.md` → 本ファイルの順に読むこと
> **スコープ:** グラフ画面（§1-§4）のみ。チャット(§6-§7)・メモ詳細(§8)・録音結果(§9)・ホーム(§10)は v5 spec 実装済みのまま維持

---

## 方針

v5で実装した Level 1→2→3 の3段階方式を廃止し、**フラットマップ方式**に置き換える。

**フラットマップとは：**
- 1枚のキャンバスにタグクラスタ+全ノードが最初から全部見える
- ズーム（ピンチ）で情報密度を制御する（LOD: Level of Detail）
- ノードは絶対に動かない。タップで接続線が引かれるだけ
- ViewLevel state machine（"tags" | "nodes" | "explore"）を廃止

**デザイン原則（不変）：**
- 白基調モノクロ。グラデーション/色のモヤ禁止
- タグクラスタの区別 = タグ名テキスト + 薄い正円の囲み
- アニメーション = ease-out のみ。bounce/spring/overshoot 禁止

---

## 全体方針（v5から引き継ぎ）

- 各§完了ごとに `FIX: §N [内容]` プレフィックスでコミット
- 各§完了時に `npx tsc --noEmit` でエラーなしを確認してから次へ
- MOCK_MODE=true のまま。外部API呼び出しゼロ
- CSS custom properties（`var(--xxx)`）のみ使う。ハードコードした色コード禁止
- テキストトーン: 命令しない。提案しない。事実を端的に

---

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `src/lib/graph/layout.ts` | **変更** — クラスタ距離拡大+全ノード初期配置 |
| `src/app/graph/page.tsx` | **全面書き換え** — フラットマップ化 |
| `src/components/graph/breadcrumb.tsx` | **削除** |
| `src/components/graph/detail-panel.tsx` | 変更なし（維持） |
| `src/components/graph/combine-panel.tsx` | 変更なし（維持） |

---

## §1. layout.ts 変更 — 全ノード初期配置

### 変更点

現在の `layoutTagClusters` はクラスタ同士の距離が160pxで、ノード展開後に重なりが起きやすい。フラットマップでは全ノードが最初から見えるため、クラスタ間距離を拡大し、ノード配置も初期計算に含める。

```typescript
import type { GraphNode, TagCluster } from "./types";

// --- 定数 ---
const CLUSTER_DISTANCE = 280;    // クラスタ中心間の距離（v5: 160 → 拡大）
const NODE_DISTANCE = 80;        // クラスタ内ノード間の配置距離
const KNOWLEDGE_DISTANCE = 50;   // 外部知識のノードからの距離
const BASE_R = 22;               // ノードの基本半径

// --- クラスタ配置 ---
// 決定論的な幾何学配置。force simulation は使わない。
export function layoutTagClusters(
  tags: TagCluster[],
  centerX: number,
  centerY: number,
): TagCluster[] {
  if (tags.length === 0) return [];
  return tags.map((tag, i) => {
    const angleDeg = -90 + (360 / tags.length) * i;
    const rad = (angleDeg * Math.PI) / 180;
    const dist = tags.length <= 3 ? CLUSTER_DISTANCE * 0.8 : CLUSTER_DISTANCE;
    return {
      ...tag,
      x: centerX + dist * Math.cos(rad),
      y: centerY + dist * Math.sin(rad),
      r: Math.max(60, 40 + tag.nodeCount * 12),  // v5より大きめ（ノードが中に入る）
    };
  });
}

// --- クラスタ内ノード配置 ---
// クラスタ中心から放射状に全ノードを配置
export function layoutNodesInCluster(
  clusterX: number,
  clusterY: number,
  count: number,
): { x: number; y: number }[] {
  if (count === 0) return [];
  if (count === 1) return [{ x: clusterX, y: clusterY }];
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = -90 + (360 / count) * i;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: clusterX + NODE_DISTANCE * Math.cos(rad),
      y: clusterY + NODE_DISTANCE * Math.sin(rad),
    };
  });
}

// --- 外部知識配置 ---
// フォーカスされたノードの周囲に展開
export function layoutKnowledge(
  nodeX: number,
  nodeY: number,
  count: number,
  existingNodes: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (count === 0) return [];
  const minSep = BASE_R * 2.5;
  for (let attempt = 0; attempt < 3; attempt++) {
    const startAngle = -90 + attempt * 45;
    const dist = KNOWLEDGE_DISTANCE + attempt * 15;
    const positions = Array.from({ length: count }, (_, i) => {
      const angleDeg = startAngle + (360 / count) * i;
      const rad = (angleDeg * Math.PI) / 180;
      return { x: nodeX + dist * Math.cos(rad), y: nodeY + dist * Math.sin(rad) };
    });
    const hasCollision = positions.some((pos) =>
      existingNodes.some((e) => Math.hypot(pos.x - e.x, pos.y - e.y) < minSep)
    );
    if (!hasCollision) return positions;
  }
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = -90 + (360 / count) * i;
    const rad = (angleDeg * Math.PI) / 180;
    return { x: nodeX + (KNOWLEDGE_DISTANCE + 40) * Math.cos(rad), y: nodeY + (KNOWLEDGE_DISTANCE + 40) * Math.sin(rad) };
  });
}

export function calcNodeRadius(connCount: number): number {
  return Math.min(28, BASE_R + connCount * 2);
}

export { CLUSTER_DISTANCE, NODE_DISTANCE, KNOWLEDGE_DISTANCE, BASE_R };
```

commit: `FIX: §1 layout.ts — フラットマップ用レイアウト（クラスタ距離拡大+全ノード初期配置）`

---

## §2. graph/page.tsx 全面書き換え — フラットマップ

### アーキテクチャ変更の要点

| 項目 | v5（旧） | v5.1（新） |
|------|---------|-----------|
| 初期表示 | タグクラスタのみ。ノードは点 | タグクラスタ+全ノードが最初から見える |
| ノード展開 | タグタップ→ノード展開 | 不要。最初から展開済み |
| 探索 | ノードタップ→接続先ノードが追加される | ノードタップ→接続先へ**線が引かれるだけ**。ノード追加なし |
| 外部知識 | 探索時にノード周囲に追加 | タップ時にノード周囲に一時展開。解除で消える |
| ViewLevel | "tags" / "nodes" / "explore" | なし（単一状態） |
| パンくず | あり | **廃止** |
| reset | タグクラスタに戻る | ズームを全体表示に戻す（fit-all） |

### state設計

```typescript
// --- 廃止するstate ---
// viewLevel, activeTag, centerNodeId, expandedNodeIds, breadcrumb → 全削除

// --- 維持するstate ---
const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
const [allConnections, setAllConnections] = useState<Connection[]>([]);
const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

// --- 新規/変更state ---
// 全ノード・全リンク（初期計算で確定、以後変わらない）
const [nodes, setNodes] = useState<GraphNode[]>([]);
const [clusters, setClusters] = useState<TagCluster[]>([]);
// 既存接続のリンク（idea同士のみ。常時表示される薄い線）
const [baseLinks, setBaseLinks] = useState<GraphLink[]>([]);

// フォーカス状態（1ノードのみ。nullなら非フォーカス）
const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
// フォーカス中に一時展開された外部知識ノード
const [knowledgeNodes, setKnowledgeNodes] = useState<GraphNode[]>([]);
const [knowledgeLinks, setKnowledgeLinks] = useState<GraphLink[]>([]);

// combine（維持）
const [combineMode, setCombineMode] = useState(false);
const [combineNodeA, setCombineNodeA] = useState<GraphNode | null>(null);
const [combineResult, setCombineResult] = useState<...>(null);
const [combineLoading, setCombineLoading] = useState(false);

// 詳細パネル
const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
```

### 初期レイアウト計算（useEffect、1回のみ）

```
データ読み込み（allIdeas, allConnections）
  ↓
tags配列構築: Map<string, string[]>（先頭タグでグルーピング）
  ↓
layoutTagClusters() → clusters確定
  ↓
各クラスタ内: layoutNodesInCluster() → 全ノードの x,y 確定 → nodes確定
  ↓
全idea間の接続を走査 → baseLinks確定（idea同士の接続のみ。外部知識は含まない）
  ↓
初期ズームを fit-all に設定（全ノードが画面内に収まるscale）
```

**重要:** この計算は初期1回のみ。ノードの座標は以後変更しない。

### LOD（Level of Detail）描画ルール

d3-zoom の `transform.k`（スケール値）に応じて描画内容を切り替える。

| scale | タグ名 | クラスタ囲み円 | ノード | graph_label | 接続線 |
|-------|--------|--------------|--------|-------------|--------|
| k < 0.5 | 大きく表示 (24px/k) | 表示 stroke:0.5 | 点 r=3 | 非表示 | 非表示 |
| 0.5 ≤ k < 1.0 | やや大きく (16px/k) | 表示 stroke:0.5 | 点→円に遷移 r=BASE_R*0.6 | 非表示 | 薄く表示 opacity:0.15 |
| k ≥ 1.0 | 背景に薄く (opacity:0.15) | 表示 stroke:0.3 | 円 r=calcNodeRadius() | **表示** | 表示 opacity:0.3 |

**実装方法:** zoom イベントハンドラ内で `transform.k` を取得し、各要素の属性を動的に更新する。CSS transitionは使わない（zoomは高頻度イベントのため）。

```typescript
zoom.on("zoom", (event) => {
  g.attr("transform", event.transform);
  const k = event.transform.k;

  // タグラベル
  g.selectAll(".tag-label")
    .attr("font-size", k < 0.5 ? 24 / k : k < 1.0 ? 16 / k : 16)
    .attr("opacity", k >= 1.0 ? 0.15 : 1);

  // ノード円
  g.selectAll(".node-circle")
    .attr("r", (d) => {
      if (k < 0.5) return 3;
      if (k < 1.0) return calcNodeRadius(d.connCount) * 0.6;
      return calcNodeRadius(d.connCount);
    });

  // graph_label
  g.selectAll(".node-label")
    .attr("opacity", k >= 1.0 ? 1 : 0);

  // 接続線
  g.selectAll(".base-link")
    .attr("opacity", k < 0.5 ? 0 : k < 1.0 ? 0.15 : 0.3);
});
```

### SVG構造

```
<svg>
  <g class="canvas">  ← d3-zoom の transform 対象

    <!-- レイヤー1: 接続線（常時表示、LODで opacity 変化） -->
    <g class="layer-links">
      <line class="base-link" ... />  <!-- idea同士の接続 -->
    </g>

    <!-- レイヤー2: フォーカス時の接続線（一時表示） -->
    <g class="layer-focus-links">
      <line class="focus-link" ... />  <!-- フォーカスノードから接続先への強調線 -->
      <line class="knowledge-link" ... />  <!-- フォーカスノードから外部知識への破線 -->
    </g>

    <!-- レイヤー3: クラスタ囲み円 + タグ名 -->
    <g class="layer-clusters">
      <circle class="cluster-circle" ... />
      <text class="tag-label" ... />
    </g>

    <!-- レイヤー4: ノード -->
    <g class="layer-nodes">
      <g class="node-group">
        <circle class="node-hit" r={d.r + 12} fill="transparent" />  <!-- ヒットエリア拡張 -->
        <circle class="node-circle" ... />
        <text class="node-label" ... />  <!-- graph_label -->
      </g>
    </g>

    <!-- レイヤー5: 外部知識ノード（フォーカス時のみ） -->
    <g class="layer-knowledge">
      <g class="knowledge-group">
        <circle ... />
        <text ... />
      </g>
    </g>

  </g>
</svg>
```

### ノードタップ処理

```typescript
const handleNodeTap = useCallback((node: GraphNode) => {
  if (navigator.vibrate) navigator.vibrate(10);

  // --- combineモード中 ---
  if (combineMode && combineNodeA && !node.isKnowledge) {
    // 既存のcombine処理を維持
    return;
  }

  // --- 外部知識ノードタップ ---
  if (node.isKnowledge) {
    setSelectedNode(node);
    return;
  }

  // --- 同じノードを再タップ → 解除 ---
  if (focusedNodeId === node.id) {
    setFocusedNodeId(null);
    setKnowledgeNodes([]);
    setKnowledgeLinks([]);
    setSelectedNode(null);
    return;
  }

  // --- 新しいノードをフォーカス ---
  setFocusedNodeId(node.id);
  setSelectedNode(node);

  // 1. 接続先への線を描画（baseLinksとは別に、focus-linkとして強調表示）
  //    → focusedNodeId の変更を検知してSVG描画が更新される

  // 2. 外部知識を一時展開
  const knowledgeConns = allConnections.filter(
    (c) => c.idea_from_id === node.id && c.connection_type === "external_knowledge"
  ).slice(0, 4);  // 最大4件

  if (knowledgeConns.length > 0) {
    const positions = layoutKnowledge(
      node.x, node.y,
      knowledgeConns.length,
      nodes.map((n) => ({ x: n.x, y: n.y }))
    );
    const kNodes: GraphNode[] = knowledgeConns.map((c, i) => ({
      id: `k-${c.id}`,
      summary: c.external_knowledge_title ?? "",
      graphLabel: "",
      keywords: [],
      tags: [],
      created_at: c.created_at,
      r: 14,
      x: positions[i].x,
      y: positions[i].y,
      isKnowledge: true,
      knowledgeTitle: c.external_knowledge_title ?? "",
      knowledgeDescription: c.external_knowledge_summary ?? "",
      knowledgeUrl: c.external_knowledge_url,
      parentIdeaId: node.id,
      connCount: 0,
    }));
    const kLinks: GraphLink[] = knowledgeConns.map((c) => ({
      id: `kl-${c.id}`,
      sourceId: node.id,
      targetId: `k-${c.id}`,
      connectionType: "knowledge_link" as const,
    }));
    setKnowledgeNodes(kNodes);
    setKnowledgeLinks(kLinks);
  } else {
    setKnowledgeNodes([]);
    setKnowledgeLinks([]);
  }

  // 3. パン: フォーカスノードを画面中央に (600ms ease-out)
  if (svgRef.current && zoomRef.current) {
    const svg = d3.select(svgRef.current);
    const currentTransform = d3.zoomTransform(svgRef.current);
    const tx = d3.zoomIdentity
      .translate(dimensions.width / 2 - node.x * currentTransform.k, dimensions.height / 2 - node.y * currentTransform.k)
      .scale(currentTransform.k);
    svg.transition().duration(600).ease(d3.easeCubicOut).call(zoomRef.current.transform, tx);
  }
}, [focusedNodeId, combineMode, combineNodeA, allConnections, nodes, dimensions]);
```

### フォーカス時のSVG描画（focusedNodeIdの変更で再描画）

```typescript
// layer-focus-links の描画
// focusedNodeId が null なら空。非null なら:

// 1. idea同士の接続線（太め、opacity高め）
const focusLinks = allConnections.filter((c) => {
  if (c.connection_type === "external_knowledge") return false;
  return (c.idea_from_id === focusedNodeId && c.idea_to_id) ||
         (c.idea_to_id === focusedNodeId);
}).map((c) => ({
  sourceId: c.idea_from_id,
  targetId: c.idea_to_id!,
}));

// 描画:
// stroke: #999999, strokeWidth: 1.5, opacity: 0.6
// アニメーション: stroke-dashoffset で線が伸びる演出（800ms ease-out）
//   初期: stroke-dasharray = pathLength, stroke-dashoffset = pathLength
//   最終: stroke-dashoffset = 0

// 2. フォーカスノード自体の強調
// stroke-width: 2, stroke: #222222（他ノードは stroke: #E0E0E0, stroke-width: 0.5）
```

### 背景タップ

```typescript
const handleBackgroundTap = useCallback(() => {
  if (combineMode) {
    setCombineMode(false);
    setCombineNodeA(null);
    return;
  }
  setFocusedNodeId(null);
  setKnowledgeNodes([]);
  setKnowledgeLinks([]);
  setSelectedNode(null);
  setCombineResult(null);
}, [combineMode]);
```

### resetボタン

ヘッダー右上に「reset」テキストボタン。タップで:
1. フォーカス解除（focusedNodeId = null）
2. 外部知識クリア
3. ズームを fit-all に戻す（全ノードが画面内に収まるscale+位置）

```typescript
const handleResetView = useCallback(() => {
  setFocusedNodeId(null);
  setKnowledgeNodes([]);
  setKnowledgeLinks([]);
  setSelectedNode(null);
  setCombineResult(null);
  setCombineMode(false);
  setCombineNodeA(null);

  // fit-all zoom
  if (svgRef.current && zoomRef.current && nodes.length > 0) {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 60;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(dimensions.width / contentW, dimensions.height / contentH, 1.2) * 0.9;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = d3.zoomIdentity
      .translate(dimensions.width / 2 - cx * scale, dimensions.height / 2 - cy * scale)
      .scale(scale);
    const svg = d3.select(svgRef.current);
    svg.transition().duration(400).ease(d3.easeCubicOut).call(zoomRef.current.transform, tx);
  }
}, [nodes, dimensions]);
```

commit: `FIX: §2 graph/page.tsx — フラットマップ化（LODズーム+フォーカス+外部知識一時展開）`

---

## §3. breadcrumb.tsx 削除

`src/components/graph/breadcrumb.tsx` を削除する。
`graph/page.tsx` 内の Breadcrumb import と使用箇所も削除する。

commit: `FIX: §3 breadcrumb削除（フラットマップでは不要）`

---

## §4. CLAUDE.md 更新

ビルド順序セクションを更新:

```markdown
## ビルド順序（v5.1）

REVISION_SPEC_v5_1.md で以下を実行（グラフ画面のみ）:
- §1: layout.ts変更（クラスタ距離拡大+全ノード初期配置）
- §2: graph/page.tsx全面書き換え（フラットマップ+LODズーム+フォーカス）
- §3: breadcrumb.tsx削除
- §4: CLAUDE.md更新

v5の §6-§11 は実装済み。変更不要。
```

commit: `FIX: §4 CLAUDE.md更新`

---

## 品質チェックリスト

### 初期表示（§1-§2）
- [ ] グラフタブ → タグクラスタ+全ノードが最初から見える
- [ ] ピンチアウト（俯瞰）→ タグ名が大きく、ノードは点になる
- [ ] ピンチイン（探索）→ タグ名が薄くなり、graph_labelが表示される
- [ ] LOD遷移がスムーズ（ちらつきなし）

### フォーカス（§2）
- [ ] ノードタップ → そのノードがstroke-width:2で強調される
- [ ] 接続先ノードへ線が伸びるアニメーション（800ms）
- [ ] 外部知識がノード周囲に一時展開（最大4件）
- [ ] 詳細パネルがせり上がる
- [ ] フォーカス外の外部知識は表示されない（点もなし。完全に非表示）
- [ ] 同じノード再タップ → フォーカス解除
- [ ] 背景タップ → フォーカス解除
- [ ] navigator.vibrate(10) がタップ時に発火
- [ ] ヒットエリア拡張（r+12px透明circle）
- [ ] パン/ピンチとタップが競合しない（5px閾値）

### combine（§2）
- [ ] 詳細パネルの「Combine」→ combineモード
- [ ] 他ノードタップ → 2ノード間に太い線+ローダー→結果パネル
- [ ] キャンセル: テキストタップ or 背景タップ

### reset（§2）
- [ ] ヘッダー右上「reset」タップ → フォーカス解除+ズームがfit-allに戻る

### 削除確認（§3）
- [ ] breadcrumb.tsx が削除されている
- [ ] graph/page.tsx に Breadcrumb の import/使用がない
- [ ] TypeScriptエラーなし
