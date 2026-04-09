import { mockDb } from "@/lib/mock/db";

const MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

const PROFILE_THRESHOLDS = [5, 10, 20];

export async function maybeUpdateProfile(userId: string): Promise<void> {
  const ideas = mockDb.ideas.listByUser(userId);
  const count = ideas.length;

  if (!PROFILE_THRESHOLDS.includes(count)) return;

  console.log(`[Profile] Updating profile for user ${userId} at ${count} memos`);

  if (MOCK) {
    const mockProfile = {
      interests: ["プロダクト開発", "UX設計", "行動経済学"],
      current_challenges: ["意思決定の速度", "ユーザーFBの活用"],
      thinking_style: "構造で理解したがる。「なぜ」を掘る傾向",
      aspiration: "自分のプロダクトをPMFさせたい",
      connection_preference: "具体的な企業事例と数字がある接続を好む",
    };
    mockDb.userSettings.update(userId, { ai_profile: mockProfile });
    return;
  }

  // TODO: リアルモード: Claude Sonnet でプロファイル生成
}
