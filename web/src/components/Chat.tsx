import { useEffect, useRef, useState } from 'react'
import { ArrowUp, AtSign, Check, Clock, Copy, Globe, Paperclip, Sparkles } from 'lucide-react'
import { fmtTime, MOCK, type Note } from '../api'

type Msg = { role: 'user' | 'assistant'; text: string; err?: boolean }

// 채팅 한 개 복사(클립보드 API가 막히면 예전 방식으로)
function CopyBtn({ text, className = '' }: { text: string; className?: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch {
      const t = Object.assign(document.createElement('textarea'), { value: text })
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setDone(true); setTimeout(() => setDone(false), 2000)
  }
  return (
    <button onClick={copy} aria-label="복사" className={`mt-1 inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] text-muted hover:bg-subtle hover:text-fg ${className}`}>
      {done ? <><Check size={13} />복사됨</> : <><Copy size={13} />복사</>}
    </button>
  )
}

// 답 본문의 [n]을 보라 작은 버튼으로. 대본 범위 밖 번호는 숨김
function Answer({ text, tr, seek, time }: { text: string; tr: Note['transcript']; seek: (t: number) => void; time: boolean }) {
  if (!time) return <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.75]">{text.replace(/ ?\[\d{1,5}\]/g, '')}</p> // 끄면 [n]을 지우고 앞 공백도 정리
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.75]">
      {text.split(/\[(\d{1,5})\]/).map((p, k) => {
        if (k % 2 === 0) return p
        const i = +p, l = tr[i]
        return l ? <button key={k} onClick={() => seek(l.start)} title={`${fmtTime(l.start)}로 이동`}
          className="inline-grid place-items-center align-[2px] mx-0.5 h-[18px] min-w-[22px] px-1 rounded-md bg-hl text-link text-[11px] font-semibold leading-none">{i}</button> : null
      })}
    </p>
  )
}

// 오른쪽 패널 머리: 채팅 | 하이라이트
export function PanelTabs({ tab, setTab }: { tab: 'chat' | 'hl'; setTab: (t: 'chat' | 'hl') => void }) {
  return (
    <div className="flex gap-5 h-12">
      {([['chat', '채팅'], ['hl', '하이라이트']] as const).map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`text-[14px] font-bold h-12 border-b-2 ${tab === k ? 'border-fg' : 'border-transparent text-muted'}`}>{l}</button>
      ))}
    </div>
  )
}

// 자료 종류별 말: [부르는 이름, 근거 이름]
const WORDS: Record<string, [string, string]> = { article: ['글', '본문'], pdf: ['문서', '본문'], audio: ['음성', '대본'] }

