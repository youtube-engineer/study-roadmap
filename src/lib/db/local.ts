"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Book, Roadmap } from "@/types/roadmap";

/**
 * ローカルの保存先。**ここが主で、Supabase が従**（CLAUDE.md 5章）。
 *
 * 操作のたびに即座にここへ書き、Supabase へは裏で送る。
 * 体感速度をネットワークから切り離すのが目的なので、書き込みを待たせない。
 *
 * ロードマップは1件が数KBしかないので、差分ではなく**丸ごと書き換える**。
 * 部分更新にすると「どこまで書けたか」の状態が増えて、壊れ方が読めなくなる。
 * 差分が必要になるのは Supabase 側だけで、そちらは sync.ts が持っている。
 */

const DB_NAME = "roadmap";
const DB_VERSION = 1;

/** 今どのロードマップを開いているか。将来複数持てるようにしたときの入口になる */
const CURRENT_KEY = "currentRoadmapId";

interface RoadmapDB extends DBSchema {
  roadmaps: { key: string; value: Roadmap };
  books: { key: string; value: Book };
  meta: { key: string; value: string };
}

let dbPromise: Promise<IDBPDatabase<RoadmapDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<RoadmapDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("roadmaps", { keyPath: "id" });
        db.createObjectStore("books", { keyPath: "id" });
        db.createObjectStore("meta");
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

/** 開いていたロードマップを読み出す。無ければ null（初回訪問） */
export async function loadLocal(): Promise<LocalSnapshot | null> {
  return withDb(async (db) => {
    const id = await db.get("meta", CURRENT_KEY);
    if (!id) return null;

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
    const tx = db.transaction(["roadmaps", "books", "meta"], "readwrite");
    await Promise.all([
      tx.objectStore("roadmaps").put(roadmap),
      ...books.map((book) => tx.objectStore("books").put(book)),
      tx.objectStore("meta").put(roadmap.id, CURRENT_KEY),
      tx.done,
    ]);
  });
}

/** 本人による明示的な削除。ここで消したものは戻らない */
export async function clearLocal(): Promise<void> {
  await withDb(async (db) => {
    const tx = db.transaction(["roadmaps", "books", "meta"], "readwrite");
    await Promise.all([
      tx.objectStore("roadmaps").clear(),
      tx.objectStore("books").clear(),
      tx.objectStore("meta").clear(),
      tx.done,
    ]);
  });
}
