-- ============================================================================
-- 段（roadmap_stages）
--
-- 参考書を「単語・文法」「長文」のようなまとまりで区切る。
-- 8章で取り下げた枝分かれ（本線か補助か）とは別物で、順番に進む区切り。
-- 経路は1本のまま。
--
-- 段が終わったかどうかは**持たない。** 中の本が全部終わっていれば終わり、と
-- 導出する。二重に持つと必ずずれる。
-- ============================================================================

create table public.roadmap_stages (
  id               uuid primary key default gen_random_uuid(),
  roadmap_id       uuid not null references public.roadmaps (id) on delete cascade,
  -- 自由入力。空でも構わない
  name             text not null default '',
  fractional_index text not null,
  unique (roadmap_id, fractional_index)
);

create index roadmap_stages_roadmap_id_idx on public.roadmap_stages (roadmap_id);

-- ----------------------------------------------------------------------------
-- 既存の参考書を1つの段にまとめる
--
-- 段が無かった頃のロードマップは、全部が1つの段に入っていたのと同じ。
-- 名前は空にする（勝手に名前を付けない）。
-- ----------------------------------------------------------------------------
alter table public.roadmap_items
  add column stage_id uuid references public.roadmap_stages (id) on delete cascade;

insert into public.roadmap_stages (roadmap_id, name, fractional_index)
select distinct roadmap_id, '', 'a0' from public.roadmap_items;

update public.roadmap_items i
set stage_id = s.id
from public.roadmap_stages s
where s.roadmap_id = i.roadmap_id;

alter table public.roadmap_items alter column stage_id set not null;

-- ============================================================================
-- RLS / GRANT
--
-- 所有者は roadmaps 側にしか無いので、必ず親を見に行く（6章）。
-- ============================================================================

alter table public.roadmap_stages enable row level security;

create policy "owners can read stages of their own roadmaps"
  on public.roadmap_stages for select
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ));

create policy "stages of public roadmaps are readable by everyone"
  on public.roadmap_stages for select
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.is_public
  ));

create policy "owners can write stages of their own roadmaps"
  on public.roadmap_stages for all
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.owner_id = (select auth.uid())
  ));

grant select on public.roadmap_stages to anon, authenticated;
grant insert, update, delete on public.roadmap_stages to authenticated;
