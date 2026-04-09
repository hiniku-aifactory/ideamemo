# REVISION SPEC v3 — UI一貫性 + 外部知識改善 + バグ修正

## 変更一覧

| § | 内容 | 工数 |
|---|------|------|
| §0 | バグ修正: 外部知識を常に3件出す | 小 |
| §1 | 共通ヘッダーコンポーネント（ハンバーガー常時表示 + 戻るボタン一貫性） | 中 |
| §2 | タブバー: 録音ボタン拡大 + 録音中は停止ボタンに変化 | 中 |
| §3 | タイポグラフィ: 太字追加で視認性改善 | 小 |
| §4 | 外部知識プロンプト全面改修（固定3角度 + 意外性） | 中 |
| §5 | モックデータ更新（新プロンプト形式に合わせる） | 小 |
| §6 | 横断適用 + 検証 | 小 |

---

## §0: バグ修正 — 外部知識を常に3件出す

**対象:** `src/app/api/ideas/route.ts`

**問題:** L93 `const connectionCount = Math.min(personas.length, CONNECTION_COUNT)` でペルソナ数が1だと外部知識が1件しか出ない。

**修正:**
```typescript
// 旧
const connectionCount = Math.min(personas.length, CONNECTION_COUNT);
for (let i = 0; i < connectionCount; i++) {
  // ...
  connResult = await generateConnection({ ... }, personas[i]);
}

// 新: 常に3件。角度はSEARCH_ANGLESで固定、ペルソナはpromptInstructionのバイアスとして使用
const SEARCH_ANGLES = ["business_model", "psychology", "cross_domain"] as const;
const primaryPersona = personas[0] ?? "builder";

for (let i = 0; i < CONNECTION_COUNT; i++) {
  if (MOCK_MODE) {
    connResult = await discoverConnectionSingle(i);
  } else {
    const { generateConnection } = await import("@/lib/ai/pipeline");
    connResult = await generateConnection({
      summary: structured.summary,
      keywords: structured.keywords,
      abstract_principle: structured.abstract_principle,
      transcript,
      searchAngle: SEARCH_ANGLES[i],
      personaId: primaryPersona,
    });
  }
  // ...
}
```

**対象:** `src/lib/ai/index.ts`
- `discoverConnectionSingle` の引数から `_personas` を削除（indexのみ）
- PERSONA_LABELSをANGLE_LABELSに変更:
  ```typescript
  const ANGLE_LABELS = ["仕組みの視点", "人の心の視点", "異分野の視点"];
  ```

commit: `FIX: §0 外部知識を常に3件出す（ペルソナ数に依存しない）`

---

## §1: 共通ヘッダーコンポーネント

**新規:** `src/components/app-header.tsx`

現状の問題:
- ハンバーガーメニューがホーム画面にしかない
- 戻るボタンの有無がページごとにバラバラ
- 各ページでBackArrow SVGを重複定義している

**Props:**
```typescript
interface AppHeaderProps {
  showBack?: boolean;     // デフォルト false
  title?: string;         // 中央テキスト（省略可）
  rightContent?: React.ReactNode;  // 右側カスタム要素（省略時はハンバーガー）
}
```

**レイアウト:**
```
[← (条件付き)]  [title (optional)]  [≡ ハンバーガー (常時)]
```

**ハンバーガーメニュー項目:**
1. **Folders** → /folders
2. **Bookmarks** → /bookmarks （新規ページ、§6で簡易実装）
3. **Settings** → /settings
4. **About** → /about （新規ページ、§6で簡易実装）

**メニュースタイル:**
- 背景: var(--bg-secondary)
- border: 0.5px solid var(--border-light)
- 項目: text-[13px], color: var(--text-body), py-2.5 px-4
- 項目間セパレーター: 0.5px solid var(--border-light)
- 外側タップで閉じる

**戻るボタンルール:**
| ページ | showBack | 理由 |
|--------|----------|------|
| / (ホーム) | false | トップレベル |
| /graph | false | トップレベル |
| /record | true | 録音中止 or 結果から戻る |
| /memo/[id] | true | メモ詳細から戻る |
| /settings | true | 設定から戻る |
| /folders | true | フォルダ一覧から戻る |
| /folders/[name] | true | フォルダ詳細から戻る |
| /chat | true | チャットから戻る |
| /bookmarks | true | ブックマークから戻る |
| /about | true | Aboutから戻る |

