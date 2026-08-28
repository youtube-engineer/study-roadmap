-- ============================================================================
-- 匿名ユーザーのデータの定期クリーンアップ
--
-- 匿名認証の「消える」は2種類あるので区別すること（CLAUDE.md 5章）:
--   1. ユーザーがアクセスを失う（localStorageのトークン消失・端末変更）
--      → サーバー側の行は生きている。共有ページは share_slug で引くので表示され続ける
--   2. データが実際に消える → この定期処理と、本人による明示的削除のみ
--
-- **公開済み（is_public = true）は対象外にする。**
-- 他人がリンクを貼ったりコピー元にしている可能性があるため。
--
-- 実行するかどうかは後で決めてよい。少なくとも「公開済みを消さない」という
-- 条件を先に書いておくのが目的。
-- ============================================================================

create or replace function public.cleanup_abandoned_anonymous_roadmaps(
  older_than interval default interval '180 days'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  with victims as (
    delete from public.roadmaps r
    using auth.users u
    where r.owner_id = u.id
      -- 匿名のままのユーザーだけ。linkIdentity() で昇格したら対象外になる
      and u.is_anonymous
      and u.last_sign_in_at < now() - older_than
      -- 公開済みは残す
      and not r.is_public
    returning 1
  )
  select count(*) into deleted from victims;

  return deleted;
end;
$$;

comment on function public.cleanup_abandoned_anonymous_roadmaps is
  '放置された匿名ユーザーの非公開ロードマップを削除する。公開済みは消さない。';

-- 定期実行する場合（Dashboard の Integrations で pg_cron を有効にしてから）:
--
--   select cron.schedule(
--     'cleanup-abandoned-roadmaps',
--     '0 4 * * 0',                                  -- 毎週日曜 04:00 UTC
--     $cron$ select public.cleanup_abandoned_anonymous_roadmaps(); $cron$
--   );
