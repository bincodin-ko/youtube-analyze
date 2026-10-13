// 노트 화면 칸 크기: 왼쪽(영상·스크립트)·오른쪽(AI 채팅) 너비를 경계선 끌기로, 가운데 리포트의 글 폭·여백을 메뉴로 조절. 이 브라우저에 기억
import { useEffect, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

export type Layout = { left: number; right: number; text: number; pad: number } // text 0 = 꽉 채움
const DEF: Layout = { left: 330, right: 330, text: 900, pad: 32 }
const KEY = 'vn-layout'

export function useLayout() {
  const [l, set] = useState<Layout>(() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEF } })
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* 이번 화면만 */ } }, [l])
  return { l, patch: (p: Partial<Layout>) => set((o) => ({ ...o, ...p })), reset: (k: (keyof Layout)[]) => set((o) => ({ ...o, ...Object.fromEntries(k.map((x) => [x, DEF[x]])) })) }
}

// 칸 사이 세로 경계선: 끌기 · ←/→(Shift는 크게) · 두 번 누르면 기본 너비
export function Splitter({ label, value, min, max, dir, onChange, onReset }: { label: string; value: number; min: number; max: number; dir: 1 | -1; onChange: (v: number) => void; onReset: () => void }) {
  const start = useRef<[number, number] | null>(null)
  const clamp = (v: number) => Math.round(Math.min(Math.max(v, min), Math.max(min, max)))
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} tabIndex={0} title={`${label} (끌기 · 두 번 누르면 기본값)`}
      data-splitter={label}
      className="hidden min-[1100px]:block relative w-[7px] -mx-[3px] z-20 shrink-0 cursor-col-resize group outline-none touch-none"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = [e.clientX, value]; document.body.style.userSelect = 'none' }}
      onPointerMove={(e) => { if (start.current) onChange(clamp(start.current[1] + dir * (e.clientX - start.current[0]))) }}
      onPointerUp={() => { start.current = null; document.body.style.userSelect = '' }}
      onDoubleClick={onReset}
      onKeyDown={(e) => { const s = e.shiftKey ? 64 : 16; if (e.key === 'ArrowLeft') onChange(clamp(value - dir * s)); else if (e.key === 'ArrowRight') onChange(clamp(value + dir * s)); else return; e.preventDefault() }}>
      <span className="absolute inset-y-0 left-[3px] w-px bg-line group-hover:w-[3px] group-hover:left-[2px] group-hover:bg-fg/40 group-focus-visible:w-[3px] group-focus-visible:bg-fg/60 group-active:bg-fg/60 transition-[width,background-color] motion-reduce:transition-none" />
    </div>
  )
}

// 리포트 머리줄 「폭」 메뉴: 글 폭(꽉 채움까지) · 양옆 여백
export function WidthMenu({ l, patch, reset, className }: { l: Layout; patch: (p: Partial<Layout>) => void; reset: (k: (keyof Layout)[]) => void; className: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const f = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('mousedown', f); addEventListener('keydown', k)
    return () => { removeEventListener('mousedown', f); removeEventListener('keydown', k) }
  }, [open])
  const full = l.text === 0
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="글 폭·여백 조절" title="글 폭·여백 조절" className={className}><MoveHorizontal size={17} strokeWidth={1.6} /></button>
      {open && (
        <div role="dialog" aria-label="글 폭·여백" className="absolute right-0 top-11 z-30 w-[260px] rounded-xl border border-line bg-bg p-4 shadow-xl text-[13px]">
          <label className="flex items-center justify-between font-semibold">글 폭 <span className="font-normal text-muted">{full ? '꽉 채움' : `${l.text}px`}</span></label>
          <input type="range" aria-label="글 폭" min={480} max={1600} step={20} value={full ? 1600 : l.text} onChange={(e) => patch({ text: Number(e.target.value) })} className="w-full mt-2 accent-[var(--color-fg)]" />
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={full} onChange={(e) => patch({ text: e.target.checked ? 0 : 900 })} />꽉 채움(칸 폭만큼)</label>
          <label className="mt-4 flex items-center justify-between font-semibold">양옆 여백 <span className="font-normal text-muted">{l.pad}px</span></label>
          <input type="range" aria-label="양옆 여백" min={0} max={120} step={4} value={l.pad} onChange={(e) => patch({ pad: Number(e.target.value) })} className="w-full mt-2 accent-[var(--color-fg)]" />
          <p className="mt-3 text-muted leading-snug">칸 너비는 칸 사이 경계선을 끌어서 바꿔요. 두 번 누르면 기본값.</p>
          <button onClick={() => reset(['left', 'right', 'text', 'pad'])} className="mt-3 h-8 px-3 rounded-lg border border-line hover:bg-subtle">모두 기본값</button>
        </div>
      )}
    </div>
  )
}
