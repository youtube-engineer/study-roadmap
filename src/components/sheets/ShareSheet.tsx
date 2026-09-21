"use client";

import { useRef, useState } from "react";

import { getSiteUrl } from "@/lib/site-url";
import { displayTitle } from "@/lib/roadmaps/title";

import { Sheet } from "./Sheet";

type Props = {
  open: boolean;
  onClose: () => void;
  isPublic: boolean;
  onChangePublic: (next: boolean) => void;
  shareSlug: string;
  title: string;
  bookCount: number;
};

export function ShareSheet({
  open,
  onClose,
  isPublic,
  onChangePublic,
  shareSlug,
  title,
  bookCount,
}: Props) {
  const [copied, setCopied] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  // 閉じたら「コピーした」の表示を戻す
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setCopied(false);
  }

  // オリジンをブラウザから読むとSSRの出力と食い違うので、ビルド時に決まる値を使う
  const origin = getSiteUrl();
  const path = `/r/${shareSlug}`;
  const absoluteUrl = () => new URL(path, origin).toString();
  const displayUrl = `${origin}${path}`.replace(/^https?:\/\//, "");

  const shareText = `${displayTitle(title)}｜参考書${bookCount}冊のロードマップ`;

  /**
   * 共有先。
   *
   * X と LINE はURLを渡せば投稿画面が開く。**Instagram にはそれが無い**ので、
   * 端末の共有メニュー（navigator.share）から渡す。そこに Instagram が並ぶ。
   *
   * 楽天ウェブサービス規約 第8条4項の「楽天以外へのリンクを置かない」は
   * ウェブサービスを使っている部分——検索シート——にかかる。この画面は
   * 書誌データを出していないので対象外。
   */
  const openIntent = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const shareToX = () =>
    openIntent(
      `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(absoluteUrl())}`,
    );

  const shareToLine = () =>
    openIntent(
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(absoluteUrl())}`,
    );

  /** 端末の共有メニュー。使えない環境ではURLのコピーに落とす */
  const shareToDevice = async () => {
    const url = absoluteUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: displayTitle(title), text: shareText, url });
        return;
      } catch {
        // 共有せずに閉じただけのこともあるので、失敗として扱わない
        return;
      }
    }
    await copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl());
    } catch {
      fieldRef.current?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <Sheet open={open} onClose={onClose} title="このロードマップを共有する">
      <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-5 pt-1">
        <button
          type="button"
          aria-pressed={isPublic}
          onClick={() => onChangePublic(!isPublic)}
          className={`flex w-full items-start gap-2.5 rounded-[11px] border px-3.5 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            isPublic ? "border-accent/40 bg-accent-soft" : "border-rule bg-sunk"
          }`}
        >
          <span
            aria-hidden="true"
            className={`relative mt-0.5 h-[22px] w-[38px] flex-none rounded-full transition-colors duration-200 ${
              isPublic ? "bg-accent" : "bg-rule-strong"
            }`}
          >
            <span
              className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
                isPublic ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[0.86rem] font-medium">
              リンクを知っている人が見られる
            </span>
            <span className="text-[0.74rem] leading-relaxed text-ink-faint">
              {isPublic
                ? "公開中。相手は閲覧とコピーができ、あなたのロードマップは書き換えられない。"
                : "今は自分だけが見られる状態。"}
            </span>
          </span>
        </button>

        <div
          className={`flex flex-col gap-4 transition-opacity duration-200 ${
            isPublic ? "" : "pointer-events-none opacity-40"
          }`}
        >
          <div className="flex gap-2">
            <input
              ref={fieldRef}
              readOnly
              value={displayUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-[9px] border border-rule bg-sunk px-2.5 py-2 font-mono text-[0.78rem] text-ink-soft outline-none"
            />
            <button
              type="button"
              onClick={copy}
              disabled={!isPublic}
              className={`flex-none rounded-[9px] px-4 text-[0.81rem] font-medium text-white ${
                copied ? "bg-thread" : "bg-accent hover:bg-accent-strong"
              }`}
            >
              {copied ? "コピーした" : "コピー"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ShareTarget label="X" onClick={shareToX} disabled={!isPublic} />
            <ShareTarget label="LINE" onClick={shareToLine} disabled={!isPublic} />
            <ShareTarget
              label="Instagram・その他"
              onClick={shareToDevice}
              disabled={!isPublic}
            />
          </div>

          <div>
            <div className="mb-1.5 text-[0.73rem] text-ink-faint">SNSに貼ったときの見え方</div>
            <div className="flex items-stretch overflow-hidden rounded-[11px] border border-rule bg-sunk">
              <div className="relative flex w-[92px] flex-none flex-col items-center justify-center gap-1.5 bg-deep py-2.5">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2.5 w-0.5 rounded-sm bg-thread opacity-50"
                />
                {[210, 18, 268, 30].map((hue) => (
                  <span
                    key={hue}
                    aria-hidden="true"
                    className="relative h-[18px] w-[13px] rounded-[1px_2px_2px_1px]"
                    style={{ background: `hsl(${hue} 44% 52%)` }}
                  />
                ))}
              </div>
              <div className="flex min-w-0 flex-col justify-center gap-[0.12rem] px-3 py-2.5">
                <div className="truncate font-serif text-[0.88rem] font-semibold leading-snug">
                  {displayTitle(title)}
                </div>
                <div className="text-[0.72rem] text-ink-soft">参考書{bookCount}冊のロードマップ</div>
                <div className="truncate font-mono text-[0.66rem] text-ink-faint">
                  {displayUrl}
                </div>
              </div>
            </div>
          </div>

          <a
            href={`/r/${shareSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-[10px] border border-rule-strong px-4 py-2.5 text-center text-[0.85rem] text-ink-soft hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
          >
            相手に見えている画面を確かめる
          </a>
        </div>
      </div>
    </Sheet>
  );
}

function ShareTarget({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[9px] border border-rule-strong px-2 py-2.5 text-center text-[0.74rem] leading-tight text-ink-soft hover:border-accent hover:bg-accent-soft hover:text-accent-strong disabled:cursor-default disabled:opacity-50"
    >
      {label}
    </button>
  );
}
