import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AudioLines, Check, FileText, Film, Folder, Layers, Loader2, MoreHorizontal, Search, Trash2 } from 'lucide-react'
import Sidebar, { MobileBar } from '../components/Sidebar'
import { ConfirmNote } from '../components/NoteMenu'
import { CombinedList, listCombined, makeCombined, type CombinedItem } from './Combined'
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
  return (
    <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((n) => (
        <li key={n.id} className="relative">
          <Link to={`/note/${n.id}`} className="block rounded-xl border border-line overflow-hidden bg-bg hover:bg-subtle">
            <div className="aspect-video bg-subtle">{n.kind === 'pdf' || n.kind === 'audio' || n.kind === 'localvideo' ? <span className="size-full grid place-items-center text-muted">{n.kind === 'pdf' ? <FileText size={40} strokeWidth={1.25} /> : n.kind === 'audio' ? <AudioLines size={40} strokeWidth={1.25} /> : <Film size={40} strokeWidth={1.25} />}</span> : <img src={n.thumbnail || `https://i.ytimg.com/vi/${n.id.slice(0, 11)}/mqdefault.jpg`} alt="" className="size-full object-cover" />}</div>
            <div className="p-3.5 pr-10">
              <p className="text-[15px] font-semibold leading-snug line-clamp-2">{n.title}</p>
              <p className="text-[13px] text-muted mt-1.5 truncate">{n.channel}{n.channel && ' · '}{n.created_at.slice(0, 10).replaceAll('-', '. ')}<Status n={n} /></p>
            </div>
          </Link>
          {onSel && n.status === 'done' && (  // 통합 요약용 체크
            <button onClick={() => onSel(n.id)} title="통합 요약에 넣기" aria-pressed={sel?.has(n.id)}
              className={`absolute left-2.5 top-2.5 grid place-items-center size-6 rounded-md border ${sel?.has(n.id) ? 'bg-accent border-accent text-[#0c0d08]' : 'bg-bg/90 border-line text-transparent hover:text-muted'}`}><Check size={15} strokeWidth={3} /></button>
          )}
          <button onClick={() => open(n.id)} title="더보기" className="absolute right-2 bottom-3 grid place-items-center size-8 rounded-md text-soft hover:bg-subtle"><MoreHorizontal size={18} /></button>
          {menu === n.id && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />
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
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
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
  return (
    <Shell title="라이브러리">
      <h2 className="text-[18px] font-bold mb-4">내 노트</h2>
      {err && <p className="text-muted text-[14px]">{err}</p>}
      {data?.notes.length === 0 && <p className="text-muted text-[14px]">아직 노트가 없어요.</p>}
      {data && <NoteGrid notes={data.notes} onMoved={() => setK(k + 1)} />}
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
      {data && done >= 2 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-subtle px-4 py-3 text-[14px]">
          <Layers size={17} strokeWidth={1.6} className="shrink-0 text-soft" />
          <span className="text-soft">{sel.size < 2 ? '카드 왼쪽 위 체크로 노트를 2~10개 고르면 하나로 합쳐 비교해 줘요' : `노트 ${sel.size}개 선택됨`}</span>
          <button disabled={sel.size < 2 || sel.size > 10 || mk} onClick={combine}
            className="ml-auto h-9 px-4 rounded-full bg-accent text-[#0c0d08] font-semibold disabled:opacity-40 flex items-center gap-2">
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
