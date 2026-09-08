"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Book, Roadmap, RoadmapSummary } from "@/types/roadmap";

/**
 * ローカルの保存先。**ここが主で、Supabase が従**（CLAUDE.md 5章）。
 *
 * 操作のたびに即座にここへ書き、Supabase へは裏で送る。
 * 体感速度をネットワークから切り離すのが目的なので、書き込みを待たせない。
 *
 * ロードマップは1件が数KBしかないので、差分ではなく**丸ごと書き換える**。
 * 部分更新にすると「どこまで書けたか」の状態が増えて、壊れ方が読めなくなる。
 */

const DB_NAME = "roadmap";

/**
 * スキーマのバージョン。
 *
 * 保存済みの中身にフィールドを足したら、**必ずここを上げて移行を書く**。
 * IndexedDB は各ブラウザに残り続けるので、古い形のレコードが後から出てくる。
 * 実際 createdAt を足したとき、既存レコードで一覧の並べ替えが落ちた。
 *
 * 1 … 初版
 * 2 … Roadmap に createdAt を追加
 */
const DB_VERSION = 2;

interface RoadmapDB extends DBSchema {
  roadmaps: { key: string; value: Roadmap };
  books: { key: string; value: Book };
  meta: { key: string; value: string };
}

let dbPromise: Promise<IDBPDatabase<RoadmapDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<RoadmapDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("roadmaps", { keyPath: "id" });
          db.createObjectStore("books", { keyPath: "id" });
          db.createObjectStore("meta");
        }

        if (oldVersion < 2) {
          // createdAt を後から足したぶんを埋める。作られた時刻は分からないので、
          // 移行した時刻を入れる。一覧の並び順にしか使わないので実害はない
          const store = tx.objectStore("roadmaps");
          const now = new Date().toISOString();
          for (const roadmap of await store.getAll()) {
            if (!roadmap.createdAt) {
              await store.put({ ...roadmap, createdAt: now });
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

/**
 * IndexedDB が使えない環境がある（プライベートウィンドウ、ストレージを止めている設定）。
 * その場合は保存を諦めてメモリだけで動かす。落とすほどのことではない。
 */
async function withDb<T>(fn: (db: IDBPDatabase<RoadmapDB>) => Promise<T>): Promise<T | null> {
  try {
    return await fn(await getDb());
  } catch (e) {
    console.warn("[local] IndexedDB が使えません", e);
    return null;
  }
}

export type LocalSnapshot = { roadmap: Roadmap; books: Book[] };

function toSummary(roadmap: Roadmap): RoadmapSummary {
  return {
    id: roadmap.id,
    title: roadmap.title,
    tags: roadmap.tags,
    isPublic: roadmap.isPublic,
    shareSlug: roadmap.shareSlug,
    totalCount: roadmap.items.length,
    doneCount: roadmap.items.filter((i) => i.isDone).length,
    createdAt: roadmap.createdAt,
  };
}

/** 一覧。ネットワークを待たずに出せるのがこの層を持つ理由（CLAUDE.md 10章） */
export async function listLocal(): Promise<RoadmapSummary[]> {
  const rows = await withDb((db) => db.getAll("roadmaps"));
  return (rows ?? []).map(toSummary);
}

/** 1本ぶんを中身ごと読む */
export async function loadLocalRoadmap(id: string): Promise<LocalSnapshot | null> {
  return withDb(async (db) => {
    const roadmap = await db.get("roadmaps", id);
    if (!roadmap) return null;

    const bookIds = [...new Set(roadmap.items.map((i) => i.bookId))];
    const books = (await Promise.all(bookIds.map((bookId) => db.get("books", bookId)))).filter(
      (b): b is Book => b !== undefined,
    );

    return { roadmap, books };
  });
}

/** 現在の状態を丸ごと書く。操作のたびに呼ばれる */
export async function saveLocal({ roadmap, books }: LocalSnapshot): Promise<void> {
  await withDb(async (db) => {
    const tx = db.transaction(["roadmaps", "books"], "readwrite");
    await Promise.all([
      tx.objectStore("roadmaps").put(roadmap),
      ...books.map((book) => tx.objectStore("books").put(book)),
      tx.done,
    ]);
  });
}

/** 本人による明示的な削除。ここで消したものは戻らない */
export async function deleteLocalRoadmap(id: string): Promise<void> {
  await withDb((db) => db.delete("roadmaps", id));
}
