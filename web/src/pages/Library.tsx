import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AudioLines, Check, FileText, Film, Folder, Layers, Loader2, MoreHorizontal, Search, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import Sidebar, { MobileBar } from '../components/Sidebar'
import { ConfirmNote } from '../components/NoteMenu'
import { CombinedList, listCombined, makeCombined, type CombinedItem } from './Combined'
import Backdrop from '../components/Backdrop'
import {
  collectionsChanged, getCollection, listCollections, listNotes, moveNote, search,
  type Collection, type NoteSummary, type SearchHit,
} from '../api'

const STEP: Record<string, string> = { queued: '대기 중', transcript: '대본 받는 중', summary: '요약 중', scenes: '장면 고르는 중' }

// 처리 중인 노트가 있으면 2.5초마다 다시 불러옴
export function usePoll<T extends { notes: NoteSummary[] }>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let alive = true, timer = 0
    const tick = () => load().then((d) => {
      if (!alive) return
      setData(d)
      if (d.notes.some((n) => n.status === 'processing')) timer = window.setTimeout(tick, 2500)
    }).catch((e) => alive && setErr(e.message))
    tick()
    return () => { alive = false; clearTimeout(timer) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err }
}

function Status({ n }: { n: NoteSummary }) {
  if (n.status === 'done') return null
  if (n.status === 'error') return <span className="text-[13px] text-red-500"> · 실패</span>
  return <span className="text-[13px] text-fg"> · {n.step !== 'queued' && <Loader2 size={12} className="inline animate-spin mr-1 align-[-1px]" />}{STEP[n.step ?? ''] ?? '처리 중'}</span>
}

// 노트 카드 격자 (홈·라이브러리·컬렉션 공용). … 메뉴에서 컬렉션 지정
const CW = [150, 200, 260, 340, 440] // 카드 최소 너비(축소 0 ~ 확대 4)

