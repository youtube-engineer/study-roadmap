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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 表示は端末のライト/ダーク設定に従う
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e7e9e3" },
    { media: "(prefers-color-scheme: dark)", color: "#101318" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
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
