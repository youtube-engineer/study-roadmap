/**
 * 一覧に出す紐の縮小版。
 *
 * 冊数とどこまで進んだかを、数字ではなく**絵のまま**伝える。
 * 編集画面と同じ語彙（臙脂の紐と玉）を使うので、開かなくても状態が読める。
 *
 * 冊数が多いと縦に伸びすぎるので玉の数は上限を設ける。そのときは
 * 進んだ割合で塗る——1冊ずつ対応させるより、絵として正しい方を採る。
 */
const MAX_BEADS = 6;

type Props = { total: number; done: number };

export function MiniRoute({ total, done }: Props) {
  if (total === 0) {
    return (
      <span aria-hidden="true" className="flex w-3 flex-none justify-center pt-1">
        <span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-dashed border-rule-strong" />
      </span>
    );
  }

  const beads = Math.min(total, MAX_BEADS);
  const filled = Math.round((done / total) * beads);

  return (
    <span
      aria-hidden="true"
      className="flex w-3 flex-none flex-col items-center gap-[2.5px] self-stretch pt-1"
    >
      {Array.from({ length: beads }, (_, i) => (
        <span key={i} className="contents">
          {i > 0 && (
            <span className="min-h-1 w-[2px] flex-1 rounded-sm bg-thread opacity-30" />
          )}
          <span
            className={`h-1.5 w-1.5 flex-none rounded-full border-[1.5px] border-thread ${
              i < filled ? "bg-thread" : ""
            }`}
          />
        </span>
      ))}
    </span>
  );
}