**各ページの修正:**
- `src/app/page.tsx`: GeometricLogo + メニュー部分を削除 → `<AppHeader title={`${ideas.length} memos`} />` に置換。ロゴはAppHeader左側に移動
- `src/app/record/page.tsx`: BackArrow定義を削除 → `<AppHeader showBack />` に置換
- `src/app/memo/[id]/page.tsx`: BackArrow定義を削除 → `<AppHeader showBack />` に置換
- `src/app/settings/page.tsx`: BackArrow + header部分を削除 → `<AppHeader showBack title="Settings" />` に置換
- `src/app/folders/page.tsx`: header部分を削除 → `<AppHeader showBack title="Folders" />` に置換
- `src/app/folders/[name]/page.tsx`: → `<AppHeader showBack title={folderName} />` に置換
- `src/app/graph/page.tsx`: ヘッダー部分を → `<AppHeader />` に置換（フィルタ等はAppHeaderの下に別途配置）
- `src/app/chat/page.tsx`: → `<AppHeader showBack />` に置換

commit: `FIX: §1 共通ヘッダー + ハンバーガー常時表示 + 戻るボタン一貫性`

---

## §2: タブバー改修

**対象:** `src/components/tab-bar.tsx`

### 録音ボタン拡大
```typescript
// 旧: width="40" height="40"
// 新: width="56" height="56"
function RecordIcon({ recording }: { recording: boolean }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="27" stroke="#222222" strokeWidth="1" />
      {recording ? (
        // 録音中: 停止アイコン（角丸四角）
        <rect x="20" y="20" width="16" height="16" rx="2" fill="#222222" />
      ) : (
        // 待機中: 録音アイコン（塗り円）
        <circle cx="28" cy="28" r="10" fill="#222222" />
      )}
    </svg>
  );
}
```

### 録音状態の共有

**新規:** `src/components/recording-context.tsx`
```typescript
"use client";
import { createContext, useContext, useState, useCallback } from "react";

interface RecordingContextType {
  isRecording: boolean;
  setRecording: (v: boolean) => void;
  requestStop: () => void;
  onStopRequested: (() => void) | null;
  setOnStopRequested: (cb: (() => void) | null) => void;
}

const RecordingContext = createContext<RecordingContextType>(/* ... */);

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setRecording] = useState(false);
  const [onStopRequested, setOnStopRequested] = useState<(() => void) | null>(null);
  
  const requestStop = useCallback(() => {
    onStopRequested?.();
  }, [onStopRequested]);

  return (
    <RecordingContext.Provider value={{ isRecording, setRecording, requestStop, onStopRequested, setOnStopRequested }}>
      {children}
    </RecordingContext.Provider>
  );
}

export const useRecording = () => useContext(RecordingContext);
```

**タブバーの録音ボタン動作:**
```typescript
// tab-bar.tsx 内
const { isRecording, requestStop } = useRecording();
const router = useRouter();
const pathname = usePathname();

const handleRecordTap = () => {
  if (isRecording) {
    // 録音中 → 停止リクエスト
    requestStop();
  } else {
    // 待機中 → 録音画面へ遷移（自動開始）
    router.push("/record?auto=true");
  }
};
```

**record/page.tsx の連携:**
```typescript
const { setRecording, setOnStopRequested } = useRecording();

// 録音開始時
setRecording(true);
setOnStopRequested(() => stopRecording);

// 録音停止時（onstop callback内）
setRecording(false);
setOnStopRequested(null);
```

**layout.tsx:**
- `<RecordingProvider>` で全体をラップ

### 録音中のタブバー視覚フィードバック
- 録音中: RecordIcon内の塗り円 → 角丸四角（停止ボタン）に変化
- 録音中: アイコン外周にpulseアニメーション（subtle、opacity 0.3）

commit: `FIX: §2 タブバー録音ボタン拡大 + 録音開始停止`

---

## §3: タイポグラフィ改善

**対象:** 全画面

モノクロ設計で太字を使わないと、テキストの階層が色だけに依存して読みにくい。
以下のルールを追加:

