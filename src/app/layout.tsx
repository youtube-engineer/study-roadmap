import type { Metadata, Viewport } from "next";

import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "参考書ロードマップ",
    template: "%s｜参考書ロードマップ",
  },
  description:
    "参考書をどの順番で進めるかを、1本の経路として組み立てて共有できます。ログインなしで始められます。",
  /**
   * 貼られたときの見え方。**宣言しないと、共有ページ以外はタグごと出ない。**
   * 画像は `app/opengraph-image.tsx` が作り、ここには書かなくても付く。
   */
  openGraph: {
    type: "website",
    siteName: "参考書ロードマップ",
    locale: "ja_JP",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ダークテーマは持たない（globals.css の先頭）。端末の設定に関わらず紙の色
  themeColor: "#f2f1ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* 端末がダークでも、フォームや選択色まで暗くならないようにする */
    <html lang="ja" style={{ colorScheme: "light" }}>
      {/*
        器の幅。スマホは 430px（画面設計）。**広い画面では広げる**——
        棚は横に並ぶので、広がったぶんだけ本が多く見える。狭いままだと
        両脇が空くだけで、横スクロールも減らない
      */}
      <body className="mx-auto min-h-dvh w-full max-w-[430px] bg-raised md:max-w-[720px] xl:max-w-[920px]">
        {children}
      </body>
    </html>
  );
}
