import { ImageResponse } from "next/og";

import { loadJapaneseFont } from "@/lib/og/font";
import { loadSharedRoadmap } from "@/lib/roadmaps/store";
import { displayTitle } from "@/lib/roadmaps/title";
import { allItems } from "@/types/roadmap";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "参考書ロードマップ";

/**
 * SNSに貼られたときの絵。
 *
 * **ここが無いと、カードは文字だけの寂しいものになる。**
 * `summary_large_image` を宣言しているのに画像が無いと、その大きな枠が
 * 空のまま出る（12章の共有が伸びるかどうかが全部の前提なので、ここは効く）。
 *
 * 出すのは**そのロードマップの中身**——名前・目標・段の名前・冊数。
 * 一般的な宣伝文句ではなく、貼った人が「自分のもの」と分かる絵にする。
 * 紐と玉と朱は画面と同じなので、踏む前と後で同じサービスに見える。
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadSharedRoadmap(slug);

  const roadmap = loaded?.roadmap;
  const title = roadmap ? displayTitle(roadmap.title) : "参考書ロードマップ";
  const goal = roadmap?.goal?.trim() || "";
  const count = roadmap ? allItems(roadmap).length : 0;
  const stages = (roadmap?.stages ?? []).filter((s) => s.name.trim()).slice(0, 4);

  const font = await loadJapaneseFont(
    `${title}${goal}${stages.map((s) => s.name).join("")}参考書ロードマップ冊GOAL0123456789`,
  );

  const ink = "#1c1f26";
  const thread = "#e4572e";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f6f2",
          padding: "68px 76px",
          fontFamily: font ? "Noto Sans JP" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 6,
              color: "#8a8c92",
              marginBottom: 26,
            }}
          >
            参考書ロードマップ
          </div>

          <div
            style={{
              display: "flex",
              fontSize: title.length > 22 ? 62 : 78,
              lineHeight: 1.25,
              color: ink,
              fontWeight: 700,
            }}
          >
            {title.slice(0, 44)}
          </div>

          {goal ? (
            <div style={{ display: "flex", alignItems: "center", marginTop: 30 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  background: thread,
                  marginRight: 16,
                }}
              />
              <div style={{ display: "flex", fontSize: 38, color: thread, fontWeight: 700 }}>
                {goal.slice(0, 26)}
              </div>
            </div>
          ) : null}
        </div>

        {/* 段を紐の上の玉として並べる。経路であることが一目で伝わる */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {stages.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", marginBottom: 34 }}>
              {stages.map((stage, i) => (
                <div key={stage.id} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 ? (
                    <div style={{ width: 46, height: 5, background: thread, opacity: 0.35 }} />
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#ffffff",
                      border: `4px solid ${thread}`,
                      borderRadius: 999,
                      padding: "10px 26px",
                      fontSize: 30,
                      color: ink,
                      fontWeight: 700,
                    }}
                  >
                    {stage.name.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", fontSize: 32, color: "#6b6e75" }}>
            参考書 {count} 冊
          </div>
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
