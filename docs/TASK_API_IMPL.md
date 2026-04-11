# TASK: API実装（モック→リアルAPI切り替え）

## 概要

全AIパイプライン（P1〜P5）のモック実装をリアルAPI呼び出しに置き換える。
DB層（mockDb）はそのまま残す。`NEXT_PUBLIC_MOCK_MODE=true`時は従来通りモック動作。

## 前提条件

- プロンプト設計書: `docs/prompts/P2_structuring.md`, `P3_prompts_v3.md`, `P4_deepdive_chat.md`, `P5_combine.md`
- **設計書のプロンプトをそのまま使うこと。勝手に変えない**
- 使用モデル: Gemini 2.5 Flash（P1文字起こし + P3検索）/ Claude Sonnet（P2/P3合成/P4/P5）

## 環境変数（.env.local）

```
GEMINI_API_KEY=         # P1文字起こし + P3 Grounding検索
ANTHROPIC_API_KEY=      # P2構造化 + P3合成 + P4チャット + P5掛け合わせ
```

`BRAVE_SEARCH_API_KEY`は不要になる（Gemini Groundingに移行）。

---

## Step 0: 依存追加

```bash
npm install @google/generative-ai
```

---

## Step 1: Geminiクライアント作成

**新規ファイル: `src/lib/ai/gemini.ts`**

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

// P1: 音声文字起こし
export async function transcribeAudio(audioFile: File): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

  const buffer = await audioFile.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = audioFile.type || "audio/webm";

  const result = await model.generateContent([
    {
      inlineData: { data: base64, mimeType },
    },
    {
      text: "この日本語音声を文字起こししてください。「えーと」「あの」等のフィラーは除去。句読点を適切に入れる。文字起こしのみ出力。",
    },
  ]);

  return result.response.text().trim();
}

// P3: Grounding検索（Scout方式 — 検索結果テキストだけ取得、合成はClaudeで行う）
export async function groundingSearch(query: string): Promise<GroundingResult[]> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }],
  });

  const result = await model.generateContent(query);
  const response = result.response;

  // groundingMetadataから検索結果を抽出
  const metadata = response.candidates?.[0]?.groundingMetadata;
  if (!metadata?.groundingChunks) return [];

  return metadata.groundingChunks
    .filter((chunk: { web?: { uri: string; title: string } }) => chunk.web)
    .slice(0, 3)
    .map((chunk: { web: { uri: string; title: string } }) => ({
      title: chunk.web.title ?? "",
      url: chunk.web.uri ?? "",
      description: "", // groundingChunksにはdescriptionがないので空
    }));
}

// Gemini応答テキストも返す（descriptionの代わりに使える）
export async function groundingSearchWithText(query: string): Promise<{
  text: string;
  sources: GroundingResult[];
}> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }],
  });

  const result = await model.generateContent(query);
  const response = result.response;
  const text = response.text().trim();

  const metadata = response.candidates?.[0]?.groundingMetadata;
  const sources = (metadata?.groundingChunks ?? [])
    .filter((chunk: { web?: { uri: string; title: string } }) => chunk.web)
    .slice(0, 3)
    .map((chunk: { web: { uri: string; title: string } }) => ({
      title: chunk.web.title ?? "",
      url: chunk.web.uri ?? "",
      description: "",
    }));

  return { text, sources };
}

