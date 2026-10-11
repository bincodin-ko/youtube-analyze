// 확장 탭: 만든 확장 리포트 목록(툴바 드롭다운)·본문 보기. 추가 창은 ExpandModal, 카드·퀴즈는 ExpandCards.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { fmtTime, type Note } from '../api'
import { RichT } from './ReportExtras'
import { Flashcards, QuizView, type Card, type Quiz } from './ExpandCards'
import Infographic, { type Info } from './Infographic'
import ExpandModal from './ExpandModal'
import Cartoon, { type Toon } from './Cartoon'
import Backdrop from './Backdrop'

export type Tpls = { builtin: { key: string; name: string; cat: string; desc: string; kind: string }[]; custom: { key: string; name: string; prompt: string }[] }
type Ext = Partial<Omit<Info, 'blocks'>> & { kind: 'md' | 'flash' | 'quiz' | 'infographic' | 'cartoon'; title: string; blocks?: any[]; cards?: Card[]; questions?: Quiz[] }

const call = async <T,>(url: string, method = 'GET'): Promise<T> => {
  const r = await fetch(url, { method })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || '요청을 처리하지 못했어요')
  return r.json()
}

// 상태 한 곳에: 템플릿 목록·만든 결과·현재 선택('mindmap'이 기본)·만드는 중인 키
export function useExpand(id: string, on: boolean, onMindmap: () => void) {
  const [tpls, setTpls] = useState<Tpls>({ builtin: [], custom: [] })
  const [exts, setExts] = useState<Record<string, Ext>>({})
  const [cur, setCur] = useState('mindmap')
  const [busy, setBusy] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(false)
  const loadTpls = useCallback(() => { call<Tpls>('/api/templates').then(setTpls).catch(() => {}) }, [])
  useEffect(() => {
    if (!on) return
    loadTpls()
    call<Record<string, Ext>>(`/api/notes/${id}/ext`).then(setExts).catch(() => {})
  }, [on, id, loadTpls])
  // 카툰: 서버가 백그라운드로 만들고(POST), 진행·부분 결과를 2초마다 받아온다(GET)
  const [prog, setProg] = useState(''), [redo, setRedo] = useState<number | null>(null)
  const timer = useRef(0)
  useEffect(() => () => clearInterval(timer.current), [])
  const pollToon = () => {
    clearInterval(timer.current)
    timer.current = window.setInterval(async () => {
      const r = await call<{ job: { busy: boolean; msg: string; err: string | null } | null; result: Ext | null }>(`/api/notes/${id}/cartoon`).catch(() => null)
      if (!r) return
      if (r.result) setExts((e) => ({ ...e, cartoon: r.result! }))
      if (r.job?.busy) return setProg(r.job.msg)
      clearInterval(timer.current); setProg(''); setRedo(null); setBusy((b) => b.filter((x) => x !== 'cartoon'))
      if (r.job?.err) setErr(`카툰: ${r.job.err}`)
    }, 2000)
  }
  const makeToon = (panel?: number) => {
    setBusy((b) => [...new Set([...b, 'cartoon'])]); setProg('콘티 만드는 중'); if (panel != null) setRedo(panel)
    call(`/api/notes/${id}/cartoon${panel != null ? `?panel=${panel}` : ''}`, 'POST').then(pollToon).catch((e) => { setErr(`카툰: ${e.message}`); setProg(''); setRedo(null); setBusy((b) => b.filter((x) => x !== 'cartoon')) })
  }
  useEffect(() => { // 새로고침했는데 서버가 아직 그리는 중이면 이어서 보여 준다
    if (on) call<{ job: { busy: boolean } | null }>(`/api/notes/${id}/cartoon`).then((r) => { if (r.job?.busy) { setBusy((b) => [...new Set([...b, 'cartoon'])]); pollToon() } }).catch(() => {})
  }, [on, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const make = (k: string) => {
    if (k === 'cartoon') return makeToon()
    setBusy((b) => [...b, k])
    call<Ext>(`/api/notes/${id}/ext/${k}`, 'POST').then((x) => setExts((e) => ({ ...e, [k]: x }))).catch((e) => setErr(`${nameOf(k)}: ${e.message}`)).finally(() => setBusy((b) => b.filter((x) => x !== k)))
  }
  const nameOf = (k: string) => k === 'mindmap' ? '마인드맵' : tpls.builtin.find((t) => t.key === k)?.name ?? tpls.custom.find((t) => t.key === k)?.name ?? exts[k]?.title ?? k
  // 선택한 템플릿들을 동시에 생성(서버가 각각 따로 처리)
  const add = (keys: string[]) => {
    setModal(false); setErr(''); setCur(keys[0])
    keys.forEach((k) => (k === 'mindmap' ? onMindmap() : make(k)))
  }
  const del = (k: string) => { call(`/api/notes/${id}/ext/${k}`, 'DELETE').then(() => { setExts((e) => { const { [k]: _, ...rest } = e; return rest }); setCur('mindmap') }) }
  return { tpls, exts, cur, setCur, busy, prog, redo, makeToon, err, modal, setModal, loadTpls, nameOf, add, make, del }
}
export type Ex = ReturnType<typeof useExpand>

// 툴바 드롭다운: 마인드맵 + 만든 확장 리포트 + "확장 리포트 추가"
export function ExpandMenu({ ex }: { ex: Ex }) {
  const [open, setOpen] = useState(false)
  const keys = ['mindmap', ...new Set([...Object.keys(ex.exts), ...ex.busy])]
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 h-9 px-2 text-[15px] max-w-[130px]"><span className="truncate">{ex.nameOf(ex.cur)}</span><ChevronDown size={16} className="shrink-0" /></button>
      {open && (
        <>
          <Backdrop z="z-10" onClose={() => setOpen(false)} />
          <div className="absolute z-20 top-10 left-0 w-[200px] rounded-xl border border-line bg-bg p-1.5 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
            {keys.map((k) => (
              <button key={k} onClick={() => { setOpen(false); ex.setCur(k) }} className={`flex items-center justify-between gap-2 w-full h-9 px-3 rounded-lg text-[15px] ${k === ex.cur ? 'bg-subtle' : 'hover:bg-subtle'}`}>
                <span className="truncate">{ex.nameOf(k)}</span>
                {ex.busy.includes(k) ? <Loader2 size={14} className="animate-spin shrink-0" /> : k === ex.cur && <Check size={15} className="shrink-0" />}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button onClick={() => { setOpen(false); ex.setModal(true) }} className="flex items-center gap-2 w-full h-9 px-3 rounded-lg text-[15px] hover:bg-subtle"><Plus size={15} />확장 리포트 추가</button>
          </div>
        </>
      )}
    </div>
  )
}

// 본문: 마인드맵은 Note가 넘긴 children, 나머지는 결과(마크다운 계열·카드·퀴즈). 모달도 여기서 연다.
export function ExpandBody({ ex, note, seek, children }: { ex: Ex; note: Note; seek: (t: number) => void; children: React.ReactNode }) {
  const x = ex.exts[ex.cur]
  const refs = (rs: number[]) => rs.map((n) => {
    const t = note.transcript[n]?.start
    return t == null ? null : <button key={n} onClick={() => seek(t)} className="text-link text-[12px] align-baseline mx-0.5 hover:underline" title={note.kind === 'article' ? `문단 ${n}` : fmtTime(t)}>[{n}]</button>
  })
  const seen = new Set<string>()
  const foot = (
    <div className="mt-8 flex gap-4 text-[13px] text-muted">
            <button disabled={ex.busy.includes(ex.cur)} onClick={() => ex.make(ex.cur)} className="flex items-center gap-1 hover:text-fg"><RefreshCw size={13} className={ex.busy.includes(ex.cur) ? 'animate-spin' : ''} />다시 만들기</button>
            <button onClick={() => ex.del(ex.cur)} className="flex items-center gap-1 hover:text-red-500"><Trash2 size={13} />삭제</button>
          </div>
  )
  return (
    <>
      {ex.modal && <ExpandModal tpls={ex.tpls} onClose={() => ex.setModal(false)} onAdd={ex.add} onChanged={ex.loadTpls} />}
      {ex.err && <p className="mt-4 text-[14px] text-muted">{ex.err}</p>}
      {ex.cur === 'mindmap' ? children : !x ? (
        <div className="pt-24 flex items-center gap-3 text-[16px]">
          {ex.busy.includes(ex.cur) ? <><Loader2 size={18} className="animate-spin" />{ex.nameOf(ex.cur)}을(를) 만드는 중이에요 ({ex.cur === 'cartoon' ? ex.prog || '준비 중' : '30~60초'})</>
            : <>아직 만들지 않았어요 <button onClick={() => ex.make(ex.cur)} className="underline">만들기</button></>}
        </div>
      ) : (
        x.kind === 'cartoon' ? <div className="mt-[88px]"><Cartoon id={note.id} data={x as unknown as Toon} name={note.title} prog={ex.prog} redo={ex.redo} onRedo={ex.makeToon} onRef={(n) => { const t = note.transcript[n]?.start; if (t != null) seek(t) }} />{foot}</div> :
        x.kind === 'infographic' ? <div className="mt-[88px]"><Infographic key={ex.cur} data={x as unknown as Info} name={note.title} onRef={(n) => { const t = note.transcript[n]?.start; if (t != null) seek(t) }} />{foot}</div> : <>
          <h1 className="text-[32px] font-bold leading-[1.35] mt-[88px] mb-10 break-keep">{x.title}</h1>
          <p className="-mt-6 mb-8 text-[13px] text-muted">{ex.nameOf(ex.cur)}</p>
          {x.kind === 'flash' && <Flashcards key={ex.cur} cards={x.cards!} refs={refs} />}
          {x.kind === 'quiz' && <QuizView key={ex.cur} qs={x.questions!} refs={refs} />}
          {x.kind === 'md' && x.blocks!.map((b, i) => (
            <div key={i} className="mb-10">
              <h2 className="text-[20px] font-bold mb-4">{b.heading}</h2>
              <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.7] marker:text-muted">
                {b.bullets.map((t: { text: string; refs: number[] }, j: number) => <li key={j}><RichT text={t.text} terms={[]} seen={seen} />{refs(t.refs)}</li>)}
              </ul>
            </div>
          ))}
          {foot}
        </>
      )}
    </>
  )
}
