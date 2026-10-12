// PPT(릴리스 「PPT 만들기」 배치 그대로): 만들기 창(스타일 9종 3×3 견본·슬라이드 수 2–30·커스텀 지시·레퍼런스 이미지 4장)
// → 카드(PPT·제목·▷ 슬라이드쇼·✎ 수정·⬇ PPTX) + 슬라이드 세로 나열(올리면 ✎·n/N) → 슬라이드 수정 창(지시 적은 장만 다시) / 슬라이드쇼(‹ › ←→ Esc).
// 슬라이드는 1280×720 HTML(한글 정확), 다운로드는 서버 python-pptx(글자 편집 가능). 색은 backend/app/ppt.py THEMES와 같게.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ImagePlus, Minus, Pencil, Play, Plus, X } from 'lucide-react'

export type Slide = { layout: 'cover' | 'bullets' | 'two' | 'steps' | 'stat' | 'quote' | 'closing'; title: string; subtitle: string; points: string[]; stat: string; quote: string; ref: number | null; left?: { head: string; points: string[] }; right?: { head: string; points: string[] } }
export type Deck = { kind: 'ppt'; title: string; style: string; accent: string; slides: Slide[] }
type Th = { name: string; bg: string; fg: string; accent: string; sub: string; serif?: boolean; band?: boolean; frame?: boolean }
export const THEMES: Record<string, Th> = {
  minimal: { name: '미니멀', bg: '#ffffff', fg: '#111111', accent: '#e63946', sub: '#666666' },
  magazine: { name: '매거진', bg: '#f3efe7', fg: '#1d1d1d', accent: '#c0392b', sub: '#6b6359', serif: true },
  paper: { name: '논문', bg: '#ffffff', fg: '#1a2b4a', accent: '#1f4e8c', sub: '#5c6b82', serif: true },
  diagram: { name: '도식', bg: '#f7fbff', fg: '#14324d', accent: '#2f8fd8', sub: '#5d7a93' },
  architecture: { name: '건축', bg: '#eceae4', fg: '#2a2a2a', accent: '#7a7a7a', sub: '#6f6f6f' },
  cobalt: { name: '코발트', bg: '#ffffff', fg: '#0b1f66', accent: '#1d3fd6', sub: '#4a5a8c', band: true },
  bold: { name: '볼드', bg: '#fff6d5', fg: '#111111', accent: '#ff2e2e', sub: '#333333', frame: true },
  retro: { name: '레트로', bg: '#f4ead5', fg: '#4a2c1a', accent: '#d9822b', sub: '#7a5a43', serif: true },
  luxury: { name: '럭셔리', bg: '#0e0e0e', fg: '#f2e6c9', accent: '#c9a24a', sub: '#a89d86', serif: true },
}
const SW = 1280, SH = 720
const SAMPLE: Slide = { layout: 'two', title: '복리의 힘', subtitle: '', points: [], stat: '', quote: '', ref: null, left: { head: '10년', points: ['원금 1,200만 원', '결과 1,900만 원'] }, right: { head: '30년', points: ['원금 3,600만 원', '결과 9,800만 원'] } }

