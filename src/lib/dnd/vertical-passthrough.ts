"use client";

import type { TouchEvent as ReactTouchEvent } from "react";

/**
 * 本の上で縦になぞったら、ページを縦に送る。
 *
 * ★ **なぜ要るのか。**
 *
 * 長押しで掴めるようにするには、本を `touch-action: none` にするしかない。
 * ブラウザは**指が触れた時点で**そのジェスチャーに許す動作を決めるので、
 * パンを許した要素の上では長押しからドラッグへ移れない（CLAUDE.md 9章）。
 *
 * ところが `none` にすると、**本の上に指を置いたままページを縦に送れなくなる。**
 * スマホでは画面の大半が棚なので、これはそのまま「何も読めない」になる。
 *
 * → **縦の送りだけこちらで肩代わりする。** 掴む前の縦移動を拾って
 *   同じぶんだけ窓を動かす。慣性は付かないが、指に追随はする。
 *
 * 掴んだあと（`isDragging`）は何もしない。dnd-kit が持っていく。
 */
export function verticalPassthrough(isDragging: () => boolean) {
  let lastY: number | null = null;

  return {
    onTouchStart(e: ReactTouchEvent<HTMLElement>) {
      lastY = e.touches.length === 1 ? e.touches[0].clientY : null;
    },
    onTouchMove(e: ReactTouchEvent<HTMLElement>) {
      if (lastY === null || isDragging()) return;
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      const dy = lastY - y;
      lastY = y;
      if (dy !== 0) window.scrollBy(0, dy);
    },
    onTouchEnd() {
      lastY = null;
    },
    onTouchCancel() {
      lastY = null;
    },
  };
}
