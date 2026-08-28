# study-roadmap

参考書をどの順番で進めるかを、1本の経路として可視化・共有するWebアプリ。
（プロダクト名は未確定。`study-roadmap` はリポジトリ名としての仮称）

## 現在の状態

**本実装はまだ無い。** 要件定義とプロトタイプまで。

| パス | 内容 |
|---|---|
| `CLAUDE.md` | **設計判断とその理由の記録。** 実装を始める前にまずここを読む |
| `docs/requirements.html` | 要件定義書（ブラウザで開く） |
| `prototype/` | React単体の動作プロトタイプ。**本実装ではない**が、検証済みの箇所は移植する |

## プロトタイプを動かす

```bash
cd prototype
pnpm install
pnpm build
open dist/index.html   # スマホの実機でも確認すること
```

詳細は `prototype/README.md`。

## 本実装の予定スタック

Next.js / TypeScript / Vercel / Supabase / shadcn/ui / dnd-kit / fractional-indexing

本実装はこのリポジトリのルートに置き、`prototype/` は参照用として横に残す。

## 実装を始める前に必ず読むところ

- `CLAUDE.md` 7章 — 外部APIと法務上の制約。楽天ブックスAPIのみを使う理由と、
  Google Books / Amazonアソシエイトを併用できない理由
- `CLAUDE.md` 9章 — 実装時の落とし穴。`touch-action` とdnd-kitのセンサーは
  知らずに書くと必ず踏む
- **最初にやる疎通確認**: 楽天のドメイン許可でサーバーサイドfetchが通るか（7章）
