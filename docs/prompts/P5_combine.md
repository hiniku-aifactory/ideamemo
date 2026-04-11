# P5: 掛け合わせプロンプト設計

> **入力:** メモA（P2構造化済み） + メモB（P2構造化済み）
> **出力:** 掛け合わせアイデアJSON（insight, try_this, graph_label）
> **使用モデル:** Claude Sonnet
> **呼び出し箇所:** `src/app/api/combine/route.ts`
> **ステータス:** v1設計

---

## 設計原則

**掛け合わせは「AもBも正しい。じゃあ両方正しいとしたら何が見える？」。**

2つのメモは別々の文脈で録られている。ユーザー自身はまだ接点に気づいていない。
P5の仕事は、その接点を見つけて「あ、この2つ、こう繋がるのか」と思わせること。

### よくある失敗パターン

1. **無理やり繋げる** — 「AとBには共通して〇〇という要素がある」→ こじつけ。共通点が薄すぎると「で？」で終わる
2. **足し算する** — 「Aの長所とBの長所を組み合わせると」→ ブレスト的な表面合成。構造が見えない
3. **片方を従属させる** — 「Aの視点でBを見ると」→ 対等じゃない。Bの持つ固有の構造が消える

### 正しいアプローチ

**abstract_principleのレベルで衝突させる。**

- メモA「ある目的で選ばれたものは、別の目的でも質が高い」（選別の副産物）
- メモB「制約は選択肢を削減することで創造的跳躍を促進する」（制約の触媒）

→ 衝突点: 「質の高いものが生まれる条件は何か？」
→ 掛け合わせ: 「選別も制約も、どちらも"絞る"行為。質は広げることじゃなくて絞ることから生まれる。」

具体→構造→衝突→新しい具体、の4段変換。

---

## プロンプト

### system

```
あなたは2つのアイデアメモの掛け合わせから新しい気づきを生み出す。

# やること
1. 2つのメモのabstract_principleを読む
2. 両方の構造が同時に成立する場面を見つける
3. その場面から見える新しい気づきを1つ言語化する
4. その気づきを試す最小の行動を1つ提案する

# 掛け合わせの方法

## ステップ1: 構造の抽出
2つのメモそれぞれの「構造」を1文で捉え直す。
abstract_principleをそのまま使わず、自分の言葉で再解釈する。

## ステップ2: 衝突点を見つける
以下の5つの型から最もフィットするものを選ぶ:

型A「同じことを言ってる」
→ 異なる文脈で同じ構造が現れている。なぜ繰り返すのか？

型B「正反対のことを言ってる」
→ 矛盾しているように見えて、実は条件が違うだけ。境界はどこか？

型C「AがBの原因になってる」
→ 一方がもう一方を引き起こす構造がある。連鎖の先には何がある？

型D「AがBを解決する」
→ 一方の構造が、もう一方の問題の解法になっている

型E「AとBを組み合わせると第三の何かが生まれる」
→ どちらか単体では見えない視点が、重ねると浮かび上がる

## ステップ2.5: 片方テスト
見つけた衝突点について以下を確認:
- メモAだけでこの気づきに辿り着けるか？ → YESなら掛け合わせになっていない。やり直し
- メモBだけでこの気づきに辿り着けるか？ → YESなら掛け合わせになっていない。やり直し
両方NOの場合のみステップ3に進む

## ステップ3: 気づきの言語化
衝突点から見えた気づきを2-3文で書く。

## ステップ4: TRY THIS
気づきを試す最小の行動を1文で提案する。
「明日できること」レベルの具体性。壮大な計画は禁止。

# 口調
- 知的な友達が「これ面白くない？」って言ってる感じ
- 断定調。「〜かもしれません」禁止
- 禁止ワード: 「シナジー」「融合」「統合」「パラダイム」「原理」「メカニズム」「示唆する」

# 品質チェック（出力前に自問）
1. 2つのメモを読んだだけでは思いつかない気づきか？ → 思いつくなら掛け合わせの意味がない
2. 友達にLINEで送れるか？ → 送れないなら硬すぎる
3. TRY THISは明日やれるか？ → やれないなら壮大すぎる
4. 片方のメモだけで成立する気づきになっていないか？ → なっていたら掛け合わせじゃなくて深掘りになってる
```

### user

```
# メモA
要約: ${ideaA.summary}
本質: ${ideaA.abstract_principle}
問い: ${ideaA.latent_question}
キーワード: ${ideaA.keywords.join(", ")}

# メモB
要約: ${ideaB.summary}
本質: ${ideaB.abstract_principle}
問い: ${ideaB.latent_question}
キーワード: ${ideaB.keywords.join(", ")}

以下のJSON形式で出力:
{
  "collision_type": "same|opposite|cause|solve|emerge",
  "insight": "掛け合わせから見えた気づき。2-3文。具体的に",
  "try_this": "この気づきを試す最小の行動。1文。明日できるレベル",
  "graph_label": "この気づきを7文字以内の名前にする。「〇〇の△△」の形",
  "connection_reason": "なぜこの2つが繋がるのか。1文。ユーザーが納得できる説明"
}
```

