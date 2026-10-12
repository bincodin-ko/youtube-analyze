// 리포트 길이 메뉴(짧게·기본·길게·쉽게) + 용어 풀이(점선 밑줄·팝오버·목록)
import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Note } from '../api'
import Backdrop from './Backdrop'

export type Report = NonNullable<Note['report']>
export type Term = { term: string; easy: string }
export type Style = 'default' | 'short' | 'long' | 'easy'
const LABEL: Record<Style, string> = { short: '짧게', default: '기본', long: '길게', easy: '쉽게' }

async function call<T>(url: string, method = 'GET'): Promise<T> {
  const r = await fetch(url, { method })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || '요청을 처리하지 못했어요')
  return r.json()
}
// 저장된 리포트가 있으면 바로, 없으면 생성(수십 초)
export async function loadStyleReport(id: string, style: Exclude<Style, 'default'>): Promise<Report> {
  const got = await call<{ report: Report | null }>(`/api/notes/${id}/report?style=${style}`)
  return got.report ?? (await call<{ report: Report }>(`/api/notes/${id}/report?style=${style}`, 'POST')).report
}
export function useTerms(id: string, ready: boolean) {
  const [terms, setTerms] = useState<Term[]>([])
  useEffect(() => {
    if (!ready || id === 'mock') return
    call<{ terms: Term[] }>(`/api/notes/${id}/terms`).then((d) => setTerms(d.terms)).catch(() => {})
  }, [id, ready])
  return terms
}

export function LengthMenu({ style, busy, onPick }: { style: Style; busy: boolean; onPick: (s: Style) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 h-9 px-2 text-[15px]">{LABEL[style]}<ChevronDown size={16} /></button>
      {open && (
        <>
          <Backdrop z="z-10" onClose={() => setOpen(false)} />
          <div className="absolute z-20 top-10 left-0 w-[150px] rounded-xl border border-line bg-bg p-1.5 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
            {(['short', 'default', 'long', 'easy'] as Style[]).map((l) => (
              <button key={l} disabled={busy} onClick={() => { setOpen(false); onPick(l) }}
                className={`flex items-center justify-between w-full h-9 px-3 rounded-lg text-[15px] ${l === style ? 'bg-subtle' : 'hover:bg-subtle'}`}>
                {LABEL[l]}{l === style && <Check size={15} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 용어 하나: 점선 밑줄, 마우스를 올리거나 누르면 작은 팝오버
function TermSpan({ t }: { t: Term }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen(!open)} data-term className="underline decoration-dotted decoration-muted underline-offset-4 cursor-help">{t.term}</button>
      {open && (
        <span role="tooltip" data-term-pop className="absolute z-30 left-0 top-full mt-1.5 w-[260px] max-w-[70vw] rounded-xl border border-line bg-bg p-3 text-[14px] leading-[1.6] font-normal text-fg shadow-[0_4px_16px_rgba(0,0,0,.08)]">
          <b className="block text-[13px] mb-1">{t.term}</b>{t.easy}
          {/* 릴리스처럼 말풍선 안에서 바로 질문 → 오른쪽 채팅 입력창으로(Note가 vn-ask를 받음) */}
          <form className="mt-2.5 flex items-center gap-1.5 rounded-full border border-line pl-3 pr-1 h-8" onSubmit={(e) => {
            e.preventDefault(); const q = new FormData(e.currentTarget).get('q')?.toString().trim()
            dispatchEvent(new CustomEvent('vn-ask', { detail: `「${t.term}」 ${q || '더 자세히 알려줘'}` })); setOpen(false)
          }}>
            <input name="q" aria-label={`${t.term} 질문하기`} placeholder="질문하기" className="flex-1 min-w-0 bg-transparent text-[13px] outline-none" />
            <button aria-label="채팅으로 묻기" className="size-6 grid place-items-center rounded-full bg-fg text-bg text-[12px]">↑</button>
          </form>
        </span>
      )}
    </span>
  )
}

// **굵게** + 용어 밑줄(리포트 전체에서 용어마다 첫 등장만, seen으로 공유)
export function RichT({ text, terms, seen }: { text: string; terms: Term[]; seen: Set<string> }) {
  const esc = terms.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
  const re = esc.length ? new RegExp(`(${esc.join('|')})`, 'g') : null
  const mark = (s: string) => !re ? s : s.split(re).map((p, i) => {
    const t = i % 2 ? terms.find((x) => x.term === p) : undefined
    if (!t || seen.has(p)) return p
    seen.add(p)
    return <TermSpan key={i} t={t} />
  })
  return <>{text.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i} className="font-bold text-link">{mark(p)}</b> : mark(p)))}</>
}

export function TermList({ terms }: { terms: Term[] }) {
  if (!terms.length) return null
  return (
    <div className="mt-16">
      <h2 className="text-[20px] font-bold mb-6">용어 풀이</h2>
      <dl className="space-y-4 text-[15px] leading-[1.7]">
        {terms.map((t) => <div key={t.term}><dt className="font-bold">{t.term}</dt><dd className="text-soft">{t.easy}</dd></div>)}
      </dl>
    </div>
  )
}
