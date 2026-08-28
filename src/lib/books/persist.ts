import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { Book } from "@/types/roadmap";

/**
 * books テーブルへの**唯一の書き込み経路**。
 *
 * RLSに書き込みポリシーを作らず、anon/authenticated にGRANTも渡していないので、
 * ここ（secret key）以外からは物理的に書けない。CLAUDE.md 7章の
 * 「books への書き込み経路を1つに集約する」をDB権限の側でも担保している。
 *
 * 返すのは books.id。roadmap_items.book_id がこれを指す。
 */
export async function persistBook(book: Book): Promise<string | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  // books.source の check 制約に 'mock' は無い。モックは手入力と同じ扱いにする
  const source = book.source === "mock" ? "manual" : book.source;
  const externalId = book.isbn ? null : book.id;

  const existing = book.isbn
    ? await supabase.from("books").select("id").eq("isbn", book.isbn).maybeSingle()
    : await supabase
        .from("books")
        .select("id")
        .eq("source", source)
        .eq("external_id", book.id)
        .maybeSingle();

  if (existing.data) return existing.data.id;

  const { data, error } = await supabase
    .from("books")
    .insert({
      source,
      external_id: externalId,
      isbn: book.isbn,
      title: book.title,
      author: book.author || null,
      cover_image_url: book.coverImageUrl,
      source_url: book.sourceUrl,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[books/persist]", error);
    return null;
  }
  return data.id;
}
