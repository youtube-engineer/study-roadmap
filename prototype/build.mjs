// src/ をバンドルして index.html に流し込み、dist/index.html を吐く。
// 単一ファイルにするのは、ビルドサーバーなしでブラウザで直接開けるようにするため。
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  outfile: 'bundle.js',
});

const js = result.outputFiles[0].text;
const head = readFileSync('index.html', 'utf8');

mkdirSync('dist', { recursive: true });
writeFileSync(
  'dist/index.html',
  `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
${head}
<script>
${js}
</script>
</body>
</html>
`
);

console.log('dist/index.html を書き出しました');