### フォントウェイト基準
| 要素 | weight | size |
|------|--------|------|
| ページタイトル（ヘッダーtitle） | 600 | 14px |
| メモsummary（一覧・詳細） | 600 | 14px |
| 外部知識カードtitle | 600 | 13px |
| 外部知識カードdescription | 400 | 13px |
| keywords, メタ情報 | 400 | 11px |
| abstract_principle | 400 italic | 13px |
| latent_question | 500 italic | 13px |

### 具体的な修正箇所
1. **ホーム画面 メモ一覧:**
   - summary: `text-[13px]` → `text-[14px] font-semibold`
   
2. **録音結果画面:**
   - summary: 既にfont-medium → `font-semibold` に強化
   - transcript: `text-[13px]` のまま（軽いウェイトで地の文として区別）

3. **knowledge-card.tsx:**
   - title: `text-[13px] font-medium` → `text-[13px] font-semibold`
   
4. **memo/[id]/page.tsx:**
   - summary表示: `font-semibold` 追加

5. **latent_question:**
   - `font-medium italic` に変更（現状italic only）

commit: `FIX: §3 太字追加でテキスト階層の視認性改善`

---

## §4: 外部知識プロンプト全面改修

**対象:** `src/lib/ai/pipeline.ts` + `src/lib/personas.ts`

### 設計思想の変更

```
旧: 「事実を端的に紐づける」→ Wikipediaみたいで面白くない
新: 「気づきを意外な角度から幅出しする」→ なるほど！面白い！
```

### 固定3角度の定義

**新規追加:** pipeline.ts 内に角度定義

```typescript
export const SEARCH_ANGLES = {
  business_model: {
    label: "仕組みの視点",
    searchBias: "business model service company startup",
    promptGuide: `同じ構造・同じ課題を解決しているビジネス、サービス、制度、広告を見つけろ。
「こんなビジネスがある」「こんな広告がある」「こんなサービスが流行ってる」と伝える。
具体的な社名・サービス名・数字（売上、ユーザー数、年）を必ず含める。
ユーザーが「え、そんなのあるんだ」と思うものを優先する。`,
  },
  psychology: {
    label: "人の心の視点",
    searchBias: "psychology behavioral economics cognitive bias research",
    promptGuide: `この気づきの裏にある人間心理、認知バイアス、行動経済学の知見を見つけろ。
「人はこう動く」「こういう実験結果がある」と伝える。
実験名、研究者名、年、具体的な数値を必ず含める。
ユーザーが「だからそうなるのか」と腑に落ちるものを優先する。`,
  },
  cross_domain: {
    label: "異分野の視点",
    searchBias: "analogy pattern different field unexpected connection",
    promptGuide: `全く別の分野で同じパターン・構造が存在する事例を見つけろ。
生物学、物理学、音楽、建築、スポーツ、料理、軍事 — どこでもいい。
「意外にも○○の世界でも同じことが起きている」と伝える。
ユーザーが「面白い！そんなところで！」と感じるものを優先する。`,
  },
} as const;

export type SearchAngle = keyof typeof SEARCH_ANGLES;
```

### generateConnection の引数変更

```typescript
interface PipelineInput {
  summary: string;
  keywords: string[];
  abstract_principle: string;
  transcript: string;
  searchAngle: SearchAngle;      // 旧: personas: PersonaId[]
  personaId: PersonaId;           // ペルソナはプロンプトバイアスとして残す
  userProfile?: Record<string, unknown>;
  feedbackHistory?: { positive: string[]; negative: string[] };
}
```

### 検索クエリ生成プロンプト変更

```typescript
// 旧: persona.searchAngle ベース
// 新: angle.searchBias + persona.searchAngle 合成

const angle = SEARCH_ANGLES[input.searchAngle];
const persona = PERSONA_MAP[input.personaId];

const queryResponse = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 200,
  system: "You generate web search queries in English. Respond with ONLY the query, no explanation.",
  messages: [{
    role: "user",
    content: `Generate one English web search query (3-8 words) to find surprising, specific external knowledge.

Memo summary: ${input.summary}
Keywords: ${input.keywords.join(", ")}
Core principle: ${input.abstract_principle}

Search angle: ${angle.searchBias}
User interest bias: ${persona.searchAngle}

