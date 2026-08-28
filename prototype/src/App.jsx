import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CATALOG, byId,
  MY_TITLE, MY_TAGS, MY_ITEMS,
  SHARED_AUTHOR, SHARED_TITLE, SHARED_TAGS, SHARED_ITEMS,
} from './data';

let seq = 100;
const nextKey = () => `i${++seq}`;
const SHARE_URL = 'shiori.app/r/8k2m4p';

const inGrip = (t) => !!(t && t.closest && t.closest('[data-grip]'));
const inButton = (t) => !!(t && t.closest && t.closest('button'));

const GRIP_CONSTRAINT = { distance: 4 };
const BODY_CONSTRAINT = { delay: 220, tolerance: 8 };
let pressedGrip = false;

/* dnd-kitは同じ onPointerDown を持つセンサーを複数登録すると後勝ちで
   上書きされるため、1つにまとめて押した場所で条件を切り替える。 */
class RoadmapSensor extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown',
    handler: ({ nativeEvent: e }) => {
      if (!e.isPrimary || e.button !== 0) return false;
      if (inButton(e.target)) return false;
      pressedGrip = inGrip(e.target);
      return true;
    },
  }];
  constructor(props) {
    super({
      ...props,
      options: { ...props.options, activationConstraint: pressedGrip ? GRIP_CONSTRAINT : BODY_CONSTRAINT },
    });
  }
}

function Cover({ hue, size = 'md' }) {
  return (
    <div className={`cover ${size}`}
      style={{ background: `linear-gradient(155deg, hsl(${hue} 44% 56%), hsl(${hue + 22} 40% 38%))` }}
      aria-hidden="true" />
  );
}

const Check = (p) => (
  <svg viewBox="0 0 24 24" width={p.s || 13} height={p.s || 13} aria-hidden="true">
    <path d="M4.5 12.6l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Flag = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <path d="M5 3v18M5 4h13l-3 4 3 4H5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

/* ---------------- 編集：経路上の1冊 ---------------- */
function Stop({ item, book, index, onToggleDone, onOpen, isOverlay }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key, disabled: isOverlay });
  const dragged = useRef(false);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  const stop = (e) => e.stopPropagation();

  useEffect(() => {
    if (isDragging) dragged.current = true;
    else if (dragged.current) {
      const t = setTimeout(() => { dragged.current = false; }, 140);
      return () => clearTimeout(t);
    }
  }, [isDragging]);

  return (
    <div ref={isOverlay ? undefined : setNodeRef} style={isOverlay ? undefined : style}
      className={`stop ${item.done ? 'is-done' : ''} ${isOverlay ? 'overlay' : ''}`}>
      {!isOverlay && (
        <div className="rail">
          <span className="thread" aria-hidden="true" />
          <button type="button" className="bead" aria-pressed={item.done}
            aria-label={item.done ? `${book.title} を未完了に戻す` : `${book.title} を終了にする`}
            onPointerDown={stop} onClick={(e) => { stop(e); onToggleDone(item.key); }}>
            {item.done ? <Check /> : index + 1}
          </button>
        </div>
      )}
      <div className="card" role={isOverlay ? undefined : 'button'} tabIndex={isOverlay ? undefined : 0}
        onClick={isOverlay ? undefined : () => { if (!dragged.current) onOpen(item.key); }}
        onKeyDown={isOverlay ? undefined : (e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(item.key); } }}
        {...(isOverlay ? {} : listeners)} {...(isOverlay ? {} : attributes)}>
        <Cover hue={book.hue} />
        <div className="meta">
          <div className="t">{book.title}</div>
          <div className="sub">
            <span className="au">{book.author}</span>
            {item.rounds ? <span className="chip">{item.rounds}周</span> : null}
            {item.note ? <span className="chip memo">メモ</span> : null}
          </div>
        </div>
        {!isOverlay && (
          <span className="handle" data-grip="" aria-hidden="true">
            <svg viewBox="0 0 18 18" width="15" height="15">
              <circle cx="6" cy="4" r="1.4" /><circle cx="12" cy="4" r="1.4" />
              <circle cx="6" cy="9" r="1.4" /><circle cx="12" cy="9" r="1.4" />
              <circle cx="6" cy="14" r="1.4" /><circle cx="12" cy="14" r="1.4" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------- 共有：メモを開かず読める形 ---------------- */
function SharedStop({ item, book, index }) {
  return (
    <div className="stop shared">
      <div className="rail">
        <span className="thread" aria-hidden="true" />
        <span className="bead static">{index + 1}</span>
      </div>
      <div className="scard">
        <div className="shead">
          <Cover hue={book.hue} />
          <div className="meta">
            <div className="t">{book.title}</div>
            <div className="sub">
              <span className="au">{book.author}</span>
              {item.rounds ? <span className="chip">{item.rounds}周</span> : null}
            </div>
          </div>
        </div>
        {item.note ? <p className="snote">{item.note}</p> : null}
      </div>
    </div>
  );
}

function ResultRow({ book, onPick, already }) {
  return (
    <button type="button" className={`res ${already ? 'has' : ''}`} onClick={() => onPick(book.id)} disabled={already}>
      <Cover hue={book.hue} size="sm" />
      <div className="meta">
        <div className="t">{book.title}</div>
        <div className="a">{book.author}・{book.year}</div>
      </div>
      <span className="plus">{already ? '追加済み' : '追加'}</span>
    </button>
  );
}

function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <div className={`sheet-wrap ${open ? 'on' : ''}`} aria-hidden={!open}>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="grip" />
        <div className="sheet-head">
          <span>{title}</span>
          <button type="button" className="close" onClick={onClose}>閉じる</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchSheet({ open, onClose, onPick, present }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const results = useMemo(() => {
    const s = q.trim();
    if (!s) return CATALOG.slice(0, 7);
    return CATALOG.filter((b) => b.title.includes(s) || b.author.includes(s));
  }, [q]);
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 200); } }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="参考書をさがす">
      <div className="field-row">
        <svg viewBox="0 0 20 20" width="16" height="16" className="mag" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" strokeWidth="2" stroke="currentColor" />
          <line x1="12.6" y1="12.6" x2="17.5" y2="17.5" strokeWidth="2" stroke="currentColor" strokeLinecap="round" />
        </svg>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="書名・出版社で探す" />
      </div>
      <div className="sheet-body list">
        {results.length === 0
          ? <div className="empty">見つかりませんでした<span>手で入力して追加することもできます</span></div>
          : results.map((b) => <ResultRow key={b.id} book={b} onPick={onPick} already={present.has(b.id)} />)}
      </div>
    </Sheet>
  );
}