// 슬라이드 한 장(1280×720 기준, 바깥에서 scale)
export function SlideView({ s, style, accent, logo, i, n }: { s: Slide; style: string; accent?: string; logo?: string; i?: number; n?: number }) {
  const t = THEMES[style] ?? THEMES.minimal
  const ac = accent || t.accent
  const font = t.serif ? '"Noto Serif KR", "Nanum Myeongjo", Batang, serif' : '"Pretendard Variable", Pretendard, sans-serif'
  const list = (ps: string[], num = false, size = 34) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {ps.map((p, k) => <div key={k} style={{ display: 'flex', gap: 18, alignItems: 'baseline', fontSize: size, lineHeight: 1.4 }}>
        <span style={{ flex: 'none', color: ac, fontWeight: 800, minWidth: num ? 44 : 18 }}>{num ? String(k + 1).padStart(2, '0') : '•'}</span><span>{p}</span></div>)}
    </div>
  )
  const head = <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.25, marginBottom: 48, wordBreak: 'keep-all' }}>{s.title}</div>
  const body = s.layout === 'cover' || s.layout === 'closing' ? (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ width: 90, height: 10, background: ac, marginBottom: 40 }} />
      <div style={{ fontSize: s.layout === 'cover' ? 78 : 62, fontWeight: 800, lineHeight: 1.2, wordBreak: 'keep-all' }}>{s.title}</div>
      {s.layout === 'cover' ? <div style={{ fontSize: 34, color: t.sub, marginTop: 30 }}>{s.subtitle}</div> : <div style={{ marginTop: 40 }}>{list(s.points, false, 30)}</div>}
    </div>
  ) : s.layout === 'two' ? (<>{head}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
      {[s.left, s.right].map((sd, k) => <div key={k} style={{ border: `${t.frame ? 6 : 2}px solid ${k ? ac : t.fg}`, padding: 36, borderRadius: t.frame ? 0 : 16, background: k ? `${ac}12` : 'transparent' }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: k ? ac : t.fg, marginBottom: 24 }}>{sd?.head}</div>{list(sd?.points ?? [], false, 30)}</div>)}
    </div></>
  ) : s.layout === 'stat' ? (<>{head}
    <div style={{ fontSize: 150, fontWeight: 900, color: ac, lineHeight: 1, marginBottom: 40 }}>{s.stat}</div>{list(s.points, false, 30)}</>
  ) : s.layout === 'quote' ? (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 160, lineHeight: .6, color: ac, fontWeight: 900 }}>“</div>
      <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.4, wordBreak: 'keep-all' }}>{s.quote || s.points[0]}</div>
      <div style={{ fontSize: 30, color: t.sub, marginTop: 30 }}>— {s.title}</div>
    </div>
  ) : (<>{head}{list(s.points, s.layout === 'steps')}</>)
  return (
    <div style={{ width: SW, height: SH, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', background: t.bg, color: t.fg, fontFamily: font, padding: t.band ? '70px 96px 70px 150px' : '70px 96px', border: t.frame ? `14px solid ${t.fg}` : undefined }}>
      {t.band ? <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 70, background: ac }} /> : <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 12, background: ac }} />}
      {body}
      {i != null && n != null && <div style={{ position: 'absolute', right: 40, bottom: 26, fontSize: 22, color: t.sub }}>{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</div>}
      {logo && <img src={logo} alt="" style={{ position: 'absolute', left: t.band ? 100 : 40, bottom: 24, height: 44, objectFit: 'contain' }} />}
    </div>
  )
}

// 폭에 맞춰 슬라이드를 축소해 보여 주는 틀
function Fit({ children, className }: { children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0.3)
  useLayoutEffect(() => {
    const f = () => setK((box.current?.clientWidth ?? SW) / SW)
    f(); const ro = new ResizeObserver(f); ro.observe(box.current!); return () => ro.disconnect()
  }, [])
  return <div ref={box} className={`relative overflow-hidden ${className ?? ''}`} style={{ aspectRatio: '16 / 9' }}><div style={{ transform: `scale(${k})`, transformOrigin: 'top left', width: SW }}>{children}</div></div>
}

const useEsc = (f: () => void) => useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') f() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [f])

