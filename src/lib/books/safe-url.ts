import "server-only";

/**
 * 外から来たURLを、保存してよいものだけに絞る。
 *
 * ★ **`books` に入った `source_url` は、そのまま `<a href>` になる**
 * （`DetailSheet` の「楽天ブックスで見る」）。`cover_image_url` は `<img src>` になる。
 * **共有ページは知らない人が踏む**ので、ここを素通しにすると
 * 「楽天だと思って押したら別のサイト」を作れてしまう。
 *
 * `/api/books/persist` は匿名で使えるアプリの都合上、誰でも叩ける。
 * **入口を塞ぐのではなく、入ってくる値を検査する**のが筋
 * （ログインを必須にしても、ログインした人が偽URLを送れば同じこと）。
 *
 * 出典は楽天しかない（CLAUDE.md 7章）ので、楽天以外を受け取る理由が無い。
 * 提供元を増やすときは、ここに足す。
 */
const ALLOWED_HOSTS = [
  "books.rakuten.co.jp",
  "item.rakuten.co.jp",
  "hb.afl.rakuten.co.jp", // アフィリエイト経由のリンク
  "thumbnail.image.rakuten.co.jp",
  "image.rakuten.co.jp",
];

export function safeBookUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // 相対パスや javascript: のような壊れた値はここで落ちる
    return null;
  }

  // http: と https: 以外は入れない（javascript: / data: を弾く）
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return allowed ? url.toString() : null;
}
