import { FlagIcon } from "@/components/ui/icons";

/**
 * 経路の始点と終点。
 *
 * 箱が等間隔に並ぶだけだと買い物リストに見える。始点・つながり・終点を
 * 視覚的に持たせることがロードマップとして成立する条件（CLAUDE.md 8章）。
 */

export function RouteStart() {
  return (
    <div className="flex items-center gap-2.5 pl-0.5">
      <span className="font-mono text-[0.6rem] tracking-[0.16em] text-ink-faint">START</span>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-gradient-to-r from-rule-strong to-transparent"
      />
    </div>
  );
}

export function RouteGoal() {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="relative flex min-h-[30px] w-[22px] flex-none justify-center">
        <span className="absolute top-0 h-2.5 w-[3px] rounded-sm bg-thread opacity-[0.34]" />
        <span className="relative mt-2.5 grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-thread text-white shadow-[0_0_0_3px_var(--raised)]">
          <FlagIcon />
        </span>
      </span>
      {/* 終点にはタイトルと重複する文言を置かない。目標はタイトルが表している */}
      <span className="pt-4 font-mono text-[0.6rem] tracking-[0.16em] text-ink-faint">GOAL</span>
    </div>
  );
}
