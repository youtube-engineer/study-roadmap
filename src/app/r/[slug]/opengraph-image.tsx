import { ImageResponse } from "next/og";

import { loadJapaneseFont } from "@/lib/og/font";
import { loadSharedRoadmap } from "@/lib/roadmaps/store";
import { displayTitle } from "@/lib/roadmaps/title";
import { allItems } from "@/types/roadmap";
import type { Book, RoadmapItem } from "@/types/roadmap";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "参考書ロードマップ";

const INK = "#1c1f26";
const THREAD = "#e4572e";
const PAPER = "#f7f6f2";

/** 棚に並べる冊数。これ以上は入らないし、入れても小さくなって読めない */
const MAX_COVERS = 6;
const COVER_W = 124;
const COVER_H = 174;

/**
 * SNSに貼られたときの絵。**ロードマップごとに作る。**
 *
 * 無いとカードは文字だけになる（`summary_large_image` を宣言しているので、
 * 大きな枠が空のまま出る）。共有が伸びるかどうかで全部が決まる（12章）ので、
 * ここの見栄えは効く。
 *
 * ★ **表紙を載せること。** 文字だけだと、何のロードマップなのかが伝わらず
 * どのカードも同じ顔になる。**表紙が唯一の彩り**（8章 規則2）で、
 * 棚に本が立っている絵はこのアプリそのものなので、踏む前と後で同じものに見える。
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadSharedRoadmap(slug);

  const roadmap = loaded?.roadmap;
  const byId = new Map((loaded?.books ?? []).map((b) => [b.id, b]));

  const title = roadmap ? displayTitle(roadmap.title) : "参考書ロードマップ";
  const goal = roadmap?.goal?.trim() ?? "";
  const items = roadmap ? allItems(roadmap) : [];
  const stageCount = roadmap?.stages.length ?? 0;

  /**
   * 名前の大きさは長さで決める。
   * 一定にすると、長い名前が3行に折れて棚を画面の外へ押し出す。
   */
  const titleSize = (t: string) => (t.length <= 12 ? 74 : t.length <= 18 ? 60 : t.length <= 26 ? 50 : 42);

  const shelf = items
    .map((item: RoadmapItem) => byId.get(item.bookId))
    .filter((b): b is Book => Boolean(b))
    .slice(0, MAX_COVERS);

  const font = await loadJapaneseFont(
    `${title}${goal}${shelf.map((b) => b.title).join("")}参考書ロードマップ冊段他0123456789`,
  );

  const fonts = font
    ? [{ name: "Noto Sans JP", data: font, weight: 700 as const, style: "normal" as const }]
    : [];

  const card = (withCovers: boolean) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: PAPER,
        fontFamily: font ? "Noto Sans JP" : "sans-serif",
      }}
    >
      {/* 左を紐が通る。経路であることを縦線1本で言う */}
      <div style={{ display: "flex", width: 14, background: THREAD }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "52px 64px 0 58px",
        }}
      >
        <div
          style={{ display: "flex", fontSize: 24, letterSpacing: 5, color: "#9a9ca2" }}
        >
          参考書ロードマップ
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: titleSize(title),
            lineHeight: 1.22,
            color: INK,
            fontWeight: 700,
          }}
        >
          {title.slice(0, 38)}
        </div>

        {goal ? (
          <div style={{ display: "flex", alignItems: "center", marginTop: 20 }}>
            <div
              style={{ width: 26, height: 26, borderRadius: 13, background: THREAD, marginRight: 14 }}
            />
            <div style={{ display: "flex", fontSize: 34, color: THREAD, fontWeight: 700 }}>
              {goal.slice(0, 24)}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", flex: 1 }} />

        {/* 棚。本が立っているところがこのアプリの顔 */}
        {withCovers && shelf.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                height: COVER_H + 12,
                paddingLeft: 10,
                background: "linear-gradient(180deg, #b49a72 0%, #9c8460 100%)",
                borderRadius: "8px 8px 0 0",
              }}
            >
              {shelf.map((book, i) => (
                <div
                  key={book.id}
                  style={{
                    display: "flex",
                    width: COVER_W,
                    height: COVER_H,
                    marginLeft: i === 0 ? 0 : 14,
                    borderRadius: 4,
                    overflow: "hidden",
                    background: `linear-gradient(160deg, hsl(${book.hue} 42% 44%), hsl(${book.hue + 22} 38% 28%))`,
                  }}
                >
                  {book.coverImageUrl ? (
                    <img
                      src={book.coverImageUrl}
                      alt=""
                      width={COVER_W}
                      height={COVER_H}
                      style={{ width: COVER_W, height: COVER_H, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        width: COVER_W,
                        height: COVER_H,
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 10,
                        color: "#ffffff",
                        fontSize: 19,
                        lineHeight: 1.3,
                        textAlign: "center",
                      }}
                    >
                      {book.title.slice(0, 18)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* 棚板 */}
            <div
              style={{
                display: "flex",
                height: 18,
                background: "linear-gradient(180deg, #d8c39a 0%, #b99d73 100%)",
                borderRadius: "0 0 5px 5px",
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 78,
            fontSize: 28,
            color: "#6b6e75",
          }}
        >
          参考書 {items.length} 冊
          {stageCount > 0 ? `　·　${stageCount} 段` : ""}
        </div>
      </div>
    </div>
  );

  /**
   * **表紙が1枚でも取れないと Satori は投げる。** そこで画像ごと落とさず、
   * 表紙抜きで作り直す。空のカードが出るより字だけでも出た方がいい。
   */
  try {
    return new ImageResponse(card(true), { ...size, fonts });
  } catch (e) {
    console.error("[og] 表紙を載せられなかった", e);
    return new ImageResponse(card(false), { ...size, fonts });
  }
}
