import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-serif text-[1.2rem] font-semibold">このロードマップは見つかりませんでした</h1>
      <p className="text-[0.85rem] leading-relaxed text-ink-soft">
        削除されたか、公開が取り消された可能性があります。
      </p>
      <Link
        href="/"
        className="mt-2 rounded-[10px] bg-accent px-4 py-2.5 text-[0.88rem] font-medium text-white hover:bg-accent-strong"
      >
        自分のロードマップを作る
      </Link>
    </div>
  );
}
