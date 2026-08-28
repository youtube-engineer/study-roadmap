// 検索対象になる参考書の模擬データ（英検・大学受験英語）
export const CATALOG = [
  { id: 'b1', title: '英検2級 過去6回全問題集', author: '旺文社', year: '2025', hue: 210 },
  { id: 'b2', title: '英検2級 でる順パス単', author: '旺文社', year: '2024', hue: 18 },
  { id: 'b3', title: '英検2級 文で覚える単熟語', author: '旺文社', year: '2024', hue: 160 },
  { id: 'b4', title: '英検2級 総合対策教本', author: '旺文社', year: '2024', hue: 268 },
  { id: 'b5', title: 'DAILY20日間 英検2級 集中ゼミ', author: '旺文社', year: '2024', hue: 42 },
  { id: 'b6', title: '英検2級 二次試験・面接完全予想問題', author: '旺文社', year: '2024', hue: 340 },
  { id: 'b7', title: '英検2級 リスニング問題完全制覇', author: 'ジャパンタイムズ出版', year: '2023', hue: 190 },
  { id: 'b8', title: '英検準2級 でる順パス単', author: '旺文社', year: '2024', hue: 96 },
  { id: 'b9', title: '英検準1級 でる順パス単', author: '旺文社', year: '2024', hue: 4 },
  { id: 'b10', title: '英文法ポラリス1', author: 'KADOKAWA', year: '2019', hue: 232 },
  { id: 'b11', title: '英単語ターゲット1900', author: '旺文社', year: '2023', hue: 30 },
  { id: 'b12', title: 'システム英単語', author: '駿台文庫', year: '2019', hue: 140 },
  { id: 'b13', title: '英検2級 頻出度別問題集', author: '高橋書店', year: '2023', hue: 300 },
  { id: 'b14', title: '関正生の英文法ポラリス2', author: 'KADOKAWA', year: '2020', hue: 250 },
  { id: 'b15', title: '英検準1級 過去6回全問題集', author: '旺文社', year: '2025', hue: 224 },
  { id: 'b16', title: '英検準1級 文で覚える単熟語', author: '旺文社', year: '2024', hue: 172 },
  { id: 'b17', title: '英検準1級 二次試験・面接完全予想問題', author: '旺文社', year: '2024', hue: 320 },
];

export const byId = (id) => CATALOG.find((b) => b.id === id);

/* 自分のルート（編集画面の初期状態） */
export const MY_TITLE = '英検2級までのルート';
export const MY_TAGS = ['英検', '英検2級'];
export const MY_ITEMS = [
  { key: 'i1', bookId: 'b8', done: true, rounds: 3, note: '知らない単語だけ付箋。2周目からは付箋の分だけ。' },
  { key: 'i2', bookId: 'b2', done: true, rounds: 3, note: '' },
  { key: 'i3', bookId: 'b4', done: false, rounds: 2, note: 'ライティングの型はここで覚える。英作文の章は最優先。' },
  { key: 'i4', bookId: 'b1', done: false, rounds: 1, note: '' },
  { key: 'i5', bookId: 'b6', done: false, rounds: null, note: '一次に受かってから着手でいい。' },
];

/* 他人が共有しているルート（共有ページに出るもの） */
export const SHARED_AUTHOR = 'ひなた';
export const SHARED_TITLE = '独学で英検準1級に受かるまで';
export const SHARED_TAGS = ['英検', '英検準1級', '独学'];
export const SHARED_ITEMS = [
  { key: 's1', bookId: 'b9', done: true, rounds: 4, note: '準1級はここが山場。1日100語を高速で回して、4周する前提で組んだ方がいい。' },
  { key: 's2', bookId: 'b16', done: true, rounds: 2, note: '単語が頭に入ってから。文章で覚え直すと定着が全然違う。' },
  { key: 's3', bookId: 'b15', done: true, rounds: 2, note: '1周目は時間を計らずに解いて、2周目から本番の時間で。' },
  { key: 's4', bookId: 'b7', done: false, rounds: 1, note: 'リスニングが足を引っ張るなら早めに挟む。2級用だが準1級対策としても効く。' },
  { key: 's5', bookId: 'b17', done: false, rounds: 1, note: '一次に受かってからで間に合う。音読は毎日やる。' },
];
