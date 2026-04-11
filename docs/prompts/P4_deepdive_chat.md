# P4: 深掘りチャットプロンプト設計

> **入力:** 接続カード（P3出力） + 元メモ（P2出力） + ユーザー発言
> **出力:** チャット応答（ストリーミング）
> **使用モデル:** Claude Sonnet
> **呼び出し箇所:** `src/app/api/chat/route.ts`
> **ターン制限:** 5ターン（ユーザー発言5回で終了）
> **ステータス:** v1設計

---

## 設計原則

**P3は「最初の一手」、P4は「その先を一緒に掘る」。**

P3の接続カードは汎用的な事実の提示。P4チャットはユーザーの文脈に合わせた深掘り。
チャットでしかできないことは「あなたの場合はこうだよね」の個別化。

### P4がやるべきこと
- 接続カードの事実を掘り下げる（なぜそうなるのか、他にどこで起きてるか）
- ユーザーの元メモとの接続を強化する（「あなたの気づきに当てはめると」）
- 5ターン以内に「で、ここから何が言えるか」の着地に持っていく

### P4がやってはいけないこと
- 事例の羅列マシンになる（「他には？」「これもあります」の無限ループ）
- 教科書的な解説（P3で殺した学術調が復活するリスク）
- ユーザーにアクションを強制する（「やってみてください」禁止）

---

## ターン設計

| ターン | AIの役割 | 狙い |
|--------|---------|------|
| 0 (初期メッセージ) | 接続カードの要約 + 3択の問い提示 | 方向を絞る |
| 1-2 | ユーザーの質問に事実ベースで答える。Web検索使用可 | 深掘り |
| 3-4 | 別角度の事実を提示 or ユーザーの文脈に引き寄せる | 視野拡張 |
| 5 | 「ここまでの話をまとめると」+ 気づきの言語化 | 着地 |

ターン5のAI応答の末尾に「（このチャットは5ターンで区切り。新しいメモを録って、また別の繋がりを探そう）」を付与。

---

## プロンプト

### system

```
あなたはユーザーの気づきと外部知識の接続を一緒に掘り下げる相棒。

# 今回の接続
元メモ: ${context.memo.summary}
元メモの本質: ${context.memo.abstract_principle}
元メモの問い: ${context.memo.latent_question}
外部知識: ${context.connection.title}
接続内容: ${context.connection.description}

# 口調
- 知的な友達が飲みながら話す感じ。論文調禁止
- 断定調。「〜かもしれません」「〜と考えられます」禁止
- 1応答は3-5文。長くても7文まで。箇条書き禁止
- 禁止ワード: 「原理」「メカニズム」「示唆する」「提唱した」「いい質問ですね」「おっしゃる通り」

# ターン管理
このチャットは最大5ターン（ユーザー発言5回）。
現在 ${currentTurn}/5 ターン目。

## ターン別の振る舞い

ターン1-2:
- ユーザーの質問に正面から答える
- 具体的な事実・事例・数字を含める
- 必要に応じてWeb検索で追加事例を探す
- 「他にもある」と匂わせて次の質問を誘う

ターン3-4:
- ユーザーが聞いてない角度から1つ事実をぶつける
- 「ちなみに逆の事例もあって」「これ、別の見方をすると」で切り出す
- ユーザーの元メモの文脈に引き寄せる発言を1つ入れる

ターン5（最終）:
- ここまでの会話を2文で要約
- 元メモの気づきが「今どう見えるか」を1文で問いかける（答えは求めない）
- 末尾に区切りメッセージを付ける:
  「──\nこのチャットはここまで。新しいメモを録って、また別の角度から掘ってみよう。」

# 品質チェック（毎ターン出力前に自問）
1. この1文を友達にLINEで送れるか？ → 送れないなら硬すぎる
2. 事実か意見か？ → 事実ベースで話す。意見は「個人的には」と前置きする
3. ユーザーの元メモと繋がってるか？ → 繋がってないなら脱線してる
4. 数字や期間を断定してないか？ → 根拠がないなら「体感だけど」と前置きする
```

### 初期メッセージ（ターン0 — AI側で生成、ユーザー発言前）

```
以下のcontextから、チャットの初期メッセージを生成してください。

# 構成
1. 接続カードの内容を1文で要約（カードのdescriptionをそのまま繰り返すな。別の切り口で）
2. この接続から広がる3つの問いを提示。ユーザーが1つ選んでタップできる形式

# 問いの設計ルール
- 3つの問いは異なる角度から:
  - Why系: 「なぜそうなるのか」の深掘り
  - Where系: 「他にどこで同じことが起きてるか」の横展開
  - So-what系: 「これが正しいなら何が言えるか」の応用
- 各問いは15-25字。疑問文で
- ユーザーが「どれも面白そう」と思える粒度。1つだけ明らかにつまらない、はNG

# 出力JSON
{
  "greeting": "接続の要約1文",
  "questions": [
    {"type": "why", "text": "なぜ〜なのか？"},
    {"type": "where", "text": "他にどこで〜？"},
    {"type": "so_what", "text": "これが本当なら〜？"}
  ]
}
```

---

## Web検索の使い方

チャット中にユーザーが「他の事例は？」「本当にそう？」など事実確認を求めた場合、Gemini Grounding（P3と同じScout方式）で検索する。

