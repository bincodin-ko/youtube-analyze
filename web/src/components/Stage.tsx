import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'

// 재생 제어 추상화: 유튜브 IFrame 플레이어와 HTML5 <video> 둘 다 이걸로 다룬다
export type Ctl = { get(): number; set(n: number): void; max(): number; toggle(): void; pause(): void }
declare global { interface Window { __vnRate?: number[] } } // verify가 setPlaybackRate 호출을 읽는 기록

// 누르고 있으면(delay ms 이상) 최대 2배속, 떼면 원래 속도. 그 전에 떼면 재생/일시정지
function useHold(ctl: Ctl, delay: number, setFast: (n: number) => void) {
  const s = useRef<{ t: number; prev: number; fired: boolean } | null>(null)
  const down = () => {
    if (s.current) return
    const o = { t: 0, prev: 1, fired: false }
    o.t = window.setTimeout(() => { o.fired = true; o.prev = ctl.get(); const m = ctl.max(); ctl.set(m); setFast(m) }, delay)
    s.current = o
  }
  const up = () => {
    const o = s.current
    if (!o) return
    s.current = null; clearTimeout(o.t)
    if (o.fired) { ctl.set(o.prev); setFast(0) } else ctl.toggle()
  }
  return { down, up }
}

// 플레이어는 하나(iframe 재생성 시 재생이 끊김)를 fixed로 띄우고, 자리표시자(slot) 위치를 따라다닌다.
// 크게 보기에서 슬롯이 화면 밖으로 스크롤되면 리포트 영역 오른쪽 아래 작은 PIP로 옮긴다.
export default function Stage({ children, ctl, left, center, section, big }: {
  children: ReactNode; ctl: Ctl; left: RefObject<HTMLDivElement | null>; center: RefObject<HTMLDivElement | null>
  section: RefObject<HTMLElement | null>; big: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const [fast, setFast] = useState(0)
  const [pip, setPip] = useState(false)
  const closed = useRef(false)
  const pipRef = useRef(false)
  const mouse = useHold(ctl, 400, setFast)
  const key = useHold(ctl, 300, setFast)
  const kb = useRef(key); kb.current = key

  // 스페이스바: 입력창·버튼에 포커스가 없을 때만. 키 반복(repeat)은 무시
  useEffect(() => {
    const skip = (e: KeyboardEvent) => e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || !!(e.target as HTMLElement)?.closest?.('input,textarea,select,button,a,[contenteditable],[role=dialog]')
    const dn = (e: KeyboardEvent) => { if (skip(e)) return; e.preventDefault(); if (!e.repeat) kb.current.down() }
    const up = (e: KeyboardEvent) => { if (skip(e)) return; e.preventDefault(); kb.current.up() }
    addEventListener('keydown', dn); addEventListener('keyup', up)
    return () => { removeEventListener('keydown', dn); removeEventListener('keyup', up) }
  }, [])

  // 매 프레임 슬롯 위치를 따라감 (스크롤·접기·리사이즈 모두 한 번에 처리)
  // ponytail: rAF 폴링 — 슬롯 몇 개뿐이라 충분. 느려지면 ResizeObserver+scroll 이벤트로 교체
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = box.current, c = center.current, l = left.current, sec = section.current
      if (!el || !l || !sec) return
      const inCenter = big && !!c && c.offsetWidth > 0
      const s = inCenter ? c! : l
      let r = s.getBoundingClientRect(), p = false
      if (s.offsetWidth === 0) { el.style.display = 'none'; return }
      if (inCenter && r.bottom < 60) { // 스크롤로 나감 → PIP
        const sr = sec.getBoundingClientRect(), w = 400, h = 225
        r = new DOMRect(sr.right - w - 24, innerHeight - h - 16, w, h); p = true
      }
      if (p !== pipRef.current) { pipRef.current = p; setPip(p) }
      if (!p) closed.current = false
      el.style.display = p && closed.current ? 'none' : ''
      Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
        clipPath: !p && inCenter && r.top < 48 ? `inset(${48 - r.top}px 0 0 0)` : 'none' }) // 위 고정 막대 밑으로 들어갈 땐 잘라냄
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [big, left, center, section])

  return (
    <div ref={box} data-stage data-fast={fast} data-pip={pip ? 1 : 0} style={{ display: 'none' }}
      className={`fixed z-20 bg-black ${pip ? 'rounded-lg shadow-2xl border border-line overflow-hidden' : ''}`}>
      {children}
      {/* 투명 덮개: 짧은 클릭=재생/일시정지, 꾹 누르기=2배속. 아래 48px은 플레이어 컨트롤 막대용으로 비움 */}
      <div data-stage-cover className="absolute inset-x-0 top-0 bottom-12 select-none touch-none"
        onPointerDown={(e) => { if (e.button === 0) mouse.down() }} onPointerUp={mouse.up} onPointerCancel={mouse.up} onPointerLeave={mouse.up} />
      {fast > 0 && <span data-stage-badge className="absolute top-3 left-1/2 -translate-x-1/2 px-3 h-7 grid place-items-center rounded-full bg-black/70 text-white text-[13px] font-semibold pointer-events-none">{fast}배속 ▶▶</span>}
      {pip && <button onClick={() => { closed.current = true; ctl.pause() }} title="닫기" className="absolute top-1.5 right-1.5 grid place-items-center size-7 rounded-full bg-black/70 text-white"><X size={15} /></button>}
    </div>
  )
}
