-- ★ 並び順のキーを「バイト順」で並べさせる。
--
-- fractional-indexing は**先頭へ挿入すると大文字から始まるキー**を作る
-- （a0 の前は Zz、その前は Zy）。ブラウザの文字列比較はコード単位の順なので
-- Zz < a0 だが、**Postgres の既定の照合順は言語向け**で a0 < Zz になる。
--
-- つまり同じキーの組でも、編集画面（JS で並べる）と共有ページ／サーバー
-- （order by で並べる）が**逆の順を出す**。段を一番上へ動かすと、
-- 共有ページでは一番下に出る——「共有すると段がバラバラ」の正体。
--
-- collate "C" はバイト順なので、ブラウザ側と一致する。
-- 型は変えていないので、入っている値はそのまま。
alter table public.roadmap_stages
  alter column fractional_index type text collate "C";

alter table public.roadmap_items
  alter column fractional_index type text collate "C";
