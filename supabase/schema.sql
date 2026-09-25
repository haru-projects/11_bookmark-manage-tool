-- Supabase: bookmarks テーブル作成SQL
-- Supabaseダッシュボードの「SQL Editor」で実行してください。

create table if not exists public.bookmarks (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default timezone('utc'::text, now()) not null,
    url text unique not null,
    title text not null,
    summary text not null,
    category text not null,
    tags text[] default '{}'::text[],
    use_cases text[] default '{}'::text[],
    commercial_use text not null,
    raw_content text
);

-- インデックス作成
create index if not exists bookmarks_created_at_idx on public.bookmarks (created_at desc);
create index if not exists bookmarks_category_idx on public.bookmarks (category);

-- Row Level Security (RLS) の有効化
alter table public.bookmarks enable row level security;

-- 全員に読み書きを許可するポリシー（MVP用）
create policy "Allow public read access"
    on public.bookmarks for select
    using (true);

create policy "Allow public insert access"
    on public.bookmarks for insert
    with check (true);

create policy "Allow public update access"
    on public.bookmarks for update
    using (true);

create policy "Allow public delete access"
    on public.bookmarks for delete
    using (true);
