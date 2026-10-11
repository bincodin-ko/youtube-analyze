// 확장 리포트: 플래시카드(뒤집기)·퀴즈(채점) 보기
import { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

export type Card = { q: string; a: string; refs: number[] }
export type Quiz = { q: string; choices: string[]; answer: number; explain: string; refs: number[] }
// 출처 [n] 버튼들 (클릭 시 해당 대본 시점으로 이동)
export type RefsFn = (refs: number[]) => React.ReactNode

const nav = 'flex items-center gap-1 h-9 px-4 rounded-full border border-line text-[14px] hover:bg-subtle disabled:opacity-40 disabled:hover:bg-bg'

export function Flashcards({ cards, refs }: { cards: Card[]; refs: RefsFn }) {
  const [i, setI] = useState(0)
  const [back, setBack] = useState(false)
  const go = (d: number) => { setBack(false); setI((x) => Math.min(cards.length - 1, Math.max(0, x + d))) }
  const c = cards[i]
  const face = 'absolute inset-0 grid place-items-center p-8 text-center rounded-2xl border border-line [backface-visibility:hidden]'
  return (
    <div>
      <button onClick={() => setBack(!back)} aria-label="카드 뒤집기" className="block w-full h-[260px] [perspective:1000px]">
        <div className={`relative size-full transition-transform duration-500 [transform-style:preserve-3d] ${back ? '[transform:rotateY(180deg)]' : ''}`}>
          <div className={`${face} bg-subtle`}>
            <div><p className="text-[12px] text-muted mb-3">질문 · 눌러서 뒤집기</p><p className="text-[20px] font-bold leading-[1.5] break-keep">{c.q}</p></div>
          </div>
          <div className={`${face} bg-bg [transform:rotateY(180deg)]`}>
            <div><p className="text-[12px] text-muted mb-3">답</p><p className="text-[17px] leading-[1.7] break-keep">{c.a}</p></div>
          </div>
        </div>
      </button>
      <p className="mt-3 text-[13px] text-muted min-h-5">{c.refs.length > 0 && <>근거 {refs(c.refs)}</>}</p>
      <div className="mt-3 flex items-center justify-between">
        <button className={nav} disabled={i === 0} onClick={() => go(-1)}><ChevronLeft size={16} />이전</button>
        <span className="text-[14px] text-soft">{i + 1} / {cards.length}</span>
        <button className={nav} disabled={i === cards.length - 1} onClick={() => go(1)}>다음<ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

export function QuizView({ qs, refs }: { qs: Quiz[]; refs: RefsFn }) {
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  if (i >= qs.length) {
    return (
      <div className="rounded-2xl bg-subtle py-14 text-center">
        <p className="text-[14px] text-muted">퀴즈 결과</p>
        <p className="text-[44px] font-bold my-2">{score} / {qs.length}</p>
        <p className="text-[15px] text-soft mb-6">{score === qs.length ? '모두 맞혔어요!' : score >= qs.length / 2 ? '잘했어요. 틀린 부분은 리포트에서 다시 확인해 보세요.' : '리포트를 한 번 더 읽고 다시 풀어 보세요.'}</p>
        <button onClick={() => { setI(0); setPick(null); setScore(0) }} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-fg text-bg text-[14px] font-semibold"><RotateCcw size={15} />다시 풀기</button>
      </div>
    )
  }
  const q = qs[i]
  const choose = (n: number) => { if (pick !== null) return; setPick(n); if (n === q.answer) setScore((s) => s + 1) }
  return (
    <div>
      <p className="text-[13px] text-muted mb-2">문제 {i + 1} / {qs.length}</p>
      <p className="text-[19px] font-bold leading-[1.5] mb-5 break-keep">{q.q}</p>
      <div className="space-y-2.5">
        {q.choices.map((c, n) => {
          const st = pick === null ? 'border-line hover:bg-subtle' : n === q.answer ? 'border-emerald-500 bg-emerald-500/10' : n === pick ? 'border-red-500 bg-red-500/10' : 'border-line opacity-60'
          return (
            <button key={n} onClick={() => choose(n)} className={`flex gap-3 w-full text-left rounded-xl border px-4 py-3 text-[15px] leading-[1.6] ${st}`}>
              <b className="shrink-0 w-5">{n + 1}</b><span>{c}</span>
            </button>
          )
        })}
      </div>
      {pick !== null && (
        <div className="mt-5 rounded-xl bg-subtle p-4 text-[15px] leading-[1.7]">
          <b className={pick === q.answer ? 'text-emerald-600' : 'text-red-500'}>{pick === q.answer ? '정답이에요' : `오답이에요 · 정답은 ${q.answer + 1}번`}</b>
          <p className="mt-1">{q.explain}</p>
          {q.refs.length > 0 && <p className="mt-2 text-[13px] text-muted">근거 {refs(q.refs)}</p>}
          <button onClick={() => { setI(i + 1); setPick(null) }} className="mt-4 h-9 px-5 rounded-full bg-fg text-bg text-[14px] font-semibold">{i + 1 === qs.length ? '결과 보기' : '다음 문제'}</button>
        </div>
      )}
    </div>
  )
}
