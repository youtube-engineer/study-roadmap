-- ============================================================================
-- 並び順のキーから一意制約を外す
--
-- `(roadmap_id, fractional_index)` に unique を付けていたが、**これが原因で
-- 段や参考書を作れなくなる**。
--
-- 起きたこと:
--   0006 のマイグレーションが既存のロードマップに段を1つ作り、
--   `fractional_index = 'a0'` を入れた。一方その端末の手元にも別のidの段があり、
--   それを同期しようとすると同じ 'a0' で衝突する。
--   段が作れない → その中の参考書が外部キーで落ちる、と連鎖した。
--
-- そもそも fractional indexing はキーの重複を許す設計で、重なったところの
-- 順序が決まらなくなるだけで壊れない。**一意制約は守るものが小さいわりに、
-- 端末とサーバーで別々に採番される場面で必ず衝突する。**
-- ============================================================================

alter table public.roadmap_stages
  drop constraint if exists roadmap_stages_roadmap_id_fractional_index_key;

alter table public.roadmap_items
  drop constraint if exists roadmap_items_roadmap_id_fractional_index_key;

-- 並び順で引くので索引だけは残す
create index if not exists roadmap_stages_order_idx
  on public.roadmap_stages (roadmap_id, fractional_index);

create index if not exists roadmap_items_order_idx
  on public.roadmap_items (roadmap_id, fractional_index);
