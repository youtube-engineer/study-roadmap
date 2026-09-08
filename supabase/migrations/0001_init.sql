-- ============================================================================
-- 初期スキーマと RLS
--
-- CLAUDE.md 6章のデータモデルをそのまま写したもの。設計の理由は6章を読むこと。
-- Supabase の SQL Editor に貼って実行するか、Supabase CLI で db push する。
--
-- 方針:
--   - アクセス制御は RLS に集約する。「本人のみ読める」判定をアプリ側に散らさない
--   - 所有者は素直な外部キーで持つ。下位テーブルへ非正規化して持ち回らない
--   - 製品名をテーブル名に焼き込まない（roadmaps / roadmap_items のような機能名で通す）
-- ============================================================================

-- ----------------------------------------------------------------------------
-- books
--
-- 「自分たちの書籍DB」ではなく **ISBN をキーにした表示用キャッシュ**。
-- 本当に自分のデータなのは isbn だけで、書名・著者・表紙は提供元の規約が
-- 付いてくる借り物。失っても致命傷にならない状態を保つ（CLAUDE.md 6章）。
-- ----------------------------------------------------------------------------
create table public.books (
  id              uuid primary key default gen_random_uuid(),
  source          text not null check (source in ('rakuten', 'openbd', 'manual')),
  external_id     text,
  -- これだけが本当に自分のデータ。提供元を切り替えるときはここから引き直す
  isbn            text unique,
  title           text not null,
  author          text,
  -- URLだけを持つ。画像ファイルは複製しない
  cover_image_url text,
  -- 出典ページ。楽天ウェブサービス規約 第8条4項のリンク義務に使う
  source_url      text,
  -- 永続資産のつもりで持たないための目印
  fetched_at      timestamptz not null default now()
);

create index books_isbn_idx on public.books (isbn);

-- ----------------------------------------------------------------------------
-- roadmaps
-- ----------------------------------------------------------------------------
create table public.roadmaps (
  id                uuid primary key default gen_random_uuid(),
  -- 匿名/本アカウント共通のユーザーID。
  -- 匿名認証で作ったユーザーを linkIdentity() で昇格させても id は変わらないので、
  -- ログイン時のデータ移行が要らない（CLAUDE.md 5章）
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null default '新しいルート',
  is_public         boolean not null default false,
  -- 既定値は保険。通常はアプリ側（lib/roadmaps/slug.ts）が作った値を明示的に入れる。
  -- pgcrypto の gen_random_bytes() は使わない。Supabase では拡張が extensions
  -- スキーマに入るため public から素で呼べず、既定値のためだけに依存を増やしたくない。
  -- gen_random_uuid() は Postgres 13 以降の組み込みなので拡張が要らない。
  share_slug        text not null unique
                      default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  -- 外部キーは「辿る」ため。元が消えたら null になる
  copied_from_id    uuid references public.roadmaps (id) on delete set null,
  -- スナップショットは「記録として残す」ため。
  -- 元が削除・非公開になるのは正当な行為なのでリンクは必ず切れる。
  -- FKだけだと表示ごと消えるので、「◯◯さんのルートをもとにしています」だけ残す
  copied_from_title text,
  copied_from_name  text,
  created_at        timestamptz not null default now()
);

create index roadmaps_owner_id_idx on public.roadmaps (owner_id);
create index roadmaps_share_slug_idx on public.roadmaps (share_slug) where is_public;

-- ----------------------------------------------------------------------------
-- roadmap_items
-- ----------------------------------------------------------------------------
create table public.roadmap_items (
  id               uuid primary key default gen_random_uuid(),
  roadmap_id       uuid not null references public.roadmaps (id) on delete cascade,
  book_id          uuid not null references public.books (id) on delete restrict,
  -- fractional indexing。1冊動かすたびに動かした行だけ更新する（CLAUDE.md 4章）
  fractional_index text not null,
  -- 1タップで切り替わる最小限の進捗信号
  is_done          boolean not null default false,
  -- 周回の「目標」。進捗カウンターではないので、今何周目かは持たない
  rounds_target    smallint check (rounds_target between 1 and 20),
  -- 共有時に相手が読む部分
  note             text not null default '',
  unique (roadmap_id, fractional_index)
);

create index roadmap_items_roadmap_id_idx on public.roadmap_items (roadmap_id);

-- ----------------------------------------------------------------------------
-- tags / roadmap_tags
--
-- 固定リストにしない。自由に作らせて実際の語彙を観察する（CLAUDE.md 6章）。
-- 独立テーブル＋中間テーブルなのは、将来「日商簿記→簿記」の統合をするとき
-- 参照先IDの差し替えだけで済ませるため。text[] だと全ロードマップを書き換えることになる。
-- ----------------------------------------------------------------------------
create table public.tags (
  id             uuid primary key default gen_random_uuid(),
  -- 入力されたまま
  name           text not null,
  -- 小文字化・空白除去・全角半角統一した突合用キー
  normalized_key text not null unique,
  -- 補完候補の並び順と「◯人が使用」表示に使う
  usage_count    integer not null default 0
);