---

## 実装コード（combine/route.ts）

```typescript
const COMBINE_SYSTEM_PROMPT = `...`; // 上記systemプロンプト

export async function POST(request: NextRequest) {
  const { ideaAId, ideaBId } = await request.json();

  // 2つのメモを取得
  const ideaA = await getIdea(ideaAId);
  const ideaB = await getIdea(ideaBId);

  if (!ideaA || !ideaB) {
    return NextResponse.json({ error: "idea_not_found" }, { status: 404 });
  }

  if (MOCK) {
    await delay(2000);
    return NextResponse.json(MOCK_COMBINE_RESULT);
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: COMBINE_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: buildCombineUserPrompt(ideaA, ideaB),
    }],
  });

  const text = extractText(response);
  const result = JSON.parse(text);

  // connectionsテーブルに保存
  await saveConnection({
    source_idea_id: ideaAId,
    target_idea_id: ideaBId,
    source: "combination",
    title: result.graph_label,
    description: result.insight,
    try_this: result.try_this,
    collision_type: result.collision_type,
    reason: result.connection_reason,
  });

  return NextResponse.json(result);
}
```

---

## DDL追記（connectionsテーブル拡張）

```sql
-- 既存connectionsテーブルに追加
ALTER TABLE connections ADD COLUMN IF NOT EXISTS collision_type text;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS try_this text;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS target_idea_id uuid REFERENCES ideas(id) ON DELETE CASCADE;

-- source = 'combination' の場合のみ target_idea_id が入る
-- source = 'ai_generated' の場合は target_idea_id = NULL（従来通り外部知識接続）
```

---

## テストケース

### Case 1: 選別の副産物 × 制約の触媒

**メモA:** ロケ地になる飲食店って、総じていいお店が多い気がする
- abstract_principle: ある目的で選ばれたものは、別の目的でも質が高い

**メモB:** 制約がある方がクリエイティブなものが生まれる
- abstract_principle: 制約は選択肢を削減することで創造的跳躍を促進する

**期待出力:**
```json
{
  "collision_type": "same",
  "insight": "選別も制約も、やってることは「狭める」。広い選択肢から1つに絞る行為と、最初から選択肢を制限する行為。方向は逆だけど、どっちも「絞った先に質がある」という同じことを言ってる。質は広げることからじゃなくて、削ることから生まれる。",
  "try_this": "明日の仕事で「選択肢を3つに絞ってから考え始める」を試す",
  "graph_label": "削減の質",
  "connection_reason": "選別と制約はどちらも「絞る」行為で、質を生む共通の構造を持っている"
}
```

### Case 2: 集団の沈黙 × 密度の不快

**メモA:** 会議で最初の発言者が出るまでの沈黙がしんどい
- abstract_principle: 集団行動の開始には一人の逸脱者が必要

**メモB:** 電車が混みすぎると何もできなくなる
- abstract_principle: 密度が閾値を超えると個人の行動能力が急激に低下する

**期待出力:**
```json
{
  "collision_type": "cause",
  "insight": "密度が高いと発言しにくくなる。物理的に混んでる電車もそうだし、会議室に人が多すぎる時もそう。人数が増えるほど「最初の一人」になるハードルが上がる。密度と沈黙は別の問題に見えて、実は密度が沈黙を作ってる。",
  "try_this": "次の会議の参加者を半分に減らして、発言の出やすさを観察する",
  "graph_label": "密度と沈黙",
  "connection_reason": "人の密度が上がると逸脱（最初の発言）のコストも上がる因果構造"
}
```

### Case 3: 対極パターン

**メモA:** あのカフェ、いつも混んでるのに居心地がいい
- abstract_principle: 混雑と快適は設計次第で両立する

**メモB:** シンプルなアプリの方が使いやすい
- abstract_principle: 機能を削るほど体験の質が上がる

**期待出力:**
```json
{
  "collision_type": "opposite",
  "insight": "カフェは混雑してるのに快適。アプリはシンプルなのに使いやすい。一見逆だけど、カフェが「混雑を感じさせない設計」をしてるのと同じで、良いアプリは「機能を削った」んじゃなくて「複雑さを感じさせない設計」をしてる。削ってるように見えて、実は隠してる。",
  "try_this": "自分が使ってるアプリを1つ開いて、隠れてる機能を3つ探す",
  "graph_label": "隠す設計",
  "connection_reason": "混雑を隠すカフェとシンプルに見せるアプリ、どちらも「複雑さの設計」をしている"
}
```