// 「PPT 만들기」 창
export function PptPicker({ id, onClose, onMake }: { id: string; onClose: () => void; onMake: (o: { style: string; count: number; extra: string }) => void }) {
  const [style, setStyle] = useState('minimal')
  const [count, setCount] = useState(5)
  const [extra, setExtra] = useState('')
  const [refs, setRefs] = useState<string[]>([])
  const [err, setErr] = useState('')
  useEsc(onClose)
  const load = () => fetch(`/api/notes/${id}/ppt/ref`).then((r) => r.json()).then(setRefs).catch(() => {})
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const upload = async (fs: FileList | null) => {
    setErr('')
    for (const f of [...(fs ?? [])]) {
      const fd = new FormData(); fd.append('file', f)
      const r = await fetch(`/api/notes/${id}/ppt/ref`, { method: 'POST', body: fd })
      if (!r.ok) { setErr((await r.json().catch(() => null))?.detail || '넣지 못했어요'); break }
    }
    load()
  }
  const remove = (n: string) => fetch(`/api/notes/${id}/ppt/ref/${n}`, { method: 'DELETE' }).then(load)
  const step = (d: number) => setCount((c) => Math.max(2, Math.min(30, c + d)))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="PPT 만들기" onClick={(e) => e.stopPropagation()} className="relative w-full min-w-0 max-w-[536px] max-h-[90vh] flex flex-col rounded-3xl bg-bg shadow-[0_8px_40px_rgba(0,0,0,.18)]">
        <button onClick={onClose} aria-label="닫기" className="absolute right-5 top-5 text-muted hover:text-fg"><X size={18} /></button>
        <div className="pt-8 pb-5 px-6 text-center shrink-0"><h2 className="text-[20px] font-bold">PPT 만들기</h2><p className="mt-2 text-[13px] text-soft">요약을 발표용 슬라이드 덱으로 만들어요</p></div>
        <div className="px-6 pb-4 overflow-y-auto scroll-thin">
          <h3 className="text-[15px] font-bold mb-3">스타일 <span className="text-[13px] font-normal text-muted ml-1">하나를 골라주세요</span></h3>
          <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="스타일">
            {Object.entries(THEMES).map(([k, t]) => (
              <button key={k} role="radio" aria-checked={style === k} aria-label={t.name} onClick={() => setStyle(k)} className="text-left">
                <div className={`relative rounded-lg overflow-hidden border ${style === k ? 'border-fg border-2' : 'border-line'}`}>
                  <Fit><SlideView s={SAMPLE} style={k} /></Fit>
                </div>
                <div className="mt-1.5 text-[14px]">{t.name}</div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center">
            <h3 className="text-[15px] font-bold">슬라이드 수 <span className="text-[13px] font-normal text-muted ml-1">2–30장</span></h3>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => step(-1)} disabled={count <= 2} aria-label="한 장 빼기" className="size-9 grid place-items-center rounded-lg bg-subtle disabled:opacity-40"><Minus size={16} /></button>
              <span data-count="" className="w-6 text-center text-[16px] font-semibold">{count}</span>
              <button onClick={() => step(1)} disabled={count >= 30} aria-label="한 장 더하기" className="size-9 grid place-items-center rounded-lg bg-subtle disabled:opacity-40"><Plus size={16} /></button>
            </div>
          </div>
          <h3 className="text-[15px] font-bold mt-6">커스텀 지시 <span className="text-[13px] font-normal text-muted">(선택)</span></h3>
          <p className="text-[12px] text-muted mt-1 mb-2">선택한 스타일 위에 추가로 반영돼요</p>
          <textarea aria-label="커스텀 지시" value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} maxLength={500} placeholder="예: 숫자 위주로, 투자자 발표용으로"
            className="w-full p-3 rounded-xl border border-line bg-bg text-[14px] outline-none focus:border-fg resize-none" />
          <h3 className="text-[15px] font-bold mt-6">레퍼런스 이미지 <span className="text-[13px] font-normal text-muted">(선택) 최대 4장</span></h3>
          <div className="mt-2 flex gap-2.5">
            {refs.map((n) => <div key={n} className="relative size-[72px] rounded-lg overflow-hidden border border-line">
              <img src={`/media/${id}/ppt_ref/${n}`} alt="레퍼런스" className="size-full object-cover" />
              <button onClick={() => remove(n)} aria-label="레퍼런스 빼기" className="absolute top-1 right-1 size-5 grid place-items-center rounded-full bg-black/60 text-white"><X size={12} /></button>
            </div>)}
            {refs.length < 4 && <label className="size-[72px] grid place-items-center rounded-lg border border-dashed border-line text-muted cursor-pointer hover:bg-subtle" title="이미지 넣기">
              <ImagePlus size={20} /><input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" aria-label="레퍼런스 이미지 넣기" onChange={(e) => upload(e.target.files)} />
            </label>}
          </div>
          <p className="text-[12px] text-muted mt-2">로고·브랜드·스타일 이미지를 넣으면 슬라이드에 반영해요 (첫 장은 로고로 구석에 들어가요)</p>
          {err && <p className="text-[13px] text-red-500 mt-1">{err}</p>}
        </div>
        <div className="flex gap-3 p-5 shrink-0">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-subtle text-[15px] font-semibold hover:bg-line">취소</button>
          <button onClick={() => onMake({ style, count, extra: extra.trim() })} className="flex-1 h-12 rounded-xl bg-accent text-[#0c0d08] text-[15px] font-bold hover:brightness-95">만들기</button>
        </div>
      </div>
    </div>
  )
}

