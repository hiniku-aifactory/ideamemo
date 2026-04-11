-- ideamemo Supabase DDL
-- Supabase Dashboard > SQL Editor で実行

-- ============================================
-- 1. ideas（メモ）
-- ============================================
create table ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transcript text not null default '',
  summary text not null default '',
  keywords text[] not null default '{}',
  abstract_principle text not null default '',
  latent_question text not null default '',
  domain text not null default 'その他',
  audio_url text,
  folder_id uuid,
  folder_name text,
  source text not null default 'voice',          -- 'voice' | 'chat_insight'
  parent_session_id uuid,
  graph_label text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_ideas_user on ideas(user_id);
create index idx_ideas_created on ideas(user_id, created_at desc);

-- ============================================
-- 2. connections（接続カード）
-- ============================================
create table connections (
  id uuid primary key default gen_random_uuid(),
  idea_from_id uuid not null references ideas(id) on delete cascade,
  idea_to_id uuid references ideas(id) on delete set null,
  connection_type text not null default 'external_knowledge',  -- external_knowledge | combination | manual | chat_derived
  source text not null default 'ai',                           -- ai | manual | combination
  persona_label text,
  reason text not null default '',
  action_suggestion text not null default '',
  quality_score real,
  external_knowledge_title text,
  external_knowledge_url text,
  external_knowledge_summary text,
  source_idea_summary text,
  user_note text,
  feedback text,               -- 'positive' | 'negative' | null
  feedback_at timestamptz,
  bookmarked boolean not null default false,
  search_domain text,          -- P3ドメイン選択結果
  collision_type text,         -- P5掛け合わせ型: same | opposite | cause | solve | emerge
  try_this text,               -- P5アクション提案
  created_at timestamptz not null default now()
);

create index idx_connections_idea_from on connections(idea_from_id);
create index idx_connections_idea_to on connections(idea_to_id);

-- ============================================
-- 3. chat_sessions（チャットセッション）
-- ============================================
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idea_id uuid references ideas(id) on delete set null,
  connection_id uuid references connections(id) on delete set null,
  context_type text not null default 'connection',  -- connection | combination
  context_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_sessions_user on chat_sessions(user_id, updated_at desc);

-- ============================================
-- 4. chat_messages（チャットメッセージ）
-- ============================================
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null,           -- 'user' | 'assistant'
  content text not null default '',
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session on chat_messages(session_id, created_at);

-- ============================================
-- 5. chat_insights（チャット気づき抽出）
-- ============================================
create table chat_insights (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  summary text not null default '',
  full_text text not null default '',
  keywords text[] not null default '{}',
  status text not null default 'suggested',  -- suggested | accepted | dismissed
  created_at timestamptz not null default now()
);

create index idx_chat_insights_session on chat_insights(session_id);

-- ============================================
-- 6. user_settings（ユーザー設定）
-- ============================================
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark',
  notification_enabled boolean not null default true,
  incubation_min_days int not null default 3,
  incubation_max_days int not null default 14,
  daily_memo_limit int not null default 20,
  personas text[] not null default '{}',       -- ['builder','grower','researcher','creator']
  ai_profile jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- 7. RLS（Row Level Security）
-- ============================================
alter table ideas enable row level security;
alter table connections enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table chat_insights enable row level security;
alter table user_settings enable row level security;

-- ideas: 自分のデータのみ
create policy "ideas_select" on ideas for select using (auth.uid() = user_id);
create policy "ideas_insert" on ideas for insert with check (auth.uid() = user_id);
create policy "ideas_update" on ideas for update using (auth.uid() = user_id);
create policy "ideas_delete" on ideas for delete using (auth.uid() = user_id);

-- connections: idea_from_idの所有者のみ
create policy "connections_select" on connections for select
  using (exists (select 1 from ideas where ideas.id = connections.idea_from_id and ideas.user_id = auth.uid()));
create policy "connections_insert" on connections for insert
  with check (exists (select 1 from ideas where ideas.id = idea_from_id and ideas.user_id = auth.uid()));
create policy "connections_update" on connections for update
  using (exists (select 1 from ideas where ideas.id = connections.idea_from_id and ideas.user_id = auth.uid()));
create policy "connections_delete" on connections for delete
  using (exists (select 1 from ideas where ideas.id = connections.idea_from_id and ideas.user_id = auth.uid()));

-- chat_sessions: 自分のセッションのみ
create policy "chat_sessions_select" on chat_sessions for select using (auth.uid() = user_id);
create policy "chat_sessions_insert" on chat_sessions for insert with check (auth.uid() = user_id);
create policy "chat_sessions_update" on chat_sessions for update using (auth.uid() = user_id);

-- chat_messages: セッション所有者のみ
create policy "chat_messages_select" on chat_messages for select
  using (exists (select 1 from chat_sessions where chat_sessions.id = chat_messages.session_id and chat_sessions.user_id = auth.uid()));
create policy "chat_messages_insert" on chat_messages for insert
  with check (exists (select 1 from chat_sessions where chat_sessions.id = session_id and chat_sessions.user_id = auth.uid()));

-- chat_insights: セッション所有者のみ
create policy "chat_insights_select" on chat_insights for select
  using (exists (select 1 from chat_sessions where chat_sessions.id = chat_insights.session_id and chat_sessions.user_id = auth.uid()));
create policy "chat_insights_insert" on chat_insights for insert
  with check (exists (select 1 from chat_sessions where chat_sessions.id = session_id and chat_sessions.user_id = auth.uid()));
create policy "chat_insights_update" on chat_insights for update
  using (exists (select 1 from chat_sessions where chat_sessions.id = chat_insights.session_id and chat_sessions.user_id = auth.uid()));

-- user_settings: 自分の設定のみ
create policy "user_settings_select" on user_settings for select using (auth.uid() = user_id);
create policy "user_settings_insert" on user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings_update" on user_settings for update using (auth.uid() = user_id);

-- ============================================
-- 8. サービスロール用ポリシー（API route用）
-- ============================================
-- Vercelのサーバーサイドからはservice_roleキーで操作するため、
-- RLSをbypassする。クライアントサイドからは上記RLSが適用される。
-- service_roleキーは SUPABASE_SERVICE_ROLE_KEY としてVercelに設定。
-- クライアントには NEXT_PUBLIC_SUPABASE_ANON_KEY のみ公開。
