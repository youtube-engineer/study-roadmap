import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // 表紙は楽天から配信されるURLをそのまま参照する。
    // Next の画像最適化を通すとサーバー側に画像が残ってしまうので、
    // BookCover 側で unoptimized を指定して「URLだけ持つ・画像ファイルは
    // 複製しない」を守っている（CLAUDE.md 6章）。
    remotePatterns: [
      { protocol: "https", hostname: "thumbnail.image.rakuten.co.jp" },
      { protocol: "https", hostname: "image.rakuten.co.jp" },
    ],
  },
};

export default nextConfig;