The query should find SPECIFIC examples (company names, study names, product names) — not generic concepts.`,
  }],
});
```

### 合成プロンプト変更

```typescript
const synthesisResponse = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 500,
  system: `あなたは知的好奇心を刺激するリサーチャー。
ユーザーの日常の気づきに対して「え、そうなの？」「面白い！」と思える外部知識を紐づける。

# あなたの角度
${angle.promptGuide}

# ユーザーの関心傾向
${persona.promptInstruction}
${profileSection}
${fbSection}

# 出力ルール
- 見出し: その外部知識を一言で表す（10-25字）。固有名詞を含めること
- 説明: 2-3文。具体的な数字・社名・年号・実験名を含める
- 最後の1文で「ユーザーの気づきとどう繋がるか」を1行で示す（ただし命令しない）
- 「〜してみてください」「〜かもしれません」禁止
- 断定調で書く。事実は事実として述べる
- JSON形式のみ出力`,
  messages: [{
    role: "user",
    content: `# ユーザーの気づき
要点: ${input.summary}
キーワード: ${input.keywords.join(", ")}
本質: ${input.abstract_principle}
原文: ${input.transcript}

# 検索結果
${searchResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`).join("\n\n")}

以下のJSON形式で知識を1つ紐づけ:
{
  "title": "見出し（固有名詞を含む、10-25字）",
  "description": "事実の説明（2-3文、数字・固有名詞必須）+ 気づきとの接続1文",
  "source_url": "URL",
  "source_title": "引用元タイトル",
  "quality_score": 0.0-1.0
}`,
  }],
});
```

### personas.ts の変更
- `searchAngle` はそのまま残す（クエリ生成のバイアス用途）
- `promptInstruction` もそのまま残す（合成プロンプトのバイアス用途）
- ペルソナが接続件数に影響する仕組みは完全撤廃

commit: `FIX: §4 外部知識プロンプト改修（固定3角度 + 意外性重視）`

---

## §5: モックデータ更新

**対象:** `src/lib/mock/connections.ts`

新しい3角度に合わせてモックデータを書き換え。
各メモにつき「仕組み」「人の心」「異分野」の3件。

### connections.ts 全面書き換え例（idea-001: 通勤ラッシュ）

```typescript
export const MOCK_CONNECTIONS = [
  // ── idea用: 仕組みの視点 ──
  {
    connection_type: "external_knowledge" as const,
    source_type: "external" as const,
    persona_label: "仕組みの視点",
    reason: "chocoZAPが混雑を逆手に取った。24時間営業+全店舗利用可能で、ユーザーが自然と時間分散する設計。2023年に会員数100万人突破。通勤ラッシュと同じ「全員が同じ時間に集中する」問題を、選択肢の増加で解決した構造。",
    action_suggestion: "",
    quality_score: 0.88,
    external_knowledge_title: "chocoZAPの混雑分散モデル",
    external_knowledge_url: null,
    external_knowledge_summary: "chocoZAPが混雑を逆手に取った。24時間営業+全店舗利用可能で、ユーザーが自然と時間分散する設計。2023年に会員数100万人突破。通勤ラッシュと同じ「全員が同じ時間に集中する」問題を、選択肢の増加で解決した構造。",
    source_idea_summary: "",
  },
  // ── idea用: 人の心の視点 ──
  {
    connection_type: "external_knowledge" as const,
    source_type: "external" as const,
    persona_label: "人の心の視点",
    reason: "行動経済学の「現状維持バイアス」。人は変更のコストを実際の2.5倍に見積もる（Kahneman, 1991）。通勤時間を30分ずらすだけで混雑率は30%下がるが、「いつもの電車」を変えるだけで心理的コストが発生する。非合理の正体は怠惰ではなくバイアス。",
    action_suggestion: "",
    quality_score: 0.91,
    external_knowledge_title: "現状維持バイアスと通勤行動",
    external_knowledge_url: null,
    external_knowledge_summary: "行動経済学の「現状維持バイアス」。人は変更のコストを実際の2.5倍に見積もる（Kahneman, 1991）。通勤時間を30分ずらすだけで混雑率は30%下がるが、「いつもの電車」を変えるだけで心理的コストが発生する。非合理の正体は怠惰ではなくバイアス。",
    source_idea_summary: "",
  },
  // ── idea用: 異分野の視点 ──
  {
    connection_type: "external_knowledge" as const,
    source_type: "external" as const,
    persona_label: "異分野の視点",
    reason: "アリの渋滞回避アルゴリズム。アリは密度が閾値を超えると自動的に別ルートを探索する。2019年ジョージア工科大の研究で、アリのトンネル内では渋滞が一切発生しないことが判明。個体が「止まる」という選択肢を持っているのが鍵。人間の通勤には「止まる」がない。",
    action_suggestion: "",
    quality_score: 0.85,
    external_knowledge_title: "アリの渋滞ゼロ・アルゴリズム",
    external_knowledge_url: null,
    external_knowledge_summary: "アリの渋滞回避アルゴリズム。アリは密度が閾値を超えると自動的に別ルートを探索する。2019年ジョージア工科大の研究で、アリのトンネル内では渋滞が一切発生しないことが判明。個体が「止まる」という選択肢を持っているのが鍵。人間の通勤には「止まる」がない。",
    source_idea_summary: "",
  },
];
```

**注意:** MOCK_CONNECTIONSは `discoverConnectionSingle(index)` で index 0-2 のみ使われる。3件あれば十分。

**対象:** `src/lib/ai/index.ts`
- `PERSONA_LABELS` → `ANGLE_LABELS = ["仕組みの視点", "人の心の視点", "異分野の視点"]`
- `discoverConnectionSingle` の引数からpersonas削除

commit: `FIX: §5 モックデータ更新（3角度形式）`

---

## §6: 横断適用 + 新規ページ

### 新規ページ（簡易版）

**`src/app/bookmarks/page.tsx`**
- `<AppHeader showBack title="Bookmarks" />`
- mockDb.connections.list() で bookmarked === true のものを一覧表示
- KnowledgeCardを再利用
- エンプティステート: 「no bookmarks yet」

**`src/app/about/page.tsx`**
- `<AppHeader showBack title="About" />`
- アプリ名 + バージョン + 一行説明
- 幾何学モチーフSVG
- リンク: Terms / Privacy / Contact

### mockDb拡張

**`src/lib/mock/db.ts`**
- `connections.listBookmarked()` メソッド追加:
  ```typescript
  listBookmarked(): Connection[] {
    return connections.filter((c) => c.bookmarked === true);
  }
  ```

### latent_question の型追加漏れ修正

**`src/lib/types.ts`** の Idea interface に `latent_question` がない場合は追加:
```typescript
export interface Idea {
  // ... 既存フィールド
  latent_question?: string;  // 追加
}
```

### RecordingProvider をlayout.tsxに追加

```typescript
// layout.tsx
import { RecordingProvider } from "@/components/recording-context";

