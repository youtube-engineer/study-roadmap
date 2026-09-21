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

- `/` … 自分のルート一覧。「新しいルートを作る」から始める
- `/roadmaps/[id]` … 編集画面。右端の握りをつまむと並び替え、カードを押すと詳細、番号の玉で終了の印
- `/r/[slug]` … 共有ページ（SSR）。下端の「コピーして使う」で自分のものとして複製される

```bash
pnpm build          # 本番ビルド
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
```

## 楽天APIを入れる

3つとも入れる。どれかが欠けるとモックのままか、400 / 403 になる。

```bash
cp .env.example .env.local
```

```
RAKUTEN_APPLICATION_ID   UUID形式
RAKUTEN_ACCESS_KEY       pk_ で始まる
RAKUTEN_ORIGIN           楽天に登録した許可ドメイン
```

**アプリ登録では応募タイプに「ウェブアプリケーション」を選ぶこと。**
「API/バックエンドサービス」を選ぶとIPアドレスでの許可リストになり、Vercelの
サーバーレスは送信元IPが動的なので詰む（`CLAUDE.md` 7章）。

`RAKUTEN_ORIGIN` はサーバーから叩くので必須。fetch は Origin を自動送信しないため、
無いと 403 が返る。

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
