import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUp, Layers, Sparkles, Trash2 } from 'lucide-react'
import { ModeNote, ModePicker, useChatMode } from '../components/ClaudeStatus'
import Sidebar, { MobileBar } from '../components/Sidebar'
import { streamChat, type Msg } from '../components/Chat'
import { ThemeButton } from '../components/ui'

type CNote = { id: string; title: string; channel?: string; kind?: string }
type Combined = {
  id: string; created_at: string; collection_id: number | null; notes: CNote[]; starts: Record<string, number>
  title: string; overview: string; common: string[]; differences: { note: number; points: string[] }[]
  table: { columns: string[]; rows: string[][] }; conclusion: string; messages?: Msg[]
}
export type CombinedItem = { id: string; title: string; created_at: string; count: number }

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init && { ...init, headers: { 'Content-Type': 'application/json' } })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || '요청을 처리하지 못했어요')
  return r.json()
}
export const makeCombined = (note_ids: string[], collection_id: number | null) =>
  j<{ id: string }>('/api/combine', { method: 'POST', body: JSON.stringify({ note_ids, collection_id }) })
export const listCombined = (cid: string) => j<CombinedItem[]>(`/api/combined?collection_id=${cid}`)

// 통합 요약 링크로 열었을 때(?t=시작값) 그 노트의 해당 위치로 이동. 영상은 시각, 글은 문단 번호
export function DeepLink({ seek, ready }: { seek: (t: number) => void; ready: boolean }) {
  const t = useSearchParams()[0].get('t')
  const done = useRef(false)
  useEffect(() => {
    if (t != null && ready && !done.current) { done.current = true; seek(+t) }
  }, [t, ready, seek])
  return null
}

const short = (s: string) => { const a = Array.from(s); return a.slice(0, 7).join('') + (a.length > 7 ? '…' : '') }

// **굵게** 와 출처 [노트번호:줄]을 한 줄 글로
function Inline({ text, c }: { text: string; c: Combined }) {
  return (
    <>
      {text.split(/(\*\*.+?\*\*|\[\d{1,2}:\d{1,5}\])/g).map((p, i) => {
        const b = p.match(/^\*\*(.+)\*\*$/)
        if (b) return <b key={i} className="font-bold text-link">{b[1]}</b>
        const m = p.match(/^\[(\d+):(\d+)\]$/)
        if (!m) return p
        const note = c.notes[+m[1] - 1], t = c.starts[`${m[1]}:${m[2]}`]
        if (!note || t == null) return null
        return <Link key={i} to={`/note/${note.id}?t=${t}`} title={`「${note.title}」 ${note.kind === 'article' ? `문단 ${m[2]}` : `${Math.floor(t / 60)}분 ${Math.floor(t % 60)}초`}로 이동`}
          className="text-link text-[12px] mx-0.5 hover:underline whitespace-nowrap">[{short(note.title)} {m[2]}]</Link>
      })}
    </>
  )
}

