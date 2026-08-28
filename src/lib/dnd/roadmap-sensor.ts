import { PointerSensor } from "@dnd-kit/core";
import type { PointerSensorProps } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * 並び替えのセンサー。**プロトタイプで実機検証済みの実装をそのまま持ってきている。**
 *
 * なぜセンサーが1つなのか（CLAUDE.md 9章）:
 *   「握りは即座に、カード本体は長押しで」を2つのセンサーで実現しようとすると
 *   片方が無言で効かなくなる。dnd-kit は同じイベント名（onPointerDown）を持つ
 *   センサーを、イベント名をキーにしたオブジェクトへ畳み込むため、後から登録した
 *   方が前を上書きするから。
 *   → センサーは1つにまとめ、押された位置を見て発火条件を切り替える。
 *
 * 触ってよい場所（CLAUDE.md 9章）:
 *   カード本体は touch-action: pan-y のままスクロールを通し、右端の握りだけを
 *   touch-action: none にする。ブラウザはタッチ開始の時点でそのジェスチャーに
 *   許す動作を確定するため、縦スクロールを許可した要素の上ではドラッグが成立しない。
 *   ドラッグ開始後に動的に切り替えても進行中のジェスチャーには反映されない。
 */

/** 握りから始めたとき: 4px 動いた時点で掴む（押した瞬間から動く体感にする） */
const GRIP_CONSTRAINT = { distance: 4 };

/** カード本体から始めたとき: 220ms の長押し。スクロールと取り合いにならない距離だけ許す */
const BODY_CONSTRAINT = { delay: 220, tolerance: 8 };

/** 握りの目印。CSS 側の touch-action: none もこの属性に当てる */
export const GRIP_ATTRIBUTE = "data-grip";

/**
 * activators のハンドラで立てて constructor で読む。
 * dnd-kit はハンドラが true を返してからセンサーを生成するので、この順序が成立する。
 */
let pressedGrip = false;

function isInside(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

export class RoadmapSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent): boolean => {
        if (!event.isPrimary || event.button !== 0) return false;
        // 玉（終了の印）や詳細ボタンの上ではドラッグを始めない
        if (isInside(event.target, "button")) return false;
        pressedGrip = isInside(event.target, `[${GRIP_ATTRIBUTE}]`);
        return true;
      },
    },
  ];

  constructor(props: PointerSensorProps) {
    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint: pressedGrip ? GRIP_CONSTRAINT : BODY_CONSTRAINT,
      },
    });
  }
}
