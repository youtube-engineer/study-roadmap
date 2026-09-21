/**
 * 進捗を玉で見せる。
 *
 * 「2/6 終了」という数字より、**どこまで来たかが一目で分かる**方がいい。
 * 編集画面と同じ語彙（臙脂の玉）を使うので、棚の上の印とつながって読める。
 *
 * 冊数が多いと玉が潰れるので上限を設け、超えたら割合で塗る——
 * 1冊ずつ対応させるより絵として正しい方を採る（ドロワーの紐と同じ考え方）。
 */
const MAX_DOTS = 10;

type Props = { total: number; done: number };

export function Progress({ total, done }: Props) {
  if (total === 0) {
    return <span className="text-[0.8rem] text-ink-faint">まだ空</span>;
  }

  const dots = Math.min(total, MAX_DOTS);
  const filled = Math.round((done / total) * dots);
  const allDone = done === total;

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="flex items-center gap-[3px]">
        {Array.from({ length: dots }, (_, i) => (
          <span
            key={i}
            className={`h-[7px] w-[7px] rounded-full ${
              i < filled ? "bg-thread" : "bg-rule-strong"
            }`}
          />
        ))}
      </span>
      <span
        className={`text-[0.82rem] font-bold tabular-nums ${
          allDone ? "text-thread" : "text-ink-soft"
        }`}
      >
        {allDone ? `${total}冊 走りきった` : `${done}/${total}`}
      </span>
    </span>
  );
}