// 결과 카드 + 슬라이드 수정 창 + 슬라이드쇼
export function PptDeck({ id, deck, onRevised }: { id: string; deck: Deck; onRevised: (d: Deck) => void }) {
  const [show, setShow] = useState<number | null>(null)
  const [edit, setEdit] = useState<number | null>(null)
  const [refs, setRefs] = useState<string[]>([])
  useEffect(() => { fetch(`/api/notes/${id}/ppt/ref`).then((r) => r.json()).then(setRefs).catch(() => {}) }, [id])
  const logo = refs[0] ? `/media/${id}/ppt_ref/${refs[0]}` : undefined
  const n = deck.slides.length
  const ib = 'grid place-items-center size-9 rounded-lg text-muted hover:bg-subtle hover:text-fg'
  return (
    <div data-ppt="" className="rounded-2xl border border-line overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
        <div className="min-w-0"><div className="text-[12px] text-muted">PPT</div><div className="text-[15px] font-semibold truncate">{deck.title}</div></div>
        <div className="ml-auto flex gap-0.5">
          <button aria-label="슬라이드쇼" title="슬라이드쇼" onClick={() => setShow(0)} className={ib}><Play size={16} /></button>
          <button aria-label="수정" title="수정" onClick={() => setEdit(0)} className={ib}><Pencil size={16} /></button>
          <a aria-label="PPTX 다운로드" title="PPTX 다운로드" href={`/api/notes/${id}/ppt.pptx`} download className={ib}><Download size={16} /></a>
        </div>
      </div>
      <div className="p-4 space-y-4 bg-subtle/40">
        {deck.slides.map((s, i) => (
          <div key={i} data-slide={i} className="group relative rounded-xl overflow-hidden border border-line bg-bg">
            <Fit><SlideView s={s} style={deck.style} accent={deck.accent} logo={logo} i={i} n={n} /></Fit>
            <button aria-label={`${i + 1}번 슬라이드 수정`} onClick={() => setEdit(i)} className="absolute top-2.5 right-2.5 size-8 grid place-items-center rounded-lg bg-black/55 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"><Pencil size={14} /></button>
            <span className="absolute bottom-2.5 left-2.5 px-2 h-6 grid place-items-center rounded-md bg-black/55 text-white text-[12px] opacity-0 group-hover:opacity-100">{i + 1}/{n}</span>
          </div>
        ))}
      </div>
      {show != null && <Slideshow deck={deck} logo={logo} at={show} onClose={() => setShow(null)} />}
      {edit != null && <EditSlides id={id} deck={deck} logo={logo} at={edit} onClose={() => setEdit(null)} onDone={(d) => { setEdit(null); onRevised(d) }} />}
    </div>
  )
}

function Slideshow({ deck, logo, at, onClose }: { deck: Deck; logo?: string; at: number; onClose: () => void }) {
  const [i, setI] = useState(at)
  const n = deck.slides.length
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') setI((x) => Math.min(n - 1, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)) }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [n, onClose])
  return (
    <div role="dialog" aria-label="슬라이드쇼" className="fixed inset-0 z-[60] bg-black/85 grid place-items-center p-6" onClick={onClose}>
      <button aria-label="닫기" onClick={onClose} className="absolute top-5 right-5 size-10 grid place-items-center rounded-full bg-white/15 text-white"><X size={20} /></button>
      <button aria-label="이전" disabled={i === 0} onClick={(e) => { e.stopPropagation(); setI(i - 1) }} className="absolute left-5 size-11 grid place-items-center rounded-full bg-white/15 text-white disabled:opacity-30"><ChevronLeft size={22} /></button>
      <div onClick={(e) => e.stopPropagation()} className="w-[min(1100px,calc(100vw-160px))]"><Fit className="rounded-lg"><SlideView s={deck.slides[i]} style={deck.style} accent={deck.accent} logo={logo} /></Fit></div>
      <button aria-label="다음" disabled={i === n - 1} onClick={(e) => { e.stopPropagation(); setI(i + 1) }} className="absolute right-5 size-11 grid place-items-center rounded-full bg-white/15 text-white disabled:opacity-30"><ChevronRight size={22} /></button>
      <span data-pos="" className="absolute bottom-6 px-3 h-8 grid place-items-center rounded-full bg-white/15 text-white text-[14px]">{i + 1} / {n}</span>
    </div>
  )
}

