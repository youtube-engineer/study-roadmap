-- ★ 並び順を fractional indexing から「ただの連番」に変える。
--
-- 順番を**2つの別々の形で持っていた**のが、ずれの原因だった。
--   編集画面   … 配列の並び順
--   共有ページ … キー文字列を並べ替えたもの
-- 同じ順番を2通りで表しているので、片方だけ更新されるとずれる。しかも
-- 編集画面は配列を見ているので**ずれても本人には正しく見える**。
-- 共有して初めて分かる、という一番たちの悪い壊れ方をした。
--
-- さらにキーの大小が JS と Postgres で逆だった（Zz と a0）。
--
-- fractional indexing は「1行動かしたら1行だけ更新すれば済む」ための仕組みで、
-- 何千行もある表なら価値がある。**このアプリのロードマップは数十行**なので
-- 割に合っていなかった。節約したのは1回の書き込みで、代わりにバグを買った。
--
-- → position は保存のたびに全行を振り直す。並べる場所が1つになるので
--   ずれる余地が構造的に消える。

alter table public.roadmap_stages add column if not exists position int not null default 0;
alter table public.roadmap_items  add column if not exists position int not null default 0;

-- 既存の行は、いまのキー順をそのまま番号に移す。
-- collate "C" にしてあるので（0010）、ブラウザ側と同じ並びになる。
-- キーが重複している行は id で安定させる——本来の順は失われているが、
-- 少なくとも**毎回同じ順**になる。
with ordered as (
  select id,
         row_number() over (
           partition by roadmap_id
           order by fractional_index collate "C", id
         ) - 1 as pos
  from public.roadmap_stages
)
update public.roadmap_stages s set position = ordered.pos
from ordered where ordered.id = s.id;

with ordered as (
  select id,
         row_number() over (
           partition by stage_id
           order by fractional_index collate "C", id
         ) - 1 as pos
  from public.roadmap_items
)
update public.roadmap_items i set position = ordered.pos
from ordered where ordered.id = i.id;

-- fractional_index はまだ落とさない。**先にアプリを入れ替えてから**。
-- 古いコードが動いているあいだに消すと not null 違反で書き込めなくなる。
-- 落とすのは 0012 で。
alter table public.roadmap_stages alter column fractional_index drop not null;
alter table public.roadmap_items  alter column fractional_index drop not null;

create index if not exists roadmap_stages_position_idx on public.roadmap_stages (roadmap_id, position);
create index if not exists roadmap_items_position_idx  on public.roadmap_items  (stage_id, position);
