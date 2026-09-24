import "server-only";

/**
 * OGP画像に使う日本語フォント。
 *
 * **Satori（`ImageResponse` の中身）は自前でフォントを持たない。** 渡さないと
 * 日本語が豆腐（□）になる。共有される画像でそれが起きると、ロードマップの
 * 名前がまるごと読めなくなるので必ず渡すこと。
 *
 * 全部入りのCJKフォントは数MBあるので**その画像に出る字だけを取りに行く**
 * （`text=` を付けるとGoogleが部分集合を返す）。
 *
 * **woff2 では駄目。** Satori が読めるのは ttf / otf / woff なので、
 * 古いブラウザのふりをして ttf を返させる。
 */
const LEGACY_UA = "Mozilla/5.0 (Windows NT 6.1)";

export async function loadJapaneseFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": LEGACY_UA }, next: { revalidate: 60 * 60 * 24 } },
    );
    if (!css.ok) return null;

    const url = /src:\s*url\(([^)]+)\)/.exec(await css.text())?.[1];
    if (!url) return null;

    const font = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!font.ok) return null;

    return await font.arrayBuffer();
  } catch {
    // 取れなくても画像は出す（英数字は既定のフォントで出る）
    return null;
  }
}