export interface GroundingResult {
  title: string;
  url: string;
  description: string;
}
```

### 注意

- Gemini SDKの型定義は変わりやすい。`googleSearch`ツールやgroundingMetadataの型が合わない場合は `as any` で逃がしてよいが、コメントで理由を残す
- `gemini-2.5-flash`が利用不可の場合は`gemini-2.0-flash`にフォールバック。ただし2.0は2026年6月廃止予定なのでログを出す

---

## Step 2: P1 文字起こし + P2 構造化 実装

**修正ファイル: `src/lib/ai/index.ts`**

### P1 transcribe()

```typescript
export async function transcribe(audio: File): Promise<string> {
  if (MOCK) {
    await delay(2000);
    return MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
  }
  const { transcribeAudio } = await import("./gemini");
  return transcribeAudio(audio);
}
```

### P2 structure()

`docs/prompts/P2_structuring.md`のsystemプロンプトとuserプロンプトをそのまま使う。

```typescript
export async function structure(transcript: string): Promise<Structured> {
  if (MOCK) {
    await delay(1500);
    return MOCK_STRUCTURES[Math.floor(Math.random() * MOCK_STRUCTURES.length)];
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: STRUCTURE_SYSTEM_PROMPT, // docs/prompts/P2_structuring.md の system プロンプト全文
    messages: [{ role: "user", content: `以下の音声メモを構造化してください。\n\n${transcript}` }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  // バリデーション
  if (!parsed.summary || !parsed.keywords || !parsed.graph_label) {
    throw new Error("Structuring output missing required fields");
  }
  if (parsed.graph_label.length > 7) parsed.graph_label = parsed.graph_label.slice(0, 7);
  if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) parsed.tags = ["その他"];

  return {
    summary: parsed.summary,
    keywords: parsed.keywords,
    abstract_principle: parsed.abstract_principle ?? "",
    latent_question: parsed.latent_question ?? "",
    domain: parsed.domain ?? "その他",
    graph_label: parsed.graph_label,
    tags: parsed.tags,
  };
}
```

STRUCTURE_SYSTEM_PROMPTは`docs/prompts/P2_structuring.md`の`## system プロンプト`セクションの```内をそのまま文字列定数にする。**省略や要約をするな。**

---

## Step 3: P3 v5 パイプライン全面書き換え

**修正ファイル: `src/lib/ai/pipeline.ts`**

旧コードを全面置換。P3 v5は3段階パイプライン:

```
プロンプト⓪ ドメイン選択（Claude）
  ↓ 3ドメイン
プロンプト① クエリ生成（Claude）× 3
  ↓ 3クエリ
Gemini Grounding 検索 × 3
  ↓ 各TOP3
プロンプト② 接続合成（Claude）× 3
  ↓ quality_score判定
接続カード 3枚
```

### 3-1. エクスポートインターフェース変更

旧`SEARCH_ANGLES`と`SearchAngle`を廃止。新しいエクスポート:

```typescript
export interface PipelineInput {
  summary: string;
  keywords: string[];
  abstract_principle: string;
  domain: string;
  transcript: string;
  personaId: PersonaId;
  userId: string;
  userProfile?: Record<string, unknown>;
  feedbackHistory?: { positive: string[]; negative: string[] };
}

export interface PipelineOutput {
  title: string;
  description: string;
  source_url: string | null;
  source_title: string | null;
  quality_score: number;
  search_domain: string;
}

export async function generateConnections(input: PipelineInput): Promise<PipelineOutput[]>
```

**`generateConnection`（単数）→`generateConnections`（複数）に変更。** 3枚まとめて返す。

### 3-2. 実装詳細

1. **ドメイン選択（プロンプト⓪）:** `docs/prompts/P3_prompts_v3.md`の「プロンプト⓪ ドメイン選択」のsystem/userをそのまま使う
2. **noveltyバランス:** 3ドメイン中ランダム1つを`familiar_ok`、残り2つを`niche_required`
3. **クエリ生成（プロンプト①）:** 同ファイルの「プロンプト① 検索クエリ生成」をそのまま使う
4. **検索:** `groundingSearchWithText()`を使う。Brave Searchは使わない
5. **合成（プロンプト②）:** 同ファイルの「プロンプト② 接続合成」をそのまま使う
6. **quality_score:** 同ファイルの`calcQualityScore`をそのまま実装。score < 0.5なら1回リトライ（クエリ再生成→再検索→再合成）

### 3-3. 履歴セクション

`buildHistorySection`は現時点ではモック用の空実装でよい:
```typescript
async function buildHistorySection(_userId: string): Promise<string> {
  // TODO: Supabase接続後に実装。直近20件のconnectionsからdomain+titleを取得
  return "";
}
```

### 3-4. Brave Search廃止

`src/lib/search/brave.ts`は削除しない（後方互換）が、pipeline.tsからのimportを消す。

---

## Step 4: ideas/route.ts 修正

**修正ファイル: `src/app/api/ideas/route.ts`**

### 変更点

1. 旧`SEARCH_ANGLES`配列と`SearchAngle`のimportを削除
2. リアルモードの接続生成を`generateConnections`（複数）に変更:

```typescript
// 旧コード（削除）:
// for (let i = 0; i < CONNECTION_COUNT; i++) { ... generateConnection({...searchAngle: SEARCH_ANGLES[i]}) }

// 新コード:
if (!MOCK_MODE) {
  const { generateConnections } = await import("@/lib/ai/pipeline");
  const results = await generateConnections({
    summary: structured.summary,
    keywords: structured.keywords,
    abstract_principle: structured.abstract_principle,
    domain: structured.domain,
    transcript,
    personaId: primaryPersona,
    userId,
  });

  for (const result of results) {
    const conn: Connection = {
      id: crypto.randomUUID(),
      idea_from_id: ideaId,
      idea_to_id: null,
      connection_type: "external_knowledge",
      source: "ai",
      persona_label: result.search_domain,
      reason: result.description,
      action_suggestion: "",
      quality_score: result.quality_score,
      external_knowledge_title: result.title,
      external_knowledge_url: result.source_url,
      external_knowledge_summary: result.description,
      source_idea_summary: null,
      user_note: null,
      feedback: null,
      feedback_at: null,
      bookmarked: false,
      created_at: now,
    };

    // mockDbへの保存は引き続きMOCK_MODEのみ
    send("connection", {
      id: conn.id,
      title: result.title,
      description: result.description,
      source_url: result.source_url,
      source_title: result.source_title,
      quality_score: result.quality_score,
      bookmarked: false,
    });
  }
}
```

3. モック分岐はそのまま残す

---

## Step 5: P4 チャット実装

**修正ファイル: `src/app/api/chat/route.ts`**

`docs/prompts/P4_deepdive_chat.md`のプロンプトを使って実装。

### 変更点

リアルモードブロック（`else`ブロック、現在`send("delta", { content: "リアルモードは未実装です。" })`の箇所）を以下で置換:

```typescript
// リアルモード
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ターン数チェック
const MAX_TURNS = 5;
const existingMsgs = mockDb.chatMessages.listBySession(currentSessionId);
const userMsgCount = existingMsgs.filter(m => m.role === "user").length;

if (userMsgCount >= MAX_TURNS) {
  send("error", { code: "CHAT_LIMIT", message: "このチャットは5ターンで区切りです" });
  send("done", {});
  return;
}

const currentTurn = userMsgCount + 1;

// context取得（接続カード+元メモ情報）
// contextオブジェクトから memo, connection を取得
const systemPrompt = buildDeepDiveSystemPrompt(context, currentTurn);

// 会話履歴構築
const history = existingMsgs.map(m => ({
  role: m.role as "user" | "assistant",
  content: m.content,
}));
history.push({ role: "user", content: message });

// ストリーミング
const stream = anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 800,
  system: systemPrompt,
  messages: history,
});

let fullResponse = "";
for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    fullResponse += event.delta.text;
    send("delta", { content: fullResponse });
  }
}

// AI応答保存
mockDb.chatMessages.insert({
  id: crypto.randomUUID(),
  session_id: currentSessionId,
  role: "assistant",
  content: fullResponse,
  created_at: new Date().toISOString(),
});
```

`buildDeepDiveSystemPrompt`関数は`P4_deepdive_chat.md`のsystemプロンプトをそのまま使う。`${context.memo.summary}`等のテンプレート変数はcontextオブジェクトから埋める。

### 初期メッセージ生成

新規セッション作成時（`!currentSessionId && context`のブロック）で、リアルモード時はP4の初期メッセージ生成プロンプトを呼ぶ:

```typescript
if (!MOCK_MODE) {
  const initialMsg = await generateInitialMessage(context);
  // initialMsg = { greeting, questions }
  // これをJSON文字列ではなくフォーマットされたテキストとして保存
  const formatted = `${initialMsg.greeting}\n\n${initialMsg.questions.map(q => `・${q.text}`).join("\n")}`;
  // 以下、formattedをassistantメッセージとして保存・送信
}
```

---

## Step 6: P5 掛け合わせ実装

**修正ファイル: `src/app/api/combine/route.ts`**

`docs/prompts/P5_combine.md`のプロンプトを使って実装。

### 変更点

リアルモードブロック:

```typescript
if (!MOCK_MODE) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: COMBINE_SYSTEM_PROMPT, // P5_combine.md の system プロンプト全文
    messages: [{
      role: "user",
      content: buildCombineUserPrompt(ideaA, ideaB),
    }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  result = JSON.parse(jsonStr);
}
```

### Connectionの新フィールド

P5出力には`collision_type`と`try_this`がある。Connectionの型を拡張:

**修正ファイル: `src/lib/types.ts`**

```typescript
export interface Connection {
  // ...既存フィールド...
  collision_type?: string;    // 追加: "same"|"opposite"|"cause"|"solve"|"emerge"
  try_this?: string;          // 追加: 掛け合わせのアクション提案
  search_domain?: string;     // 追加: P3のドメイン選択結果
}
```

combine/route.tsのConnection作成時に `collision_type: result.collision_type`, `try_this: result.try_this` を追加。

---

## やらないこと

- Supabase接続（mockDb据え置き）
- UIの変更
- .env.localへの実際のキー記入
- Brave Searchの削除（ファイルは残す）
- テストコード

## 検証方法

1. `NEXT_PUBLIC_MOCK_MODE=true`でビルドが通ることを確認（既存動作が壊れない）
2. TypeScriptエラーがないことを確認（`npx tsc --noEmit`）
3. `NEXT_PUBLIC_MOCK_MODE=false` + APIキー設定 で各エンドポイントが動くことは手動テスト

## コミットメッセージ

```
feat: P1-P5 リアルAPI実装（Gemini transcribe/grounding + Claude structure/connect/chat/combine）
```
