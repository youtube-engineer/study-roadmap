import { ShareIcon } from "@/components/ui/icons";

/**
 * ルートを切り替えているあいだに出す。
 *
 * **これが無いと、新しい画面が出来上がるまで前のロードマップが映り続ける。**
 * 編集画面はサーバーで組み立てる（ロードマップ・段・参考書・一覧）ので
 * 一拍かかり、そのあいだ押したのに何も起きていないように見えていた。
 *
 * 形は棚に寄せる。まったく違うものを挟むと、切り替わったのではなく
 * 別の画面へ飛んだように見えるため。
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">読み込んでいます</span>

      {/*
        見出しの帯も同じ高さで置く。ここを空けると、切り替えるたびに
        ハンバーガーと共有ボタンが消えて戻るので、画面ごと飛んだように見える。
      */}
      <header className="flex items-center gap-1.5 px-3 pb-1 pt-2 md:px-5">
        <span className="-ml-1 grid h-8 w-8 flex-none place-items-center rounded-full text-ink-faint">
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="flex-1" />
        <span className="grid h-11 w-11 flex-none place-items-center text-ink-faint">
          <ShareIcon size={18} />
        </span>
        <span className="h-7 w-7 flex-none rounded-full border border-rule" />
      </header>

      <div className="px-4 pb-1 pt-1 md:px-6">

      {/* ロードマップ名 */}
      <div className="mb-3 mt-1 h-7 w-1/2 animate-pulse rounded-md bg-sunk md:h-9" />

      {[0, 1].map((i) => (
        <section key={i} className="relative pl-[46px]">
          {/* 紐と玉。経路であることは読み込み中も崩さない */}
          <span className="absolute inset-y-0 left-[15px] flex w-[22px] justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 w-[3px] rounded-sm bg-thread opacity-[0.28]"
            />
            <span className="relative z-[2] mt-0.5 h-6 w-6 self-start rounded-full border-[2.5px] border-thread bg-raised opacity-60 shadow-[0_0_0_4px_var(--raised)]" />
          </span>

          <div className="flex min-h-7 items-center">
            <span className="h-4 w-28 animate-pulse rounded bg-sunk" />
          </div>

          <div className="mt-1 h-[var(--shelf-h,196px)] animate-pulse rounded-[10px] bg-sunk" />
          <div className="h-4" />
        </section>
      ))}
      </div>
    </div>
  );
}