create index tags_usage_count_idx on public.tags (usage_count desc);

create table public.roadmap_tags (
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  primary key (roadmap_id, tag_id)
);

-- ============================================================================
-- RLS
--
-- auth.uid() は (select auth.uid()) の形で書く。そのままだと行ごとに評価されるが、
-- select で包むと初期化時に1回で済む（Supabase の推奨）。
-- ============================================================================

alter table public.books         enable row level security;
alter table public.roadmaps      enable row level security;
alter table public.roadmap_items enable row level security;
alter table public.tags          enable row level security;
alter table public.roadmap_tags  enable row level security;

-- ---- books ----------------------------------------------------------------
-- 読み取りは誰でも可。書き込みポリシーは**作らない**。
-- books への書き込みはサーバー側（secret key）の1経路だけに集約する（CLAUDE.md 7章）。
create policy "books are readable by everyone"
  on public.books for select
  using (true);

-- ---- roadmaps -------------------------------------------------------------
create policy "owners can read their own roadmaps"
  on public.roadmaps for select
  using ((select auth.uid()) = owner_id);

-- **独立したポリシーとして用意する**（CLAUDE.md 6章）。
-- 本人の権限とは別の主体なので、上のポリシーに条件を足す形にしない。
-- 閲覧できる主体が増えたときにここだけ足せばよくなる。
create policy "public roadmaps are readable by everyone"
  on public.roadmaps for select
  using (is_public);

create policy "owners can create their own roadmaps"
  on public.roadmaps for insert
  with check ((select auth.uid()) = owner_id);

create policy "owners can update their own roadmaps"
  on public.roadmaps for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "owners can delete their own roadmaps"
  on public.roadmaps for delete
  using ((select auth.uid()) = owner_id);

-- ---- roadmap_items --------------------------------------------------------
-- 所有者は roadmaps 側にしか無いので、必ず親を見に行く。
-- ここに owner_id を非正規化して持たせない（CLAUDE.md 6章）。
create policy "owners can read items of their own roadmaps"
  on public.roadmap_items for select
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ));

create policy "items of public roadmaps are readable by everyone"
  on public.roadmap_items for select
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.is_public
  ));

create policy "owners can write items of their own roadmaps"
  on public.roadmap_items for all
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ));

-- ---- tags -----------------------------------------------------------------
-- タグ名は誰のものでもない語彙なので読み取りは全員可。
-- 作成はログイン済み（匿名認証を含む）なら可。
create policy "tags are readable by everyone"
  on public.tags for select
  using (true);

create policy "signed in users can create tags"
  on public.tags for insert
  to authenticated
  with check (true);

-- ---- roadmap_tags ---------------------------------------------------------
create policy "tags of readable roadmaps are readable"
  on public.roadmap_tags for select
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id
      and (r.is_public or r.owner_id = (select auth.uid()))
  ));

create policy "owners can write tags of their own roadmaps"
  on public.roadmap_tags for all
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ));

-- ============================================================================
-- Data API への公開範囲（GRANT）
--
-- Dashboard の「Automatically expose new tables」を**切っている**前提で、
-- どのロールが何をできるかをここに明示する。ダッシュボードのトグルは
-- プロジェクトごとの設定なので、プレビューと本番で食い違う。
-- SQLに書いておけば両方に同じものが流れる。
--
-- 2つのロールを混同しないこと:
--   anon          … JWTを持たない訪問者。共有ページをSSRで配信するときがこれ
--   authenticated … サインイン済み。**匿名サインインしたユーザーもこちら**
--
-- 匿名認証（signInAnonymously）で作られるのは anon ロールではない。
-- 名前が紛らわしいが、匿名ユーザーは authenticated として振る舞う。
--
-- GRANT と RLS は別の層で、失敗の出方が違う:
--   GRANT が無い    → permission denied for table ... というエラーになる
--   ポリシーが無い  → エラーにならず 0 行が返る
-- ============================================================================

grant usage on schema public to anon, authenticated;

-- ---- books ----------------------------------------------------------------
-- 読むだけ。書き込みは secret key（service_role）を使うサーバー側の1経路のみ。
-- RLS に書き込みポリシーが無いことと合わせて二重に閉じている（CLAUDE.md 7章）
grant select on public.books to anon, authenticated;

-- ---- roadmaps / roadmap_items ---------------------------------------------
-- 共有ページを JWT 無しで配信するので anon にも select を渡す。
-- どの行が見えるかは RLS の is_public ポリシーが決める
grant select on public.roadmaps      to anon, authenticated;
grant select on public.roadmap_items to anon, authenticated;

grant insert, update, delete on public.roadmaps      to authenticated;
grant insert, update, delete on public.roadmap_items to authenticated;

-- ---- tags / roadmap_tags --------------------------------------------------
grant select on public.tags to anon, authenticated;
grant insert on public.tags to authenticated;

grant select on public.roadmap_tags to anon, authenticated;
grant insert, delete on public.roadmap_tags to authenticated;