export default function Chat({ note, seek, quote }: { note: Note; seek: (t: number) => void; quote?: { text: string; k: number } | null }) {
  const [kind, src] = WORDS[String(note.kind)] ?? ['영상', '대본']
  const ta = useRef<HTMLTextAreaElement>(null)
  const [sug, setSug] = useState<string[]>([])
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [sugErr, setSugErr] = useState('')
  const box = useRef<HTMLDivElement>(null)
  // [시간] 표시 켜기/끄기(브라우저에 기억)
  const [time, setTime] = useState(() => { try { return localStorage.getItem('chatTime') !== '0' } catch { return true } })
  const toggleTime = () => { setTime(!time); try { localStorage.setItem('chatTime', time ? '0' : '1') } catch { /* 저장 못 해도 이번 화면은 동작 */ } }
  const ready = note.status === 'done' && note.transcript.length > 0

  useEffect(() => {
    if (!ready || MOCK) return
    fetch(`/api/notes/${note.id}/chat`).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '불러오지 못했어요')
      const d = await r.json()
      setSug(d.suggestions); setMsgs(d.messages)
    }).catch((e) => setSugErr(e.message))
  }, [note.id, ready])
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }) }, [msgs])
  // 본문에서 고른 글을 인용으로 입력창에 넣기
  useEffect(() => {
    if (!quote) return
    setQ(quote.text.startsWith('「') ? quote.text : '> ' + quote.text.replace(/\s+/g, ' ') + '\n\n') // 「…」로 시작 = 마인드맵 질문, 그대로 채움
    setTimeout(() => ta.current?.focus(), 80)
  }, [quote])

  const send = async (text: string) => {
    text = text.trim()
    if (!text || busy || !ready) return
    setQ(''); setBusy(true)
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }])
    const patch = (f: (m: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), f(m[m.length - 1])])
    try {
      const r = await fetch(`/api/notes/${note.id}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: text }) })
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).detail || '답변을 받지 못했어요')
      const rd = r.body.getReader(), dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await rd.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n'); buf = parts.pop()!
        for (const p of parts) {
          if (!p.startsWith('data:')) continue
          const o = JSON.parse(p.slice(5))
          if (o.error) throw new Error(o.error)
          if (o.done) patch((m) => ({ ...m, text: o.text }))
          else if (o.t) patch((m) => ({ ...m, text: m.text + o.t }))
        }
      }
    } catch (e) {
      patch((m) => ({ ...m, text: m.text || (e as Error).message, err: true }))
    }
    setBusy(false)
  }

  const icon = 'grid place-items-center size-7 text-muted'
  return (
    <>
      <div ref={box} className="flex-1 min-h-0 overflow-y-auto scroll-thin px-5 py-5">
        {msgs.length === 0 ? (
          <>
            <span className="grid place-items-center size-9 rounded-full bg-accent text-black mt-10"><Sparkles size={18} /></span>
            <p className="mt-4 text-[15px] leading-[1.7]">{ready ? `이 ${kind}에서 궁금한 점을 물어보세요. ${src}에서 근거를 찾아 답해요.` : `노트가 완성되면 ${kind} 내용을 물어볼 수 있어요.`}</p>
            <div className="mt-6 flex flex-col items-end gap-2">
              {sug.map((s) => <button key={s} onClick={() => send(s)} className="max-w-full rounded-xl border border-line px-3.5 py-2 text-[14px] text-right hover:bg-subtle">{s}</button>)}
              {sugErr && <p className="text-[13px] text-muted">{sugErr}</p>}
              {ready && !sug.length && !sugErr && !MOCK && <p className="text-[13px] text-muted">추천 질문을 만드는 중…</p>}
            </div>
          </>
        ) : msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} className="group flex flex-col items-end mt-4">
            <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-subtle px-3.5 py-2 text-[15px] leading-[1.6]">{m.text}</p>
            <CopyBtn text={m.text} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
          </div>
        ) : (
          <div key={i} className={`mt-4 ${m.err ? 'text-muted' : ''}`}>
            {m.text ? <><Answer text={m.text} tr={note.transcript} seek={seek} time={time} /><CopyBtn text={m.text} /></> : <p className="text-[14px] text-muted animate-pulse">답변 작성 중…</p>}
          </div>
        ))}
      </div>
      <div className="mx-4 mb-2 rounded-xl border border-line p-3 shrink-0">
        <textarea ref={ta} value={q} rows={2} disabled={!ready} onChange={(e) => setQ(e.target.value)} placeholder="무엇이든 요청하세요 (질문, 작성, 수정)"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(q) } }}
          className="w-full resize-none bg-transparent text-fg outline-none text-[15px] leading-[1.6] placeholder:text-muted" />
        <div className="flex items-center gap-1 mt-1">
          <span className={icon} title="다음 단계"><Paperclip size={16} /></span>
          <span className={icon} title="다음 단계"><AtSign size={16} /></span>
          <span className={icon} title="다음 단계"><Globe size={16} /></span>
          <button onClick={toggleTime} aria-pressed={time} title="답변의 [시간] 버튼 표시"
            className={`flex items-center gap-1 h-7 px-2 rounded-md text-[12px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg ${time ? 'bg-hl text-link font-semibold' : 'text-muted hover:bg-subtle'}`}><Clock size={14} />시간 표시</button>
          <span className="ml-auto mr-2 text-[14px] text-muted">일반</span>
          <button onClick={() => send(q)} disabled={!q.trim() || busy || !ready} title="보내기"
            className="grid place-items-center size-7 rounded-full bg-fg text-bg disabled:bg-line disabled:text-muted"><ArrowUp size={15} /></button>
        </div>
      </div>
      <p className="mb-4 text-center text-[12px] text-muted shrink-0">{kind} {src}을 근거로 답해요</p>
    </>
  )
}