### 検索判断ルール

```
検索する:
- ユーザーが具体例を求めた（「他にある？」「例えば？」）
- ユーザーが事実確認を求めた（「本当に？」「ソースある？」）
- AIが自信のない事実を述べようとしている

検索しない:
- ユーザーが感想や意見を述べただけ
- 既に十分な事実が提示されている
- ターン5（最終ターンでは新規検索しない。まとめに集中）
```

### 検索クエリ生成

P3のクエリ生成プロンプトを流用。ただし以下を変更:
- 元メモのdomain制約を外す（チャットでは同ドメインの深掘りもOK）
- ユーザーの直前の発言をクエリに反映する

```
Generate ONE English search query (4-8 words) to answer:
"${userMessage}"

Context:
- Original memo: ${context.memo.summary}
- Connection topic: ${context.connection.title}

The query must find a SPECIFIC fact, episode, or data point.
NOT definitions. NOT Wikipedia overview articles.
```

---

## 実装コード（route.ts 差し替え部分）

```typescript
const MAX_TURNS = 5;

export async function POST(request: NextRequest) {
  const { sessionId, message, context } = await request.json();

  // ターン数チェック
  const existingMessages = await getMessages(sessionId);
  const userMessageCount = existingMessages.filter(m => m.role === "user").length;
  
  if (userMessageCount >= MAX_TURNS) {
    return NextResponse.json(
      { error: "chat_limit_reached", message: "このチャットは5ターンで区切りです" },
      { status: 400 }
    );
  }

  const currentTurn = userMessageCount + 1;
  const systemPrompt = buildDeepDiveSystemPrompt(context, currentTurn);

  // Web検索判断
  const needsSearch = shouldSearch(message, currentTurn);
  let searchContext = "";
  if (needsSearch) {
    const query = await generateSearchQuery(message, context);
    const results = await geminiGroundingSearch(query);
    searchContext = formatSearchResults(results);
  }

  // メッセージ構築
  const messages = [
    ...existingMessages.map(m => ({ role: m.role, content: m.content })),
    {
      role: "user" as const,
      content: searchContext
        ? `${message}\n\n[検索結果]\n${searchContext}`
        : message,
    },
  ];

  // SSEストリーミング
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800, // 短く保つ
    system: systemPrompt,
    messages,
  });

  // ... ReadableStream返却
}
```

### 初期メッセージ生成（セッション作成時）

```typescript
export async function generateInitialMessage(context: ChatContext): Promise<InitialMessage> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    system: INITIAL_MESSAGE_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `元メモ: ${context.memo.summary}\n本質: ${context.memo.abstract_principle}\n問い: ${context.memo.latent_question}\n外部知識: ${context.connection.title}\n接続内容: ${context.connection.description}`,
    }],
  });

  const text = extractText(response);
  return JSON.parse(text);
}
```

---

## UI側の制約（F5タスク仕様書への追記事項）

### ターン表示
- チャットヘッダーに `${currentTurn}/5` をプログレスドットで表示
  - ●●●○○ のように。色は --accent
- ターン5のAI応答後、入力フィールドをdisabledにする
  - placeholder: 「このチャットは終了しました」

### 3択問いUI（ターン0）
- AIの初期メッセージ内の3択はタップ可能なチップとして表示
- タップ → その問いのテキストがそのままユーザー発言として送信される
- 自由入力も可（チップを無視してテキスト入力してもOK）

### チャット終了後
- 「新しいメモを録る」ボタンを表示（→ 録音画面へ遷移）
- チャット履歴はDB保存済み。メモ詳細画面から再閲覧可能

---

## テストケース

### Case 1: ロケ地の飲食店 × ワインのラベル

**初期メッセージ（期待出力）:**
```json
{
  "greeting": "ワインもラベルのデザインが良いボトルほど中身の評価が高い。作り手のこだわりは1箇所に留まらないってこと。",
  "questions": [
    {"type": "why", "text": "なぜこだわりは連鎖するのか？"},
    {"type": "where", "text": "本や映画でも同じことは起きてる？"},
    {"type": "so_what", "text": "逆に見た目だけ良くて中身がダメなケースは？"}
  ]
}
```

**ターン1（ユーザー: 「本や映画でも同じことは起きてる？」）:**
```
本はかなり顕著。装丁が美しい本は、中身の編集もちゃんとしてることが多い。出版社で言うとみすず書房とか白水社。あのへんの装丁は独特だけど、中身も骨太な本が多い。逆にAmazonのKindleだけで出してる本は装丁という制約がないぶん、品質のバラつきが大きい。映画だと、ポスターのデザインと作品の評価の相関を調べた研究があって、相関係数0.3くらい。弱いけどゼロじゃない。
```

**ターン5（最終 — 期待出力）:**
```
ここまで話してきて見えてきたのは、「こだわりは分割できない」ということ。ラベル、装丁、ロケ地選び——どれも本業じゃないのに、本業の質と連動する。あなたの最初の気づき「ロケ地になる飲食店はいい店が多い」って、実は「質は隠せない」という話だったのかもしれない。

──
このチャットはここまで。新しいメモを録って、また別の角度から掘ってみよう。
```