export function NoteGrid({ notes, onMoved, sel, onSel }: { notes: NoteSummary[]; onMoved?: () => void; sel?: Set<string>; onSel?: (id: string) => void }) {
  const [menu, setMenu] = useState<string | null>(null)
  const [cols, setCols] = useState<Collection[]>([])
  const [del, setDel] = useState<NoteSummary | null>(null)
  const open = (id: string) => { setMenu(id); listCollections().then(setCols).catch(() => {}) }
  const move = async (n: NoteSummary, cid: number | null) => {
    setMenu(null)
    await moveNote(n.id, cid)
    collectionsChanged(); onMoved?.()
  }
  const [z, setZ] = useState(() => { try { return Math.min(4, Math.max(0, Number(localStorage.getItem('vn-lib-zoom') ?? 2))) } catch { return 2 } })
  const zoom = (v: number) => { const n = Math.min(4, Math.max(0, v)); setZ(n); try { localStorage.setItem('vn-lib-zoom', String(n)) } catch { /* 이번 화면만 */ } }
  const small = z <= 1
  return (
    <>
    {/* 카드 크기(축소·확대): − / 슬라이더 / +, 목록 위 Ctrl+휠. 작게 하면 한 줄에 더 많이 */}
    <div className="flex items-center justify-end gap-1.5 mb-3 text-soft">
      <button onClick={() => zoom(z - 1)} disabled={z === 0} aria-label="카드 작게" title="작게 (더 많이 보기)" className="grid place-items-center size-8 rounded-lg hover:bg-subtle disabled:opacity-30"><ZoomOut size={17} /></button>
      <input type="range" min={0} max={4} step={1} value={z} onChange={(e) => zoom(Number(e.target.value))} aria-label="카드 크기" className="w-[96px] accent-[var(--color-fg)]" />
      <button onClick={() => zoom(z + 1)} disabled={z === 4} aria-label="카드 크게" title="크게 (덜 보기)" className="grid place-items-center size-8 rounded-lg hover:bg-subtle disabled:opacity-30"><ZoomIn size={17} /></button>
    </div>
    <ul data-note-grid={z} onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); zoom(z + (e.deltaY > 0 ? -1 : 1)) } }}
      className={`grid ${small ? 'gap-2.5' : 'gap-4'} grid-cols-[repeat(auto-fill,minmax(min(100%,var(--cw)),1fr))]`} style={{ '--cw': `${CW[z]}px` } as React.CSSProperties}>
      {notes.map((n) => (
        <li key={n.id} className="relative">
          <Link to={`/note/${n.id}`} className="block rounded-xl border border-line overflow-hidden bg-bg hover:bg-subtle">
            <div className="aspect-video bg-subtle">{n.kind === 'pdf' || n.kind === 'audio' || n.kind === 'localvideo' ? <span className="size-full grid place-items-center text-muted">{n.kind === 'pdf' ? <FileText size={40} strokeWidth={1.25} /> : n.kind === 'audio' ? <AudioLines size={40} strokeWidth={1.25} /> : <Film size={40} strokeWidth={1.25} />}</span> : <img src={n.thumbnail || `https://i.ytimg.com/vi/${n.id.slice(0, 11)}/mqdefault.jpg`} alt="" className="size-full object-cover" />}</div>
            <div className={small ? 'p-2.5 pr-9' : 'p-3.5 pr-10'}>
              <p className={`${small ? 'text-[13px]' : 'text-[15px]'} font-semibold leading-snug line-clamp-2`}>{n.title}</p>
              <p className={`${small ? 'text-[12px] mt-1' : 'text-[13px] mt-1.5'} text-muted truncate`}>{n.channel}{n.channel && ' · '}{n.created_at.slice(0, 10).replaceAll('-', '. ')}<Status n={n} /></p>
            </div>
          </Link>
          {onSel && n.status === 'done' && (  // 통합 요약용 체크
            <button onClick={() => onSel(n.id)} title="골라서 AI와 대화·통합 요약" aria-pressed={sel?.has(n.id)}
              className={`absolute left-2.5 top-2.5 grid place-items-center size-6 rounded-md border ${sel?.has(n.id) ? 'bg-accent border-accent text-[#0c0d08]' : 'bg-bg/90 border-line text-transparent hover:text-muted'}`}><Check size={15} strokeWidth={3} /></button>
          )}
          <button onClick={() => open(n.id)} title="더보기" className="absolute right-2 bottom-3 grid place-items-center size-8 rounded-md text-soft hover:bg-subtle"><MoreHorizontal size={18} /></button>
          {menu === n.id && (
            <>
              <Backdrop z="z-20" onClose={() => setMenu(null)} />
              <div className="absolute right-2 bottom-12 z-30 w-[220px] rounded-xl border border-line bg-bg shadow-[0_4px_16px_rgba(0,0,0,.08)] p-1.5 text-[14px]">
                <p className="px-2.5 pt-1 pb-1.5 text-[12px] text-muted">컬렉션 지정</p>
                {cols.length === 0 && <p className="px-2.5 pb-2 text-[13px] text-muted">왼쪽 "+ 새 컬렉션"으로 먼저 만들어 주세요</p>}
                {cols.map((c) => (
                  <button key={c.id} onClick={() => move(n, c.id)} className="flex items-center gap-2 w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left">
                    <Folder size={15} strokeWidth={1.6} className="shrink-0" /><span className="truncate">{c.name}</span>
                    {n.collection_id === c.id && <Check size={15} className="ml-auto shrink-0" />}
                  </button>
                ))}
                {n.collection_id != null && <button onClick={() => move(n, null)} className="w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left text-muted">컬렉션에서 빼기</button>}
                <div className="my-1 border-t border-line" />
                <button disabled={n.status === 'processing'} onClick={() => { setMenu(null); setDel(n) }} title={n.status === 'processing' ? '처리 중에는 지울 수 없어요' : ''}
                  className="flex items-center gap-2 w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left text-red-500 disabled:opacity-40"><Trash2 size={15} />삭제</button>
              </div>
            </>
          )}
        </li>
      ))}
      {del && <ConfirmNote id={del.id} title={del.title} onCancel={() => setDel(null)} onDone={() => { setDel(null); onMoved?.() }} />}
    </ul>
    </>
  )
}

