-- ============================================================================
-- books の突合キー
--
-- ISBN があるものは isbn で一意（0001 で unique 済み）。
-- ISBN が取れない本（手入力や、提供元がISBNを返さない場合）のために
-- (source, external_id) でも重複を防ぐ。
--
-- 同じ本が2行できると、別のロードマップから同じ参考書を指したときに
-- 別物として扱われてしまう。突合できることがキャッシュとしての前提。
-- ============================================================================

create unique index books_source_external_id_key
  on public.books (source, external_id)
  where external_id is not null;
