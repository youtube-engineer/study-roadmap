"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { copyRoadmapAction, type CopyResult } from "@/lib/roadmaps/actions";

/**
 * 共有ページの「このロードマップをコピーして使う」。12章の要。
 *
 * ★ **押してから着くまでに間がある。** 元を読み、段と参考書を新しい所有者の
 * もとに作り直し、匿名サインインまで走る（`copy.ts`）。そのあいだ見た目が
 * 変わらないと、**押せていないのか詰まっているのか読む側に分からない。**
 * 外から来た人が最初に押すボタンなので、ここで迷わせると戻ってこない。
 *
 * 失敗したときも**黙って入口へ送らない**。元が非公開に戻っていた、
 * 消えていた、というのは普通に起きる。何が起きたかを出す。
 */
function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-4 py-3 text-[0.95rem] font-medium text-accent-ink transition-opacity hover:bg-accent-strong disabled:opacity-70"
    >
      {pending && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink"
        />
      )}
      {pending ? "コピーしています…" : "このロードマップをコピーして使う"}
    </button>
  );
}

export function CopyRoadmapButton({ slug }: { slug: string }) {
  const [state, action] = useActionState<CopyResult, FormData>(copyRoadmapAction, {});

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <Submit />
      {state.error && (
        <p role="alert" className="mt-2 text-[0.8rem] leading-relaxed text-thread">
          {state.error}
        </p>
      )}
    </form>
  );
}