// 체크한 노트로 바로 AI와 대화 시작(통합 요약 없이)
export function ChatButton({ sel, cid }: { sel: Set<string>; cid?: number }) {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/groupchat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_ids: [...sel], collection_id: cid ?? null }) })
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || '대화를 만들지 못했어요')
      nav(`/combined/${(await r.json()).id}`)
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  return (
    <>
      <button disabled={sel.size < 1 || sel.size > 10 || busy} onClick={go}
        className="h-9 px-4 rounded-full bg-fg text-bg font-semibold disabled:opacity-40 flex items-center gap-2">
        <Sparkles size={15} />AI와 대화
      </button>
      {err && <span className="w-full text-red-500">{err}</span>}
    </>
  )
}

export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileBar />
        <div className="hidden md:flex items-center h-12 px-6 border-b border-line text-[14px] truncate">{title}</div>
        <main className="px-4 md:px-8 pt-6 pb-16">{children}</main>
      </div>
    </div>
  )
}

export default function Library() {
  const [k, setK] = useState(0)
  const { data, err } = usePoll(async () => ({ notes: await listNotes() }), `lib${k}`)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [picking, setPicking] = useState(false) // 「대화할 노트 고르기」를 눌렀을 때만 체크 표시
  const toggle = (nid: string) => setSel((s) => { const x = new Set(s); if (!x.delete(nid)) x.add(nid); return x })
  const stop = () => { setPicking(false); setSel(new Set()) }
  return (
    <Shell title="라이브러리">
      <h2 className="text-[18px] font-bold mb-4">내 노트</h2>
      {err && <p className="text-muted text-[14px]">{err}</p>}
      {data?.notes.length === 0 && <p className="text-muted text-[14px]">아직 노트가 없어요.</p>}
      {data && data.notes.length > 0 && !picking && (
        <button onClick={() => setPicking(true)} className="mb-4 h-9 px-4 rounded-full border border-line hover:bg-subtle text-[14px] font-semibold flex items-center gap-2">
          <Sparkles size={15} className="text-link" />대화할 노트 고르기
        </button>
      )}
      {data && picking && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-subtle px-4 py-3 text-[14px]">
          <Sparkles size={17} strokeWidth={1.6} className="shrink-0 text-link" />
          <span className="text-soft">{sel.size ? `노트 ${sel.size}개 선택됨` : '카드 왼쪽 위 체크로 함께 대화할 노트를 1~10개 고르세요'}</span>
          <span className="ml-auto" />
          <button onClick={stop} className="h-9 px-4 rounded-full border border-line hover:bg-bg">취소</button>
          <ChatButton sel={sel} />
          {sel.size > 10 && <span className="w-full text-red-500">최대 10개까지 고를 수 있어요</span>}
        </div>
      )}
      {data && <NoteGrid notes={data.notes} onMoved={() => setK(k + 1)} sel={sel} onSel={picking ? toggle : undefined} />}
    </Shell>
  )
}