function DetailSheet({ item, onClose, onPatch, onRemove }) {
  const book = item ? byId(item.bookId) : null;
  const [note, setNote] = useState('');
  const [rounds, setRounds] = useState(null);
  useEffect(() => { if (item) { setNote(item.note || ''); setRounds(item.rounds ?? null); } }, [item?.key]);
  const commit = () => { if (item) onPatch(item.key, { note, rounds }); onClose(); };
  const setR = (v) => setRounds(v === null ? null : Math.max(1, Math.min(20, v)));

  return (
    <Sheet open={!!item} onClose={commit} title="参考書の設定">
      {item && (
        <div className="sheet-body detail">
          <div className="dhead">
            <Cover hue={book.hue} />
            <div>
              <div className="dt">{book.title}</div>
              <div className="da">{book.author}</div>
            </div>
          </div>
          <button type="button" className={`done-btn ${item.done ? 'on' : ''}`}
            onClick={() => onPatch(item.key, { done: !item.done })}>
            <span className="tick">{item.done ? <Check s={14} /> : null}</span>
            {item.done ? 'この参考書は終了した' : '終了にする'}
          </button>
          <div className="fld">
            <label className="lb">周回の目標</label>
            <div className="stepper">
              <button type="button" onClick={() => setR(rounds ? rounds - 1 : null)} disabled={!rounds} aria-label="減らす">−</button>
              <span className="val">{rounds ? `${rounds}周` : '決めない'}</span>
              <button type="button" onClick={() => setR(rounds ? rounds + 1 : 1)} aria-label="増やす">＋</button>
              {rounds ? <button type="button" className="clear" onClick={() => setR(null)}>目標を外す</button> : null}
            </div>
            <p className="note-h">最初に決めるだけの目標。今何周目かは記録しない。</p>
          </div>
          <div className="fld">
            <label className="lb" htmlFor="memo">この本を使うときのメモ</label>
            <textarea id="memo" value={note} onChange={(e) => setNote(e.target.value)} rows={4}
              placeholder="例：知らない単語だけ付箋を貼って、2周目からは付箋の分だけやる" />
            <p className="note-h">共有したとき、このメモが相手に読まれる部分になる。</p>
          </div>
          <div className="dfoot">
            <button type="button" className="danger" onClick={() => { onRemove(item.key); onClose(); }}>ルートから外す</button>
            <button type="button" className="primary" onClick={commit}>保存して閉じる</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ShareSheet({ open, onClose, isPublic, setPublic, onPreview, title, count }) {
  const [copied, setCopied] = useState(false);
  const fieldRef = useRef(null);
  useEffect(() => { if (!open) setCopied(false); }, [open]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(`https://${SHARE_URL}`); }
    catch {
      const el = fieldRef.current;
      if (el) { el.removeAttribute('readonly'); el.select(); try { document.execCommand('copy'); } catch {} el.setAttribute('readonly', ''); }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <Sheet open={open} onClose={onClose} title="このルートを共有する">
      <div className="sheet-body share">
        <button type="button" className={`toggle-row ${isPublic ? 'on' : ''}`} onClick={() => setPublic(!isPublic)} aria-pressed={isPublic}>
          <span className="tg" aria-hidden="true"><span className="knob" /></span>
          <span className="tg-txt">
            <span className="tg-t">リンクを知っている人が見られる</span>
            <span className="tg-d">{isPublic ? '公開中。相手は閲覧とコピーができ、あなたのルートは書き換えられない。' : '今は自分だけが見られる状態。'}</span>
          </span>
        </button>

        <div className={`share-body ${isPublic ? '' : 'off'}`}>
          <div className="url-row">
            <input ref={fieldRef} className="url" readOnly value={SHARE_URL} onFocus={(e) => e.target.select()} />
            <button type="button" className={`copybtn ${copied ? 'done' : ''}`} onClick={copy} disabled={!isPublic}>
              {copied ? 'コピーした' : 'コピー'}
            </button>
          </div>
          <div className="ogp">
            <div className="ogp-cap">SNSに貼ったときの見え方</div>
            <div className="ogp-card">
              <div className="ogp-thumb">
                <span className="ogp-line" aria-hidden="true" />
                {[210, 18, 268, 30].map((h, i) => (
                  <span key={i} className="ogp-dot" style={{ background: `hsl(${h} 44% 52%)` }} />
                ))}
              </div>
              <div className="ogp-meta">
                <div className="ogp-t">{title}</div>
                <div className="ogp-s">参考書{count}冊のルート ・ しおり</div>
                <div className="ogp-u">{SHARE_URL}</div>
              </div>
            </div>
          </div>
          <button type="button" className="ghost-btn" onClick={onPreview} disabled={!isPublic}>
            他人が見ているルートの例を見る
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- 本体 ---------------- */
export default function App() {
  const [view, setView] = useState('edit');
  const [title, setTitle] = useState(MY_TITLE);
  const [tags, setTags] = useState(MY_TAGS);
  const [items, setItems] = useState(MY_ITEMS);
  const [origin, setOrigin] = useState(null); // 複製元
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isPublic, setPublic] = useState(true);
  const [detailKey, setDetailKey] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const [toast, setToast] = useState(null);

  const sensors = useSensors(
    useSensor(RoadmapSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const present = useMemo(() => new Set(items.map((i) => i.bookId)), [items]);
  const doneCount = items.filter((i) => i.done).length;

  const onDragEnd = ({ active, over }) => {
    setActiveKey(null);
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const a = prev.findIndex((i) => i.key === active.id);
      const b = prev.findIndex((i) => i.key === over.id);
      return a < 0 || b < 0 ? prev : arrayMove(prev, a, b);
    });
  };

  const patch = useCallback((key, f) => setItems((p) => p.map((i) => (i.key === key ? { ...i, ...f } : i))), []);
  const toggleDone = useCallback((key) => setItems((p) => p.map((i) => (i.key === key ? { ...i, done: !i.done } : i))), []);
  const addBook = useCallback((bookId) => {
    setItems((p) => [...p, { key: nextKey(), bookId, done: false, rounds: null, note: '' }]);
    setSearchOpen(false);
  }, []);
  const removeItem = (key) => setItems((p) => p.filter((i) => i.key !== key));

  /* 共有ページから自分用に複製する */
  const copyRoute = () => {
    setItems(SHARED_ITEMS.map((i) => ({ ...i, key: nextKey(), done: false })));
    setTitle(SHARED_TITLE);
    setTags(SHARED_TAGS);
    setOrigin({ author: SHARED_AUTHOR, title: SHARED_TITLE });
    setView('edit');
    setToast('自分用にコピーした。ここから自由に並び替えられる。');
  };

  const startBlank = () => {
    setItems([]); setTitle('新しいルート'); setTags([]); setOrigin(null);
    setView('edit'); setToast('まっさらなルートを作った。');
  };

  const reset = () => {
    setItems(MY_ITEMS); setTitle(MY_TITLE); setTags(MY_TAGS); setOrigin(null);
    setSearchOpen(false); setDetailKey(null); setShareOpen(false); setView('edit'); setToast(null);
  };

  const activeItem = activeKey ? items.find((i) => i.key === activeKey) : null;
  const activeIdx = activeItem ? items.indexOf(activeItem) : 0;
  const detailItem = detailKey ? items.find((i) => i.key === detailKey) : null;

  return (
    <>
      <div className="controls">
        <div className="seg">
          <button type="button" className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>自分の編集画面</button>
          <button type="button" className={view === 'shared' ? 'on' : ''} onClick={() => setView('shared')}>他人の共有ページ</button>
        </div>
        <p className="hint">
          {view === 'edit'
            ? '右端の握りをつまむと並び替え。カードを押すと詳細、番号の玉を押すと終了の印。'
            : `${SHARED_AUTHOR}さんが公開しているルート。コピーすると自分の編集画面に入る。`}
        </p>
        <button type="button" className="reset" onClick={reset}>初期状態に戻す</button>
      </div>

      <div className="device">
        {view === 'edit' ? (
          <div className="app">
            <header className="topbar">
              <span className="spacer" />
              <button type="button" className="tb-btn" onClick={() => setShareOpen(true)}>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M12 15V4m0 0L8 8m4-4l4 4M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                共有
              </button>
              <button type="button" className="tb-btn login">ログイン</button>
            </header>

            <div className="route-head">
              <h1 className="route-title">{title}</h1>
              {origin && (
                <div className="origin">
                  <span>{origin.author}さんのルートをもとにしています</span>
                  <button type="button" className="origin-link" onClick={() => setView('shared')}>元を見る</button>
                </div>
              )}
              <div className="head-row">
                <div className="tagrow">
                  {tags.map((t) => <span className="tag" key={t}>{t}</span>)}
                  <button type="button" className="tag add">＋ タグ</button>
                </div>
                <span className="prog">{doneCount}/{items.length} 終了</span>
              </div>
            </div>

            <div className="route">
              <div className="start"><span className="cap">START</span><span className="start-line" aria-hidden="true" /></div>

              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragStart={({ active }) => setActiveKey(active.id)}
                onDragCancel={() => setActiveKey(null)} onDragEnd={onDragEnd}>
                <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
                  {items.map((it, idx) => (
                    <Stop key={it.key} item={it} book={byId(it.bookId)} index={idx}
                      onToggleDone={toggleDone} onOpen={setDetailKey} />
                  ))}
                </SortableContext>
                <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
                  {activeItem ? <Stop item={activeItem} book={byId(activeItem.bookId)} index={activeIdx} isOverlay /> : null}
                </DragOverlay>
              </DndContext>

              {items.length === 0 && <div className="blank">まだ1冊も置かれていない</div>}

              <button type="button" className="add-stop" onClick={() => setSearchOpen(true)}>
                <span className="rail" aria-hidden="true"><span className="thread" /><span className="bead ghost">＋</span></span>
                <span className="add-label">参考書を追加</span>
              </button>

              <div className="goal">
                <span className="rail" aria-hidden="true"><span className="thread" /><span className="flag"><Flag /></span></span>
                <span className="cap goal-cap">GOAL</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="app shared-app">
            <header className="topbar">
              <span className="shared-brand">しおり</span>
              <span className="spacer" />
              <span className="ro-tag">閲覧のみ</span>
            </header>

            <div className="route-head">
              <h1 className="route-title">{SHARED_TITLE}</h1>
              <div className="byline">
                <span className="avatar" aria-hidden="true">{SHARED_AUTHOR.slice(0, 1)}</span>
                <span>{SHARED_AUTHOR} さんのルート</span>
              </div>
              <div className="head-row">
                <div className="tagrow">{SHARED_TAGS.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
                <span className="prog">参考書 {SHARED_ITEMS.length} 冊</span>
              </div>
            </div>

            <div className="route">
              <div className="start"><span className="cap">START</span><span className="start-line" aria-hidden="true" /></div>
              {SHARED_ITEMS.map((it, idx) => (
                <SharedStop key={it.key} item={it} book={byId(it.bookId)} index={idx} />
              ))}
              <div className="goal">
                <span className="rail" aria-hidden="true"><span className="thread" /><span className="flag"><Flag /></span></span>
                <span className="cap goal-cap">GOAL</span>
              </div>
            </div>

            <div className="cta">
              <p className="cta-t">このルートをコピーすると、自分用に並び替えたり本を足したりできる。<br />
                <span className="cta-note">元のルートは書き換わらない。</span></p>
              <button type="button" className="cta-b" onClick={copyRoute}>このルートをコピーして使う</button>
              <button type="button" className="cta-alt" onClick={startBlank}>まっさらから作る</button>
              <p className="cta-s">ログインなしで、すぐに始められる</p>
            </div>
          </div>
        )}
      </div>

      <div className={`toast ${toast ? 'on' : ''}`} role="status" aria-live="polite">{toast}</div>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} onPick={addBook} present={present} />
      <DetailSheet item={detailItem} onClose={() => setDetailKey(null)} onPatch={patch} onRemove={removeItem} />
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} isPublic={isPublic} setPublic={setPublic}
        onPreview={() => { setShareOpen(false); setView('shared'); }} title={title} count={items.length} />
    </>
  );
}
