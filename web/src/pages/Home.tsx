// 홈(릴리스 배치): 위 줄 소개 + 오른쪽 「새로 추가하기」 / 라이브러리 카드 한 줄 + 전체 보기 / 구독 칸
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, FileText, Globe, Loader2, Plus, Rss, SquarePlay, X } from 'lucide-react'
import Sidebar, { MobileBar } from '../components/Sidebar'
import { addSub, createNote, delSub, listNotes, listSubs, subVideos, type NoteSummary } from '../api'
import { usePoll } from './Library'

const KIND: Record<string, string> = { video: '유튜브', article: '웹사이트', pdf: 'PDF', audio: '오디오', localvideo: '내 영상' }
const date = (s: string) => s.slice(0, 10).replaceAll('-', '.')

export function TypeIcon({ kind, size = 14 }: { kind?: string; size?: number }) {
  const I = kind === 'article' ? Globe : kind === 'pdf' ? FileText : SquarePlay
  return <I size={size} strokeWidth={1.6} className="shrink-0 text-muted" />
}

function Card({ n }: { n: NoteSummary }) {
  const img = n.kind === 'pdf' || n.kind === 'audio' || n.kind === 'localvideo' ? '' : n.thumbnail || `https://i.ytimg.com/vi/${n.id.slice(0, 11)}/mqdefault.jpg`
  return (
    <Link to={`/note/${n.id}`} data-card="" className="flex flex-col rounded-lg border border-line bg-bg overflow-hidden hover:bg-subtle">
      <div className="h-[118px] bg-subtle grid place-items-center overflow-hidden">{img ? <img src={img} alt="" className="size-full object-cover" /> : <TypeIcon kind={n.kind} size={34} />}</div>
      <div className="flex flex-col flex-1 px-2.5 pt-2.5 pb-3">
        <TypeIcon kind={n.kind} />
        <p className="mt-2 text-[14px] font-semibold leading-snug line-clamp-2 min-h-[2.6em]">{n.title}</p>
        <p className="mt-auto pt-4 text-[12px] text-muted">{n.status === 'processing' ? <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" />만드는 중</span> : KIND[n.kind || 'video']}</p>
        <p className="mt-1 text-[12px] text-muted">{date(n.created_at)}</p>
      </div>
    </Link>
  )
}

// 구독: 채널 칩 + 아직 노트가 없는 새 영상(누르면 노트 만들기). 노트를 자동으로 만들지 않는다(사용자 결정 2026-10-13)
export function Subscriptions() {
  const nav = useNavigate()
  const [k, setK] = useState(0)
  const subs = usePoll(async () => ({ notes: [], subs: await listSubs() }), `subs${k}`)
  const vids = usePoll(async () => ({ notes: [], v: await subVideos() }), `subv${k}`)
  const [adding, setAdding] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const add = async () => {
    setBusy('add'); setErr('')
    try { await addSub(adding || ''); setAdding(null); setK(k + 1) } catch (e) { setErr((e as Error).message) } finally { setBusy('') }
  }
  const make = async (id: string) => {
    setBusy(id)
    try { const r = await createNote(`https://www.youtube.com/watch?v=${id}`); nav(`/note/${r.id}`) } catch (e) { setErr((e as Error).message); setBusy('') }
  }
  const list = subs.data?.subs ?? []
  return (
    <section id="subs" data-subs="" className="rounded-xl bg-subtle px-4 py-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 text-[18px] font-bold"><Rss size={18} strokeWidth={1.8} />구독</h2>
        <p className="text-[13px] text-soft min-w-0 flex-1">채널을 구독하면 새 영상이 여기에 모여요. 누르면 요약 노트를 만들어요.</p>
        <button onClick={() => { setAdding(''); setErr('') }} className="flex items-center gap-1 h-10 px-3.5 rounded-lg bg-fg text-bg text-[14px] font-semibold"><Plus size={16} />구독</button>
      </div>
      {adding !== null && (
        <form onSubmit={(e) => { e.preventDefault(); add() }} className="mt-3 flex gap-2">
          <input autoFocus value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setAdding(null)} aria-label="채널 링크"
            placeholder="유튜브 채널 링크 (예: https://www.youtube.com/@채널이름)" className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-line bg-bg text-[14px] outline-none focus:border-fg" />
          <button disabled={!adding.trim() || busy === 'add'} className="h-10 px-4 rounded-lg bg-fg text-bg text-[14px] font-semibold disabled:opacity-40">{busy === 'add' ? '확인 중…' : '추가'}</button>
          <button type="button" onClick={() => setAdding(null)} className="h-10 px-3 rounded-lg border border-line text-[14px]">취소</button>
        </form>
      )}
      {err && <p role="alert" className="mt-2 text-[13px] text-red-500">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {subs.data && !list.length && <p className="text-[13px] text-muted">아직 구독한 채널이 없어요.</p>}
        {list.map((s) => (
          <span key={s.url} className="flex items-center gap-2 h-10 px-1.5 rounded-lg bg-bg border border-line text-[13px]">
            <span className="grid place-items-center size-7 rounded-full bg-subtle text-[12px]">{s.name.slice(0, 1)}</span>
            <a href={s.url} target="_blank" rel="noreferrer" className="max-w-[160px] truncate hover:underline">{s.name}</a>
            <span className="h-6 px-2 grid place-items-center rounded-md bg-fg text-bg text-[12px] font-semibold">구독</span>
            <button onClick={async () => { await delSub(s.url); setK(k + 1) }} aria-label={`${s.name} 구독 취소`} title="구독 취소" className="grid place-items-center size-6 rounded text-muted hover:text-fg"><X size={14} /></button>
          </span>
        ))}
      </div>
      {list.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold mb-2">새 영상 {vids.data ? `${vids.data.v.length}개` : ''}</p>
          {!vids.data && <p className="text-[13px] text-muted flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />새 영상을 찾는 중…</p>}
          {vids.data && !vids.data.v.length && <p className="text-[13px] text-muted">새 영상이 없어요. 모두 노트로 만들었어요.</p>}
          <ul className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {vids.data?.v.map((v) => (
              <li key={v.id}>
                <button onClick={() => make(v.id)} disabled={!!busy} className="w-full flex gap-2.5 items-center text-left rounded-lg bg-bg border border-line p-1.5 hover:border-fg disabled:opacity-60">
                  <img src={v.thumbnail} alt="" className="w-[88px] aspect-video rounded object-cover shrink-0" />
                  <span className="min-w-0"><span className="block text-[13px] font-semibold leading-snug line-clamp-2">{v.title}</span>
                    <span className="block mt-0.5 text-[12px] text-muted truncate">{busy === v.id ? '노트 만드는 중…' : v.channel}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const nav = useNavigate()
  const { data, err } = usePoll(async () => ({ notes: await listNotes() }), 'home')
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileBar />
        <div className="hidden md:flex items-center justify-between h-12 px-6 border-b border-line text-[14px]">
          영상과 글을 모으면, 핵심을 정리해 드려요
          <button onClick={() => nav('/new')} className="flex items-center gap-1 h-9 px-3.5 rounded-lg bg-fg text-bg text-[14px] font-semibold"><Plus size={16} />새로 추가하기</button>
        </div>
        <main className="px-4 md:px-6 pt-5 pb-16">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="flex items-center gap-2 text-[18px] font-bold"><BookOpen size={18} strokeWidth={1.8} />라이브러리</h2>
            <Link to="/library" className="flex items-center gap-1 text-[13px] text-soft hover:text-fg"><ArrowRight size={14} />전체 보기</Link>
          </div>
          {err && <p className="text-muted text-[14px]">{err}</p>}
          {data?.notes.length === 0 && (
            <button onClick={() => nav('/new')} className="w-full rounded-lg border border-dashed border-line py-10 text-[14px] text-muted hover:text-fg">아직 노트가 없어요. 유튜브 링크를 추가해 보세요</button>
          )}
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] min-[900px]:grid-cols-[repeat(auto-fill,212px)]">
            {data?.notes.slice(0, 8).map((n) => <Card key={n.id} n={n} />)}
          </div>
          <div className="mt-8"><Subscriptions /></div>
        </main>
      </div>
    </div>
  )
}