export function CollectionPage() {
  const { id = '' } = useParams()
  const [k, setK] = useState(0)
  const { data, err } = usePoll(() => getCollection(id), `${id}-${k}`)
  const done = data?.notes.filter((n) => n.status === 'done').length ?? 0
  const total = data?.notes.length ?? 0
  const busy = data?.notes.some((n) => n.status === 'processing')
  // 통합 요약: 노트 2~10개 체크 → 합치기(1~2분)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [combos, setCombos] = useState<CombinedItem[]>([])
  const [mk, setMk] = useState(false)
  const [mkErr, setMkErr] = useState('')
  const nav = useNavigate()
  useEffect(() => { setSel(new Set()); listCombined(id).then(setCombos).catch(() => {}) }, [id])
  const toggle = (nid: string) => setSel((s) => { const x = new Set(s); if (!x.delete(nid)) x.add(nid); return x })
  const combine = async () => {
    setMk(true); setMkErr('')
    try { nav(`/combined/${(await makeCombined([...sel], +id)).id}`) } catch (e) { setMkErr((e as Error).message); setMk(false) }
  }
  return (
    <Shell title={data?.name ?? '컬렉션'}>
      <div className="flex items-center gap-2.5 mb-1"><Folder size={20} strokeWidth={1.6} /><h2 className="text-[22px] font-bold truncate">{data?.name}</h2></div>
      {err && <p className="text-muted text-[14px]">{err}</p>}
      {data && (
        <div className="mb-5">
          <p className="text-[14px] text-muted">노트 {total}개{busy && ` · ${done}개 완료, 순서대로 처리하고 있어요`}</p>
          {busy && <div className="mt-2 h-1.5 max-w-[360px] rounded-full bg-subtle overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>}
        </div>
      )}
      <CombinedList items={combos} />
      {data?.notes.length === 0 && <p className="text-muted text-[14px]">비어 있어요. 노트 카드의 … 메뉴에서 이 컬렉션에 넣을 수 있어요.</p>}
      {data && done >= 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-subtle px-4 py-3 text-[14px]">
          <Layers size={17} strokeWidth={1.6} className="shrink-0 text-soft" />
          <span className="text-soft">{sel.size ? `노트 ${sel.size}개 선택됨` : '카드 왼쪽 위 체크로 노트를 고르면 AI와 함께 대화(1~10개)하거나 하나로 합쳐 비교(2~10개)해요'}</span>
          <span className="ml-auto" /><ChatButton sel={sel} cid={+id} />
          <button disabled={sel.size < 2 || sel.size > 10 || mk} onClick={combine}
            className="h-9 px-4 rounded-full bg-accent text-[#0c0d08] font-semibold disabled:opacity-40 flex items-center gap-2">
            {mk && <Loader2 size={15} className="animate-spin" />}{mk ? '합치는 중… (1~2분)' : '통합 요약'}
          </button>
          {sel.size > 10 && <span className="w-full text-red-500">최대 10개까지 합칠 수 있어요</span>}
          {mkErr && <span className="w-full text-red-500">{mkErr}</span>}
        </div>
      )}
      {data && <NoteGrid notes={data.notes} onMoved={() => setK(k + 1)} sel={sel} onSel={toggle} />}
    </Shell>
  )
}

type GroupChat = { id: string; title: string; created_at: string; count: number; turns: number }

