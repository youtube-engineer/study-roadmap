# study-roadmap

参考書をどの順番で進めるかを、1本の経路として可視化・共有するWebアプリ。
（プロダクト名は未確定。`study-roadmap` はリポジトリ名としての仮称）

## 現在の状態

編集画面と共有ページが動く。**書誌データはモックで、保存もまだ無い。**

| パス | 内容 |
|---|---|
| `CLAUDE.md` | **設計判断とその理由の記録。** 触る前にまずここを読む |
| `docs/requirements.html` | 要件定義書（ブラウザで開く） |
| `src/` | 本実装（Next.js / TypeScript / Tailwind） |

## 動かす

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

- `/` … 編集画面。右端の握りをつまむと並び替え、カードを押すと詳細、番号の玉で終了の印
- `/r/hinata-eiken1` … 共有ページ（SSR）。下端の「コピーして使う」で `/` に複製が入る

```bash
pnpm build          # 本番ビルド
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
```

## 楽天APIを入れる

`RAKUTEN_APPLICATION_ID` が空のあいだはモックの17冊で動く。入れると楽天に切り替わる。
コードは `src/lib/books/rakuten.ts` に書いてあるので、足すものは無い。

```bash
cp .env.example .env.local   # RAKUTEN_APPLICATION_ID を埋める
```

**アプリID登録では応募タイプに「ウェブアプリケーション」を選ぶこと。**
「API/バックエンドサービス」を選ぶとIPアドレスでの許可リストになり、Vercelの
サーバーレスは送信元IPが動的なので詰む（`CLAUDE.md` 7章）。

入れたら最初に疎通確認をする。ドメイン許可でサーバーサイドfetchが通るかは未検証で、
弾かれた場合は `RAKUTEN_REFERER` に登録ドメインを入れる。

## Supabase を入れる

これも入れるまではモックで動く。手順は `CLAUDE.md` 14章。

```bash
pnpm dlx supabase link --project-ref <ref> && pnpm dlx supabase db push
```

`supabase/migrations/` にスキーマ・RLS・GRANTがある。**preview と本番の両方に流すこと。**

Dashboard の Data API 設定は **Data API 有効 / 新規テーブルの自動公開 無効 / 自動RLS 有効**。
自動公開を切っている前提で GRANT を SQL に書いてあるので、ダッシュボードの設定が
プロジェクト間でずれても公開範囲は揃う。

## 保存について

**IndexedDB に保存されるので、Supabase を繋がなくてもリロードで消えない。**
追加・並び替え・終了の印・メモ・周回、すべて残る。Supabase はその裏で送る同期先で、
鍵が無ければ何もしない（設計の理由は `CLAUDE.md` 5章と14章）。

## 未着手

タグの補完UI / 保存状態の表示 / 取り消し / ログイン /
端末をまたいだときの突き合わせ

## 実装を始める前に必ず読むところ

- `CLAUDE.md` 7章 — 外部APIと法務上の制約。楽天ブックスAPIのみを使う理由と、
  Google Books / Amazonアソシエイトを併用できない理由
- `CLAUDE.md` 9章 — 実装時の落とし穴。`touch-action` とdnd-kitのセンサーは
  知らずに書くと必ず踏む。該当コードは `src/lib/dnd/roadmap-sensor.ts` と
  `src/components/roadmap/StopRow.tsx`
- `CLAUDE.md` 14章 — コードの構造と、まだモックのものの一覧