function EditSlides({ id, deck, logo, at, onClose, onDone }: { id: string; deck: Deck; logo?: string; at: number; onClose: () => void; onDone: (d: Deck) => void }) {
  const [i, setI] = useState(at)
  const [ch, setCh] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEsc(onClose)
  const todo = Object.values(ch).filter((v) => v.trim()).length
  const go = async () => {
    setBusy(true); setErr('')
    const r = await fetch(`/api/notes/${id}/ppt/revise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: ch }) })
    setBusy(false)
    if (!r.ok) return setErr((await r.json().catch(() => null))?.detail || '수정본을 만들지 못했어요')
    onDone(await r.json())
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="슬라이드 수정" onClick={(e) => e.stopPropagation()} className="w-full min-w-0 max-w-[1080px] h-[min(720px,90vh)] flex flex-col rounded-3xl bg-bg shadow-[0_8px_40px_rgba(0,0,0,.18)]">
        <div className="relative px-7 pt-6 pb-4 border-b border-line shrink-0">
          <h2 className="text-[18px] font-bold">슬라이드 수정</h2><p className="mt-1 text-[13px] text-soft">바꾸고 싶은 슬라이드에만 지시를 적어주세요. 빈 칸은 그대로 유지됩니다.</p>
          <button onClick={onClose} aria-label="닫기" className="absolute right-6 top-6 text-muted hover:text-fg"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 p-6 overflow-y-auto bg-subtle/50">
            <div className="relative max-w-[600px] mx-auto rounded-xl overflow-hidden border border-line bg-bg"><Fit><SlideView s={deck.slides[i]} style={deck.style} accent={deck.accent} logo={logo} /></Fit>
              <span className="absolute top-2 left-2 px-2 h-6 grid place-items-center rounded-md bg-black/55 text-white text-[12px]">{i + 1}/{deck.slides.length}</span></div>
            <label htmlFor="es-t" className="block mt-5 text-[14px] font-bold">{i + 1}번 슬라이드 변경</label>
            <textarea id="es-t" value={ch[i] ?? ''} onChange={(e) => setCh({ ...ch, [i]: e.target.value })} rows={3} placeholder="예: 표를 더 크게, 색을 파랗게 (비우면 유지)"
              className="mt-2 w-full p-3 rounded-xl border border-line bg-bg text-[14px] outline-none focus:border-fg resize-none" />
            {err && <p className="mt-2 text-[13px] text-red-500">{err}</p>}
          </div>
          <div className="w-[190px] shrink-0 border-l border-line overflow-y-auto p-3 space-y-3">
            {deck.slides.map((s, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`${k + 1}번 슬라이드 고르기`} className={`relative block w-full rounded-lg overflow-hidden border-2 ${k === i ? 'border-fg' : 'border-transparent'}`}>
                <Fit><SlideView s={s} style={deck.style} accent={deck.accent} /></Fit>
                <span className="absolute bottom-1 left-1 px-1.5 h-5 grid place-items-center rounded bg-black/55 text-white text-[11px]">{k + 1}{ch[k]?.trim() ? ' ✎' : ''}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-line shrink-0">
          <span className="text-[14px] text-soft">변경할 슬라이드 {todo}개</span>
          <button onClick={onClose} className="ml-auto h-10 px-4 rounded-xl bg-subtle text-[14px] font-semibold">취소</button>
          <button disabled={!todo || busy} onClick={go} className="h-10 px-4 rounded-xl bg-accent text-[#0c0d08] text-[14px] font-bold disabled:opacity-40">{busy ? '만드는 중…' : '수정본 생성'}</button>
        </div>
      </div>
    </div>
  )
}
