/**
 * 本の下端の握りに付ける印。
 *
 * **dnd-kit を読み込まない場所に置くこと。** センサー（`roadmap-sensor.ts`）は
 * `@dnd-kit/core` を持ち込むので、そこから export すると、
 * **握りを持たない共有ページまで dnd-kit を抱えることになる**（10章）。
 */
export const GRIP_ATTRIBUTE = "data-grip";