// 사이드바 「AI와 대화」: 쓰는 법 + 지난 대화 + 노트 골라 새 대화
export function AskPage() {
  const { data, err } = usePoll(async () => ({ notes: (await listNotes()).filter((n) => n.status === 'done') }), 'ask')
  const [chats, setChats] = useState<GroupChat[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (nid: string) => setSel((s) => { const x = new Set(s); if (!x.delete(nid)) x.add(nid); return x })
  useEffect(() => { fetch('/api/groupchat').then((r) => r.json()).then(setChats).catch(() => {}) }, [])
  return (
    <Shell title="AI와 대화">
      <div className="max-w-[760px]">
        <h2 className="flex items-center gap-2 text-[22px] font-bold"><Sparkles size={21} className="text-link" />AI와 대화</h2>
        <ol className="mt-5 space-y-2 text-[15px] leading-[1.6]">
          <li><b>답할 AI 고르기</b> — 채팅 입력창 아래 설정에서 골라요. 기본은 <b>로컬 · 영상 안만</b>(이 PC의 로컬 모델, 영상 내용으로만 답함). <b>로컬 · 영상 밖도</b>, <b>Claude · 영상 밖도</b>로 바꾸면 영상에 없는 것도 일반 지식으로 답해요. Claude 연결·끊기도 거기서 해요.</li>
          <li><b>영상 하나와 대화</b> — 노트를 열면 오른쪽 <b>채팅</b> 칸에서 바로 물어봐요.</li>
          <li><b>여러 영상과 함께 대화</b> — 아래에서 노트를 1~10개 체크하고 <b>AI와 대화</b>를 누르세요. 라이브러리에서는 <b>대화할 노트 고르기</b>를 누르면 체크가 생겨요.</li>
          <li><b>통합 요약 아래에서 대화</b> — 컬렉션에서 통합 요약을 만들면 그 화면 맨 아래에서도 대화할 수 있어요.</li>
        </ol>
      </div>
      {chats.length > 0 && (
        <div className="mt-8 max-w-[640px]">
          <h3 className="text-[15px] font-bold mb-3">지난 대화</h3>
          <ul className="grid gap-2">
            {chats.map((c) => (
              <li key={c.id}>
                <Link to={`/combined/${c.id}`} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 hover:bg-subtle">
                  <Sparkles size={16} strokeWidth={1.6} className="shrink-0 text-soft" />
                  <span className="min-w-0 flex-1 text-[15px] font-semibold truncate">{c.title}</span>
                  <span className="shrink-0 text-[13px] text-muted">노트 {c.count}개 · 질문 {c.turns}개 · {c.created_at.slice(5, 10).replace('-', '. ')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <h3 className="mt-8 text-[15px] font-bold mb-3">새 대화: 노트 고르기</h3>
      {err && <p className="text-muted text-[14px]">{err}</p>}
      {data?.notes.length === 0 && <p className="text-muted text-[14px]">완성된 노트가 아직 없어요.</p>}
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-subtle px-4 py-3 text-[14px]">
        <span className="text-soft">{sel.size ? `노트 ${sel.size}개 선택됨` : '카드 왼쪽 위 체크로 노트를 고르세요(1~10개)'}</span>
        <span className="ml-auto" /><ChatButton sel={sel} />
        {sel.size > 10 && <span className="w-full text-red-500">최대 10개까지 고를 수 있어요</span>}
      </div>
      {data && <NoteGrid notes={data.notes} sel={sel} onSel={toggle} />}
    </Shell>
  )
}

export function SearchPage() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const [text, setText] = useState(q)
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  useEffect(() => { if (q) search(q).then(setHits).catch(() => setHits([])); else setHits(null) }, [q])
  const mark = (s: string) => {
    const i = s.toLowerCase().indexOf(q.toLowerCase())
    return i < 0 ? s : <>{s.slice(0, i)}<mark className="bg-accent text-[#0c0d08] rounded-sm">{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>
  }
  return (
    <Shell title="검색">
      <form onSubmit={(e) => { e.preventDefault(); setSp(text.trim() ? { q: text.trim() } : {}) }} className="relative max-w-[700px]">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="제목·리포트·대본에서 찾기"
          className="w-full h-[46px] pl-11 pr-4 rounded-xl border border-line bg-bg text-[16px] outline-none focus:border-fg placeholder:text-muted" />
      </form>
      {hits && <p className="mt-5 text-[14px] text-muted">"{q}" 결과 {hits.length}개</p>}
      <ul className="mt-3 max-w-[700px] divide-y divide-line">
        {hits?.map((h) => (
          <li key={h.id}>
            <Link to={`/note/${h.id}`} className="flex gap-4 py-4 hover:bg-subtle rounded-lg px-2 -mx-2">
              <div className="w-[120px] aspect-video shrink-0 rounded-md bg-subtle overflow-hidden">{h.thumbnail && <img src={h.thumbnail} alt="" className="size-full object-cover" />}</div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug line-clamp-1">{h.where === '제목' ? mark(h.title) : h.title}</p>
                {h.where !== '제목' && <p className="text-[14px] text-soft mt-1 line-clamp-2 break-all"><span className="text-[12px] text-muted mr-1.5">{h.where}</span>{mark(h.snippet)}</p>}
                <p className="text-[13px] text-muted mt-1 truncate">{h.channel}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  )
}
