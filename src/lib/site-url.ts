/**
 * このデプロイの公開URL。
 *
 * Vercel の Preview は毎回ホスト名が変わるので、環境変数に決め打ちできない。
 * 共有URLの表示と OGP の絶対URLがプレビューで本番を指してしまうと、
 * 「相手にどう見えるか」を確かめる用途で使えなくなる。
 *
 * 優先順位:
 *   1. NEXT_PUBLIC_SITE_URL          … 独自ドメインを当てているとき
 *   2. NEXT_PUBLIC_VERCEL_URL        … Vercel が自動で入れるこのデプロイのURL
 *   3. localhost                     … 手元
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
