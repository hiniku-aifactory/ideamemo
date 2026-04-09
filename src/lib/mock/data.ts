export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export const MOCK_USER = {
  id: "mock-user-001",
  email: "demo@ideamemo.app",
  user_metadata: {
    full_name: "デモユーザー",
    avatar_url: null,
  },
  created_at: "2026-01-01T00:00:00Z",
};

export const MOCK_USER_SETTINGS = {
  user_id: MOCK_USER.id,
  theme: "dark" as const,
  notification_enabled: true,
  incubation_min_days: 3,
  incubation_max_days: 14,
  daily_memo_limit: 20,
  personas: [] as string[],
  ai_profile: {} as Record<string, unknown>,
  created_at: "2026-01-01T00:00:00Z",
};
