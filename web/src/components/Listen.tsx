// 확장 리포트 「팟캐스트」(릴리스: 해설자 1명의 말풍선 문단, 글만) + 우리만 추가한 「듣기」(Edge 음성, 읽는 문단 강조)
// 「애니메이션」(릴리스: 쉬운 말 리포트 + 소제목마다 움직이는 SVG). SVG는 <img>로만 그려 스크립트가 돌 수 없게.
import { useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Play } from 'lucide-react'
import { RichT } from './ReportExtras'

export type Pod = { kind: 'podcast'; title: string; host: { name: string; role: string }; paras: { text: string; list: string[]; refs: number[] }[] }
export type Anim = { kind: 'anim'; title: string; intro: string; blocks: { heading: string; bullets: { text: string; refs: number[] }[]; svg: string }[] }
type St = { job: { done: number; total: number; busy: boolean; err: string | null; engine?: string } | null; ready: [number, string][] }

export function Podcast({ id, data, refs }: { id: string; data: Pod; refs: (rs: number[]) => React.ReactNode }) {
  const [st, setSt] = useState<St>({ job: null, ready: [] })
  const [cur, setCur] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const timer = useRef(0)
  const seen = new Set<string>()
  const n = data.paras.length
  const load = () => fetch(`/api/notes/${id}/podcast/audio`).then((r) => r.json()).then((s: St) => { setSt(s); if (!s.job?.busy) clearInterval(timer.current); return s }).catch(() => null)
  useEffect(() => { load(); return () => clearInterval(timer.current) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const file = new Map(st.ready) // 문단 번호 → 파일(p_0.mp3 또는 윈도우 음성 p_0.wav)
  const all = st.ready.length >= n
  const make = async () => {
    await fetch(`/api/notes/${id}/podcast/audio`, { method: 'POST' })
    clearInterval(timer.current); timer.current = window.setInterval(load, 2000); load()
  }
  const playAt = (i: number) => {
    const a = audio.current!; setCur(i)
    a.src = `/media/${id}/podcast/${file.get(i)}`; a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }
  const toggle = () => {
    const a = audio.current!
    if (playing) { a.pause(); setPlaying(false) } else if (cur == null) { playAt(0) } else { a.play().then(() => setPlaying(true)) }
  }
  const ended = () => { if (cur != null && cur + 1 < n && file.has(cur + 1)) playAt(cur + 1); else { setPlaying(false); setCur(null) } }
  const initial = data.host.name.slice(0, 1)
  return (
    <div data-podcast="">
      <div className="sticky top-12 z-10 mb-6 flex items-center gap-3 rounded-2xl border border-line bg-bg/95 backdrop-blur px-4 py-3">
        {all ? <button onClick={toggle} aria-label={playing ? '일시정지' : '듣기'} className="size-10 grid place-items-center rounded-full bg-fg text-bg">{playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}</button>
          : st.job?.busy ? <span className="size-10 grid place-items-center"><Loader2 size={20} className="animate-spin" /></span>
          : <button onClick={make} className="h-10 px-4 rounded-full bg-fg text-bg text-[14px] font-semibold">음성으로 듣기</button>}
        <div className="text-[14px] min-w-0">
          <div className="font-semibold truncate">{data.title}</div>
          <div className="text-muted text-[13px]">{st.job?.err ? st.job.err : st.job?.busy ? `음성 만드는 중 ${st.job.done}/${st.job.total}` : all ? (cur != null ? `${cur + 1}/${n} 문단 읽는 중` : `${n}개 문단 · ${st.ready.some(([, f]) => f.endsWith('.wav')) ? '윈도우 음성' : 'Edge 음성'}`) : '문단을 음성으로 읽어 드려요 (Edge 온라인 음성, 안 되면 윈도우 음성)'}</div>
        </div>
        <audio ref={audio} onEnded={ended} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      </div>
      {data.paras.map((p, i) => (
        <div key={i} data-para={i} className={`mb-6 rounded-2xl px-5 py-4 transition-colors ${cur === i ? 'bg-hl' : i === 0 || (i > 0 && i % 4 === 0) ? 'bg-subtle' : ''}`}>
          {(i === 0 || i % 4 === 0) && <div className="flex items-center justify-end gap-2.5 mb-2">
            <div className="text-right"><div className="text-[14px] font-semibold">{data.host.name}</div><div className="text-[12px] text-muted">{data.host.role}</div></div>
            <span className="size-9 grid place-items-center rounded-full bg-link text-white text-[15px] font-bold">{initial}</span>
          </div>}
          <p className="text-[16px] leading-[1.8]"><RichT text={p.text} terms={[]} seen={seen} />{refs(p.refs)}
            {all && <button onClick={() => playAt(i)} aria-label={`${i + 1}번 문단부터 듣기`} className="ml-1.5 align-middle text-muted hover:text-fg"><Play size={13} /></button>}</p>
          {p.list.length > 0 && <ul className="mt-3 list-disc pl-6 space-y-1.5 text-[15px] marker:text-muted">{p.list.map((x, k) => <li key={k}><RichT text={x} terms={[]} seen={seen} /></li>)}</ul>}
        </div>
      ))}
    </div>
  )
}

export function Animation({ data, refs }: { data: Anim; refs: (rs: number[]) => React.ReactNode }) {
  const seen = new Set<string>()
  return (
    <div data-anim="">
      <h3 className="text-[14px] font-bold mb-3">목차</h3>
      <nav className="border-l border-line pl-6 text-[14px] text-muted space-y-2 mb-12">
        <div>{data.title}</div>{data.blocks.map((b, i) => <a key={i} href={`#anim-${i}`} className="block pl-2 hover:text-fg">{b.heading}</a>)}
      </nav>
      {data.intro && <p className="text-[16px] leading-[1.85] mb-12"><RichT text={data.intro} terms={[]} seen={seen} /></p>}
      {data.blocks.map((b, i) => (
        <section key={i} id={`anim-${i}`} className="mb-14 scroll-mt-16">
          <h2 className="text-[20px] font-bold mb-5">{b.heading}</h2>
          <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.75] marker:text-muted mb-6">{b.bullets.map((t, k) => <li key={k}><RichT text={t.text} terms={[]} seen={seen} />{refs(t.refs)}</li>)}</ul>
          {b.svg && <img data-anim-svg="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(b.svg)}`} alt={`${b.heading} 움직이는 도식`} className="w-full rounded-xl bg-[#f7f7f5]" />}
        </section>
      ))}
    </div>
  )
}
