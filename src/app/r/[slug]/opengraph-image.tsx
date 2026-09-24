import { ImageResponse } from "next/og";

import { loadJapaneseFont } from "@/lib/og/font";
import { loadSharedRoadmap } from "@/lib/roadmaps/store";
import { displayTitle } from "@/lib/roadmaps/title";
import { allItems } from "@/types/roadmap";
import type { Book, RoadmapStage } from "@/types/roadmap";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "参考書ロードマップ";

const INK = "#1c1f26";
const THREAD = "#e4572e";
const PAPER = "#f7f6f2";

const COVER_W = 86;
const COVER_H = 120;
/** 右端は切れてよい。**切れているから「まだ続く」に見える** */
const PER_SHELF = 4;
const SHELVES = 3;

type Row = { stage: RoadmapStage; books: Book[] };

/**
 * SNSに貼られたときの絵。**ロードマップごとに作る。**
 *
 * ★ **要素を縦に並べただけにしない。** 名前・目標・冊数を積むと、
 * どのカードも同じ顔の箇条書きになる。**写すのは画面そのもの**
 * ——紐が縦に通り、番号の玉があり、棚に表紙が立っている絵。
 * これがこのアプリの見た目（8章）なので、踏む前と後で同じものに見えるし、
 * 一目で「参考書を順番に並べたもの」だと伝わる。
 *
 * 右端で棚を切る。**切れているから「まだ続く」に見える。**
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

  const rows: Row[] = (roadmap?.stages ?? [])
    .map((stage) => ({
      stage,
      books: stage.items
        .map((i) => byId.get(i.bookId))
        .filter((b): b is Book => Boolean(b))
        .slice(0, PER_SHELF),
    }))
    .filter((r) => r.books.length > 0)
    .slice(0, SHELVES);

  const titleSize = title.length <= 11 ? 60 : title.length <= 17 ? 50 : title.length <= 25 ? 42 : 36;

  const font = await loadJapaneseFont(
    `${title}${goal}${rows.map((r) => r.stage.name).join("")}参考書ロードマップ冊段0123456789`,
  );
  const fonts = font
    ? [{ name: "Noto Sans JP", data: font, weight: 700 as const, style: "normal" as const }]
    : [];

  /**
   * **本が1冊も無いときは2段組みにしない。** 右半分が丸ごと空いて、
   * 読み込みに失敗したカードに見える。名前を大きく出して、空の棚を敷く。
   */
  const emptyCard = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: PAPER,
        fontFamily: font ? "Noto Sans JP" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", width: 14, flexShrink: 0, background: THREAD }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "74px 64px 0 58px",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: "#9a9ca2" }}>
          参考書ロードマップ
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: title.length <= 14 ? 72 : title.length <= 24 ? 58 : 46,
            lineHeight: 1.24,
            color: INK,
            fontWeight: 700,
          }}
        >
          {title.slice(0, 44)}
        </div>
        {goal ? (
          <div style={{ display: "flex", alignItems: "center", marginTop: 24 }}>
            <div
              style={{ width: 26, height: 26, borderRadius: 13, background: THREAD, marginRight: 14 }}
            />
            <div style={{ display: "flex", fontSize: 34, color: THREAD, fontWeight: 700 }}>
              {goal.slice(0, 24)}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", flex: 1 }} />

        <div
          style={{
            display: "flex",
            height: 150,
            background: "linear-gradient(180deg, #b49a72 0%, #9c8460 100%)",
            borderRadius: "8px 8px 0 0",
          }}
        />
        <div
          style={{
            display: "flex",
            height: 18,
            background: "linear-gradient(180deg, #d8c39a 0%, #b99d73 100%)",
            borderRadius: "0 0 5px 5px",
          }}
        />
        <div style={{ display: "flex", height: 54, alignItems: "center", fontSize: 25, color: "#6b6e75" }}>
          {stageCount > 0 ? `${stageCount} 段` : "これから作るところ"}
        </div>
      </div>
    </div>
  );

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
      {/* 左の帯。画面の紐と同じ意味で、カードの縁にも経路を通しておく */}
      {/* flexShrink を切らないと、右の棚に押されて帯が消える */}
      <div style={{ display: "flex", width: 14, flexShrink: 0, background: THREAD }} />

      {/* 左：名乗りと、何を目指すルートなのか */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 516,
          flexShrink: 0,
          padding: "58px 24px 56px 52px",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: "#9a9ca2" }}>
          参考書ロードマップ
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: titleSize,
            lineHeight: 1.26,
            color: INK,
            fontWeight: 700,
          }}
        >
          {title.slice(0, 40)}
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        {goal ? (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 22 }}>
            <div style={{ display: "flex", fontSize: 19, letterSpacing: 4, color: "#9a9ca2" }}>
              GOAL
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: THREAD,
                  marginRight: 12,
                }}
              />
              <div style={{ display: "flex", fontSize: 32, color: THREAD, fontWeight: 700 }}>
                {goal.slice(0, 22)}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", fontSize: 25, color: "#6b6e75" }}>
          参考書 {items.length} 冊{stageCount > 0 ? `　·　${stageCount} 段` : ""}
        </div>
      </div>

      {/* 右：画面そのもの。紐が縦に通り、玉の右に棚が載る */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {/* 縦の紐。上下に抜けさせて、前後があることを見せる */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 26,
            top: 0,
            bottom: 0,
            width: 6,
            background: THREAD,
            opacity: 0.32,
          }}
        />

        {/*
          **段が少ないときは縦中央に置く。** 上に寄せると、1段のロードマップで
          下半分が丸ごと空いて壊れたカードに見える。
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            paddingTop: 10,
            paddingBottom: 10,
          }}
        >
          {rows.map((row, i) => (
            <div key={row.stage.id} style={{ display: "flex", marginBottom: 14 }}>
              {/* 番号の玉 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  marginLeft: 9,
                  marginRight: 16,
                  borderRadius: 20,
                  background: PAPER,
                  border: `5px solid ${THREAD}`,
                  color: THREAD,
                  fontSize: 21,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>

              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {row.stage.name ? (
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      color: INK,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {row.stage.name.slice(0, 14)}
                  </div>
                ) : (
                  <div style={{ display: "flex", height: 28 }} />
                )}

                {/* 棚 */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      height: COVER_H + 10,
                      paddingLeft: 10,
                      background: "linear-gradient(180deg, #b49a72 0%, #9c8460 100%)",
                      borderRadius: "6px 0 0 0",
                    }}
                  >
                    {withCovers
                      ? row.books.map((book, j) => (
                          <div
                            key={book.id}
                            style={{
                              display: "flex",
                              width: COVER_W,
                              height: COVER_H,
                              marginLeft: j === 0 ? 0 : 11,
                              borderRadius: 3,
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
                                  padding: 8,
                                  color: "#ffffff",
                                  fontSize: 15,
                                  lineHeight: 1.3,
                                  textAlign: "center",
                                }}
                              >
                                {book.title.slice(0, 16)}
                              </div>
                            )}
                          </div>
                        ))
                      : row.books.map((book) => (
                          <div
                            key={book.id}
                            style={{
                              display: "flex",
                              width: COVER_W,
                              height: COVER_H,
                              marginLeft: 11,
                              borderRadius: 3,
                              background: `linear-gradient(160deg, hsl(${book.hue} 42% 44%), hsl(${book.hue + 22} 38% 28%))`,
                            }}
                          />
                        ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: 14,
                      background: "linear-gradient(180deg, #d8c39a 0%, #b99d73 100%)",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (rows.length === 0) return new ImageResponse(emptyCard, { ...size, fonts });

  /** 表紙が1枚でも取れないと Satori は投げる。画像ごと落とさず色帯で出す */
  try {
    return new ImageResponse(card(true), { ...size, fonts });
  } catch (e) {
    console.error("[og] 表紙を載せられなかった", e);
    return new ImageResponse(card(false), { ...size, fonts });
  }
}
