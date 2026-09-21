import Image from "next/image";

import type { Book } from "@/types/roadmap";

const SIZES = {
  /** 詳細シートの見出し。どの本を触っているかが表紙で分かる大きさにする */
  lg: { width: 92, height: 126 },
  md: { width: 38, height: 52 },
  sm: { width: 28, height: 38 },
} as const;

type Props = {
  book: Book;
  size?: keyof typeof SIZES;
  /** 画面内に最初から入っている1〜2冊だけ true にする（CLAUDE.md 10章） */
  priority?: boolean;
  className?: string;
};

/**
 * 表紙。画像が無いときは書名から作った色帯で代替する。
 *
 * 表紙は著作物で、提供元ごとに条件が違う。リスクがここに集中しているので
 * 「表紙が無くても成立する見た目」を常に持っておく（CLAUDE.md 7章）。
 */
export function BookCover({ book, size = "md", priority = false, className = "" }: Props) {
  const { width, height } = SIZES[size];
  const shape = "flex-none rounded-[2px_4px_4px_2px] shadow-sm overflow-hidden";

  if (book.coverImageUrl) {
    return (
      <Image
        src={book.coverImageUrl}
        alt=""
        width={width}
        height={height}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        // 最適化を通すとサーバー側に画像が残る。URLだけを持つという約束を守るため
        // 素のまま配信する（CLAUDE.md 6章）
        unoptimized
        className={`${shape} object-cover ${className}`}
        style={{ width, height }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${shape} ${className}`}
      style={{
        width,
        height,
        background: `linear-gradient(155deg, hsl(${book.hue} 44% 56%), hsl(${book.hue + 22} 40% 38%))`,
      }}
    />
  );
}
