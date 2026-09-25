import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * `/login` は**このアプリには無い**。ログインはボタンから直接
   * Googleへ飛ばしていて、戻り先も `/auth/callback` なので、
   * アプリがこのパスを要求することは無い（`?login=ok` はクエリ文字列であって
   * パスではない）。
   *
   * それでも叩かれて404がログに並ぶ。ログイン完了を見て定番のパスを探しに行く
   * ブラウザ拡張やパスワードマネージャの動きで、外から来るもの。
   * **こちらで止められないので、404で終わらせずに入口へ送る。**
   * ログには残らなくなり、万一人が手で打っても迷子にならない。
   */
  async redirects() {
    return [{ source: "/login", destination: "/", permanent: false }];
  },
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
