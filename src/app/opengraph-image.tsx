import { ImageResponse } from "next/og";

import { loadJapaneseFont } from "@/lib/og/font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "参考書ロードマップ";

const INK = "#1c1f26";
const THREAD = "#e4572e";
const PAPER = "#f7f6f2";

const NAME = "参考書ロードマップ";
const LEAD = "どの順番でやるかを決めて、1本の経路にする。";
const SUB = "ログインなしで始められます。";

/** 中身がまだ無いので、表紙の代わりに背だけ並べる。嘘の書名は置かない */
const SPINES = [18, 205, 42, 150, 8, 96, 30, 265];

/**
 * アプリ自体をSNSに貼ったときの絵。
 *
 * **共有ページのOGPとは別に要る。** ロードマップごとの絵は `/r/[slug]` にあるが、
 * 入口（`/`）を貼られたときは何も無く、素のリンクになっていた。
 * 見た目の言葉（紐・棚・朱）は共有ページと揃える。
 */
export default async function Image() {
  const font = await loadJapaneseFont(`${NAME}${LEAD}${SUB}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: PAPER,
          fontFamily: font ? "Noto Sans JP" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: 14, background: THREAD }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "74px 64px 0 58px",
          }}
        >
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700, color: INK }}>{NAME}</div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
            <div
              style={{ width: 26, height: 26, borderRadius: 13, background: THREAD, marginRight: 14 }}
            />
            <div style={{ display: "flex", fontSize: 36, color: THREAD, fontWeight: 700 }}>
              {LEAD}
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 18, fontSize: 28, color: "#6b6e75" }}>
            {SUB}
          </div>

          <div style={{ display: "flex", flex: 1 }} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                height: 186,
                paddingLeft: 10,
                background: "linear-gradient(180deg, #b49a72 0%, #9c8460 100%)",
                borderRadius: "8px 8px 0 0",
              }}
            >
              {SPINES.map((hue, i) => (
                <div
                  key={hue}
                  style={{
                    display: "flex",
                    width: 118,
                    height: 150 + (i % 3) * 14,
                    marginLeft: i === 0 ? 0 : 14,
                    borderRadius: 4,
                    background: `linear-gradient(160deg, hsl(${hue} 42% 44%), hsl(${hue + 22} 38% 28%))`,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                height: 18,
                background: "linear-gradient(180deg, #d8c39a 0%, #b99d73 100%)",
                borderRadius: "0 0 5px 5px",
              }}
            />
          </div>

          <div style={{ display: "flex", height: 52 }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Noto Sans JP", data: font, weight: 700 as const, style: "normal" as const }]
        : [],
    },
  );
}
