# タスク指示書: v5.1 グラフ画面フラットマップ化

## 読む順番

1. `CLAUDE.md`（プロジェクト全体ルール）
2. `docs/DESIGN_v2.md`（デザイン原則）
3. **`docs/REVISION_SPEC_v5_1.md`**（今回の実行仕様書）

## 何をやるか

v5で実装したグラフ画面の「Level 1→2→3 の3段階方式」を、**フラットマップ方式**に全面書き換える。

**フラットマップ = 1枚のキャンバスにタグクラスタ+全ノードが最初から全部見えている。ズームで情報密度が変わる。ノードは絶対に動かない。**

グラフ画面以外（チャット、録音結果、ホーム、メモ詳細）は v5 実装済みのまま一切触らない。

## 実行手順

### §1. `src/lib/graph/layout.ts` を書き換え

- `REVISION_SPEC_v5_1.md` の §1 に記載のコードで**全体を置き換え**
- 関数: `layoutTagClusters`（クラスタ距離280に拡大）、`layoutNodesInCluster`（新規）、`layoutKnowledge`（新規）、`calcNodeRadius`（維持）
- `layoutSatellites` と `layoutWithCollisionAvoidance` は削除（使わなくなる）
- commit: `FIX: §1 layout.ts — フラットマップ用レイアウト`

### §2. `src/app/graph/page.tsx` を全面書き換え

これが本体。`REVISION_SPEC_v5_1.md` の §2 を忠実に実装する。

**廃止するもの:**
- `ViewLevel` type と `viewLevel` state
- `activeTag`, `centerNodeId`, `expandedNodeIds` state
- `breadcrumb` state と `<Breadcrumb>` コンポーネントの使用
- `expandTag()`, `expandNode()` 関数
- `handleBreadcrumbTap()` 関数

**新しいアーキテクチャ:**
- 初期表示で全ノードの座標を1回だけ計算して固定
- `focusedNodeId` で1ノードのフォーカス状態を管理
- フォーカス時: 接続先へ線が伸びる + 外部知識が一時展開 + 詳細パネル表示
- フォーカス解除: 背景タップ or 同ノード再タップ → 線と外部知識が消える
- LODズーム: `transform.k` に応じてタグ名/ノード/ラベル/接続線の表示を動的切替

**LOD閾値（必ずこの通りに実装）:**

| scale k | タグ名 | ノード | graph_label | 接続線 |
|---------|--------|--------|-------------|--------|
| k < 0.5 | 大きく (24/k px) | 点 r=3 | 非表示 | 非表示 |
| 0.5 ≤ k < 1.0 | やや大 (16/k px) | 小円 r=BASE_R*0.6 | 非表示 | 薄く opacity:0.15 |
| k ≥ 1.0 | 背景に薄く opacity:0.15 | 通常 r=calcNodeRadius() | **表示** | 表示 opacity:0.3 |

**フォーカス時の接続線アニメーション:**
- stroke-dasharray = pathLength, stroke-dashoffset を pathLength → 0 に 800ms ease-out
- stroke: #999999, strokeWidth: 1.5

**SVGレイヤー構造（この順番で重ねる）:**
1. layer-links（常時表示の接続線、LODでopacity変化）
2. layer-focus-links（フォーカス時の強調線+外部知識への破線）
3. layer-clusters（クラスタ囲み円+タグ名）
4. layer-nodes（全ノード）
5. layer-knowledge（フォーカス時のみの外部知識ノード）

**resetボタン:**
- ヘッダー右上に「reset」テキスト
- タップ → フォーカス解除 + ズームをfit-all（全ノードが画面に収まる）
- fit-all計算: 全ノードのx,y min/maxから余白60pxとってscale算出

**detail-panel, combine-panel は変更なし。** import して使うだけ。

- commit: `FIX: §2 graph/page.tsx — フラットマップ化`

### §3. `src/components/graph/breadcrumb.tsx` を削除

- ファイルを削除
- graph/page.tsx から import と使用箇所が除去されていることを確認（§2で既に除去済みのはず）
- commit: `FIX: §3 breadcrumb削除`

### §4. CLAUDE.md 更新

ビルド順序セクションに v5.1 を追記:

```markdown
## ビルド順序（v5.1）

REVISION_SPEC_v5_1.md で以下を実行（グラフ画面のみ）:
- §1: layout.ts変更（クラスタ距離拡大+全ノード初期配置）
- §2: graph/page.tsx全面書き換え（フラットマップ+LODズーム+フォーカス）
- §3: breadcrumb.tsx削除
- §4: CLAUDE.md更新

v5の §6-§11 は実装済み。変更不要。
```

- commit: `FIX: §4 CLAUDE.md更新`

## 絶対に守ること

1. **各§完了後に `npx tsc --noEmit` を実行。** TypeScriptエラーが1つでもあれば次に進まない
2. **MOCK_MODE=true のまま。** 外部API呼び出しゼロ
3. **CSS custom properties のみ使う。** ハードコードした色コード（#FAFAFA等）は禁止。var(--xxx) を使う
4. **v5で実装済みの §6-§11（チャット、録音結果、ホーム、メモ詳細）には触らない**
5. **ノードは絶対に動かさない。** ドラッグでノード位置を変える機能は入れない
6. **force simulation は使わない。** 座標は幾何学計算で決定論的に確定させる
7. **アニメーションは ease-out のみ。** bounce/spring/overshoot 禁止
8. **コミットメッセージは `FIX: §N [内容]` プレフィックス**

## 完了条件

- [ ] グラフタブを開くと、タグクラスタ+全ノードが最初から見える
- [ ] ピンチアウト → タグ名が大きく、ノードは点に
- [ ] ピンチイン → タグ名が薄くなり、graph_labelが出る
- [ ] ノードタップ → 接続先へ線が伸びる + 外部知識が周囲に展開 + 詳細パネル
- [ ] 背景タップ or 同ノード再タップ → フォーカス解除、線と外部知識消える
- [ ] combine が動く（詳細パネル→Combine→他ノードタップ→結果）
- [ ] reset → フォーカス解除 + ズームfit-all
- [ ] breadcrumb.tsx が削除されている
- [ ] `npx tsc --noEmit` エラーなし
- [ ] `npm run build` エラーなし
