// 요약 화면 부품(릴리스 배치): 첫 소제목 아래 도식 한 장 · 오른쪽 가장자리 미니 목차 줄(마우스를 올리면 목차) · 도입 접기 ^
import { useEffect, useState } from 'react'
import { ChevronUp, Loader2, Maximize2, X } from 'lucide-react'

const tried = new Set<string>() // 노트마다 자동 생성은 한 번만(실패해도 다시 조르지 않음)

// 도식: 저장된 diagram.svg가 없으면 처음 볼 때 한 번 만든다(AI). SVG는 <img>로만 그린다.
export function SummaryDiagram({ id }: { id: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [big, setBig] = useState(false)
  const [fail, setFail] = useState(false)
  const [n, setN] = useState(0) // 다시 시도 횟수
  useEffect(() => { if (!big) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false) }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [big])
  useEffect(() => {
    let live = true
    fetch(`/api/notes/${id}/diagram`).then((r) => r.json()).then((d) => {
      if (!live) return
      if (d.svg) return setSvg(d.svg)
      if (tried.has(id) && !n) return
      tried.add(id); setBusy(true); setFail(false)
      fetch(`/api/notes/${id}/diagram`, { method: 'POST' }).then((r) => (r.ok ? r.json() : null)).then((x) => { if (!live) return; if (x?.svg) setSvg(x.svg); else setFail(true) })
        .catch(() => live && setFail(true)).finally(() => live && setBusy(false))
    }).catch(() => {})
    return () => { live = false }
  }, [id, n])
  if (!svg && fail && !busy) return <div data-diagram-fail="" className="mb-6 rounded-xl bg-subtle px-4 py-3 text-[14px] text-muted flex items-center gap-2">도식을 만들지 못했어요 <button onClick={() => setN(n + 1)} className="underline hover:text-fg">다시 시도</button></div>
  if (!svg) return busy ? <div data-diagram-busy="" className="mb-6 aspect-[16/9] rounded-xl bg-subtle grid place-items-center text-[14px] text-muted"><span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />도식 그리는 중…</span></div> : null
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return (
    <div className="relative mb-6">
      <img data-diagram="" src={src} alt="첫 장 도식" className="w-full rounded-xl border border-line bg-white" />
      <button onClick={() => setBig(true)} aria-label="도식 크게 보기" className="absolute top-3 right-3 size-8 grid place-items-center rounded-lg bg-black/45 text-white hover:bg-black/60"><Maximize2 size={15} /></button>
      {big && <div role="dialog" aria-label="도식" className="fixed inset-0 z-[60] bg-black/80 grid place-items-center p-8" onClick={() => setBig(false)}>
        <button aria-label="닫기" className="absolute top-5 right-5 size-10 grid place-items-center rounded-full bg-white/15 text-white"><X size={20} /></button>
        <img src={src} alt="첫 장 도식" className="max-w-full max-h-full rounded-xl bg-white" />
      </div>}
    </div>
  )
}

// 미니 목차 줄: 소제목마다 짧은 가로줄(지금 읽는 곳은 길게). 마우스를 올리면 목차 창.
export function TocRail({ items, onGo }: { items: { id: string; title: string; start: number; sub?: boolean }[]; onGo: (id: string, start: number) => void }) {
  const [act, setAct] = useState(items[0]?.id)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const els = items.map((x) => document.getElementById(`sec-${x.id}`)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setAct(v.target.id.slice(4)) }, { rootMargin: '-10% 0px -70% 0px' })
    els.forEach((e) => io.observe(e)); return () => io.disconnect()
  }, [items])
  if (items.length < 2) return null
  return (
    <div className="sticky top-24 h-0 z-20 hidden min-[1100px]:block" onMouseLeave={() => setOpen(false)}>
      <div data-rail="" onMouseEnter={() => setOpen(true)} onFocus={() => setOpen(true)} tabIndex={0} aria-label="목차 미리보기" className="absolute -right-10 top-0 flex flex-col items-end gap-[7px] py-2 pl-3 cursor-pointer">
        {items.map((x) => <span key={x.id} className={`block h-[2px] rounded ${x.id === act ? 'w-4 bg-fg' : 'w-2.5 bg-line'}`} />)}
      </div>
      {open && <div data-rail-pop="" className="absolute -right-6 top-0 w-[280px] max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-bg p-2 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
        {items.map((x) => <button key={x.id} onClick={() => { setOpen(false); onGo(x.id, x.start) }} className={`block w-full text-left h-8 px-2 rounded-md text-[13px] truncate hover:bg-subtle ${x.sub ? 'pl-5 text-muted' : ''} ${x.id === act ? 'font-semibold text-fg' : ''}`}>{x.id}. {x.title}</button>)}
      </div>}
    </div>
  )
}

// 도입(핵심 요점) 접기 ^ — 가로줄 가운데 둥근 버튼
export function FoldLine({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="relative mt-8 border-t border-line">
      <button onClick={onToggle} aria-label={open ? '핵심 요점 접기' : '핵심 요점 펼치기'} aria-expanded={open} className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-full border border-line bg-bg text-muted hover:text-fg">
        <ChevronUp size={15} className={open ? '' : 'rotate-180'} />
      </button>
    </div>
  )
}
