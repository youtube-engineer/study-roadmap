/**
 * DBのスキーマ。supabase/migrations/0001_init.sql と対応している。
 *
 * `supabase gen types typescript` で生成し直せるが、生成物を読むより
 * 手で書いた方がカラムの意図が残る。SQLを変えたらここも変えること。
 */

type Timestamptz = string;

export type Database = {
  public: {
    Tables: {
      books: {
        Row: {
          id: string;
          source: "rakuten" | "openbd" | "manual";
          external_id: string | null;
          isbn: string | null;
          title: string;
          author: string | null;
          cover_image_url: string | null;
          source_url: string | null;
          fetched_at: Timestamptz;
        };
        Insert: {
          id?: string;
          source: "rakuten" | "openbd" | "manual";
          external_id?: string | null;
          isbn?: string | null;
          title: string;
          author?: string | null;
          cover_image_url?: string | null;
          source_url?: string | null;
          fetched_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      roadmaps: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          is_public: boolean;
          share_slug: string;
          copied_from_id: string | null;
          copied_from_title: string | null;
          copied_from_name: string | null;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          title?: string;
          is_public?: boolean;
          share_slug?: string;
          copied_from_id?: string | null;
          copied_from_title?: string | null;
          copied_from_name?: string | null;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["roadmaps"]["Insert"]>;
        Relationships: [];
      };
      roadmap_stages: {
        Row: {
          id: string;
          roadmap_id: string;
          name: string;
          fractional_index: string;
        };
        Insert: {
          id?: string;
          roadmap_id: string;
          name?: string;
          fractional_index: string;
        };
        Update: Partial<Database["public"]["Tables"]["roadmap_stages"]["Insert"]>;
        Relationships: [];
      };
      roadmap_items: {
        Row: {
          id: string;
          roadmap_id: string;
          stage_id: string;
          book_id: string;
          fractional_index: string;
          is_done: boolean;
          rounds_target: number | null;
          note: string;
        };
        Insert: {
          id?: string;
          roadmap_id: string;
          stage_id: string;
          book_id: string;
          fractional_index: string;
          is_done?: boolean;
          rounds_target?: number | null;
          note?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roadmap_items"]["Insert"]>;
        Relationships: [];
      };
      tags: {
        Row: { id: string; name: string; normalized_key: string; usage_count: number };
        Insert: { id?: string; name: string; normalized_key: string; usage_count?: number };
        Update: Partial<Database["public"]["Tables"]["tags"]["Insert"]>;
        Relationships: [];
      };
      roadmap_tags: {
        Row: { roadmap_id: string; tag_id: string };
        Insert: { roadmap_id: string; tag_id: string };
        Update: Partial<Database["public"]["Tables"]["roadmap_tags"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