// bodyの中で
<RecordingProvider>
  <AuthProvider>
    {children}
    <TabBar />
  </AuthProvider>
</RecordingProvider>
```

commit: `FIX: §6 Bookmarks + About ページ + 横断修正`

---

## 検証チェックリスト（全§完了後）

```bash
# ビルドチェック
npm run build

# ハンバーガーメニューが全ページに存在するか
grep -rn "AppHeader" src/app/

# 戻るボタン: ホームとグラフにshowBackがないことを確認
grep -n "showBack" src/app/page.tsx src/app/graph/page.tsx
# → ヒットしなければ正しい

# 旧BackArrow重複定義がないことを確認
grep -rn "function BackArrow" src/app/
# → ヒットしなければ正しい（AppHeaderに統合済み）

# 外部知識が常に3件（CONNECTION_COUNT=3, personas.lengthに依存しない）
grep -n "personas.length" src/app/api/ideas/route.ts
# → ヒットしなければ正しい

# font-semibold がsummary表示に適用されているか
grep -rn "font-semibold" src/app/page.tsx src/components/knowledge-card.tsx src/app/memo/

# RecordingProvider がlayout.tsxにあるか
grep -n "RecordingProvider" src/app/layout.tsx

# 角度ラベル確認
grep -rn "仕組みの視点\|人の心の視点\|異分野の視点" src/
```

---

## 実行順序

§0 → §1 → §2 → §3 → §4 → §5 → §6
各§完了ごとに `npm run build` → エラーなしを確認 → `FIX:` プレフィックスでcommit。