export default function CombinedPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [c, setC] = useState<Combined | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { j<Combined>(`/api/combined/${id}`).then(setC).catch((e) => setErr(e.message)) }, [id])
  const back = c?.collection_id ? `/collection/${c.collection_id}` : id.startsWith('g') ? '/ask' : '/library'
  const remove = async () => {
    if (!confirm(`이 ${id.startsWith('g') ? '대화' : '통합 요약'}를 삭제할까요? (원래 노트는 그대로 남아요)`)) return
    await j(`/api/combined/${id}`, { method: 'DELETE' })
    nav(back)
  }
  const h2 = 'text-[20px] font-bold mt-14 mb-5'
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileBar />
        <div className="sticky top-0 z-10 bg-bg flex items-center gap-2 h-12 px-4 md:px-6 border-b border-line text-[14px]">
          <Link to={back} className="flex items-center gap-1.5 text-soft hover:text-fg"><ArrowLeft size={16} />돌아가기</Link>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={remove} title="삭제" className="grid place-items-center size-9 rounded-lg hover:bg-subtle text-soft"><Trash2 size={17} /></button>
            <ThemeButton />
          </div>
        </div>
        <main className="max-w-[720px] mx-auto px-5 md:px-8 pb-24">
          {err && <p className="mt-10 text-[15px] text-muted">{err}</p>}
          {!c && !err && <p className="mt-10 text-muted">불러오는 중…</p>}
          {c && !c.overview && ( // g…: 통합 요약 없이 노트를 골라 바로 시작한 대화
            <>
              <p className="mt-16 flex items-center gap-1.5 text-[13px] text-muted"><Sparkles size={14} />AI와 대화 · 노트 {c.notes.length}개 · {c.created_at.slice(0, 10).replaceAll('-', '. ')}</p>
              <h1 className="text-[28px] font-bold leading-[1.35] mt-2 mb-4 break-keep">{c.title}</h1>
              <ol className="space-y-1.5 text-[14px]">
                {c.notes.map((n, i) => (
                  <li key={n.id} className="flex gap-2"><span className="text-muted w-5 shrink-0">{i + 1}</span>
                    <Link to={`/note/${n.id}`} className="hover:underline line-clamp-1">{n.title}</Link></li>
                ))}
              </ol>
              <hr className="border-line my-8" />
              <CombinedChat c={c} reload={() => j<Combined>(`/api/combined/${id}`).then(setC)} />
            </>
          )}
          {c && c.overview && (
            <>
              <p className="mt-16 flex items-center gap-1.5 text-[13px] text-muted"><Layers size={14} />통합 요약 · 노트 {c.notes.length}개 · {c.created_at.slice(0, 10).replaceAll('-', '. ')}</p>
              <h1 className="text-[32px] font-bold leading-[1.35] mt-2 mb-8 break-keep">{c.title}</h1>
              <p className="text-[16px] leading-[1.85]"><Inline text={c.overview} c={c} /></p>
              <ol className="mt-6 space-y-1.5 text-[14px]">
                {c.notes.map((n, i) => (
                  <li key={n.id} className="flex gap-2"><span className="text-muted w-5 shrink-0">{i + 1}</span>
                    <Link to={`/note/${n.id}`} className="hover:underline line-clamp-1">{n.title}</Link></li>
                ))}
              </ol>
              <hr className="border-line mt-8" />

              <h2 className={h2}>공통 주제</h2>
              <ol className="list-decimal pl-6 space-y-2 text-[16px] leading-[1.7]">
                {c.common.map((t, i) => <li key={i}><Inline text={t} c={c} /></li>)}
              </ol>

              <h2 className={h2}>노트별 차이</h2>
              {c.differences.map((d) => (
                <div key={d.note} className="mb-8">
                  <h3 className="text-[18px] font-bold mb-3 break-keep"><span className="text-muted mr-2">{d.note}.</span>{c.notes[d.note - 1]?.title}</h3>
                  <ol className="list-decimal pl-6 space-y-2 text-[16px] leading-[1.7]">
                    {d.points.map((t, i) => <li key={i}><Inline text={t} c={c} /></li>)}
                  </ol>
                </div>
              ))}

              <h2 className={h2}>비교표</h2>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[520px] border-collapse text-[14px] leading-[1.6]">
                  <thead><tr className="bg-subtle">{c.table.columns.map((h, i) => <th key={i} className="px-3 py-2.5 text-left font-semibold align-top border-b border-line">{h}</th>)}</tr></thead>
                  <tbody>{c.table.rows.map((row, r) => (
                    <tr key={r} className="border-b border-line last:border-0">
                      {row.map((cell, i) => <td key={i} className={`px-3 py-2.5 align-top ${i === 0 ? 'font-semibold whitespace-nowrap' : ''}`}><Inline text={cell} c={c} /></td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <h2 className={h2}>종합 결론</h2>
              <p className="text-[16px] leading-[1.85]"><Inline text={c.conclusion} c={c} /></p>

              <h2 className={h2}>이 노트들과 대화</h2>
              <CombinedChat c={c} reload={() => j<Combined>(`/api/combined/${id}`).then(setC)} />
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// 통합 요약 아래 채팅: 노트들 요약을 근거로 AI와 대화(모드는 입력창 설정). 답이 끝나면 다시 불러와 새 출처 링크 시각(starts)을 받음
function CombinedChat({ c, reload }: { c: Combined; reload: () => Promise<unknown> }) {
  const [msgs, setMsgs] = useState<Msg[]>(c.messages ?? [])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode] = useChatMode()
  const send = async () => {
    const text = q.trim()
    if (!text || busy) return
    setQ(''); setBusy(true)
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }])
    const patch = (f: (m: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), f(m[m.length - 1])])
    try {
      await streamChat(`/api/combined/${c.id}/chat`, text, mode, patch)
      await reload()
    } catch (e) {
      patch((m) => ({ ...m, text: m.text || (e as Error).message, err: true }))
    }
    setBusy(false)
  }
  return (
    <div>
      {msgs.length === 0 && <p className="text-[15px] text-muted leading-[1.7]">노트 {c.notes.length}개의 요약을 함께 보고 답해요. 비교·연결 질문도 돼요. 답할 AI와 범위는 입력창 아래 설정에서 바꿔요.</p>}
      {msgs.map((m, i) => m.role === 'user' ? (
        <p key={i} className="ml-auto mt-4 w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-subtle px-3.5 py-2 text-[15px] leading-[1.6]">{m.text}</p>
      ) : (
        <p key={i} className={`mt-4 whitespace-pre-wrap break-words text-[15px] leading-[1.75] ${m.err ? 'text-muted' : ''}`}>
          {m.text ? <Inline text={m.text} c={c} /> : <span className="text-muted animate-pulse">답변 작성 중…</span>}
        </p>
      ))}
      <div className="mt-5 rounded-xl border border-line p-3">
        <textarea value={q} rows={2} onChange={(e) => setQ(e.target.value)} placeholder="이 노트들에 대해 물어보세요"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
          className="w-full resize-none bg-transparent text-fg outline-none text-[15px] leading-[1.6] placeholder:text-muted" />
        <div className="flex items-center justify-end gap-1">
          <ModePicker />
          <button onClick={send} disabled={!q.trim() || busy} title="보내기" aria-label="보내기"
            className="grid place-items-center size-7 rounded-full bg-fg text-bg disabled:bg-line disabled:text-muted"><ArrowUp size={15} /></button>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] text-muted"><ModeNote what="노트" /></p>
    </div>
  )
}

// 컬렉션 화면에 보여 줄 통합 요약 목록
export function CombinedList({ items }: { items: CombinedItem[] }) {
  if (!items.length) return null
  return (
    <div className="mb-8">
      <h3 className="text-[15px] font-bold mb-3">통합 요약</h3>
      <ul className="grid gap-2 max-w-[640px]">
        {items.map((c) => (
          <li key={c.id}>
            <Link to={`/combined/${c.id}`} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 hover:bg-subtle">
              <Layers size={17} strokeWidth={1.6} className="shrink-0 text-soft" />
              <span className="min-w-0 flex-1 text-[15px] font-semibold truncate">{c.title}</span>
              <span className="shrink-0 text-[13px] text-muted">노트 {c.count}개 · {c.created_at.slice(5, 10).replace('-', '. ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
