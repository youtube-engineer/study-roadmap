-- 固定したロードマップは消せなくする。
--
-- 大事な1本を ⋯ から誤って消してしまうのを防ぐためのもの。
-- 消したあと数秒は取り消せるが、その帯を見逃すと戻せない。
-- 「消さないと決めておく」方が確実な場面がある。
--
-- 既存の行は false。コピーには引き継がない（固定は自分で決めるもの）。
alter table public.roadmaps
  add column if not exists is_pinned boolean not null default false;
