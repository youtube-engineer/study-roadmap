/**
 * 楽天ウェブサービスのクレジット表記。**必須**。
 *
 * テキスト版は「Supported by Rakuten Developers」で developers.rakuten.com へリンクする。
 * HTMLコード・画像はいずれも改変不可。表示場所はサイト/アプリ内のどこでもよいと
 * 明記されている（CLAUDE.md 7章）。
 */
export function RakutenCredit() {
  return (
    <a
      href="https://developers.rakuten.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[0.7rem] text-ink-faint underline underline-offset-2 hover:text-ink-soft"
    >
      Supported by Rakuten Developers
    </a>
  );
}
