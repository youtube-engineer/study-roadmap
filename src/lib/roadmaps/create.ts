import type { Roadmap } from "@/types/roadmap";

import { newShareSlug } from "./slug";

/**
 * まっさらなロードマップ。
 *
 * **この時点ではサーバーに何も作らない。** 匿名サインインも走らない。
 * IndexedDB に置くだけで、最初の書き込みで初めて roadmaps の行ができる
 * （CLAUDE.md 5章・sync.ts の ensureRoadmap）。
 */
export function newRoadmap(): Roadmap {
  return {
    id: crypto.randomUUID(),
    title: "新しいルート",
    isPublic: false,
    shareSlug: newShareSlug(),
    tags: [],
    items: [],
    authorName: null,
    copiedFrom: null,
    createdAt: new Date().toISOString(),
  };
}
