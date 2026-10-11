import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

// 재생 제어 추상화: 유튜브 IFrame 플레이어와 HTML5 <video> 둘 다 이걸로 다룬다
export type Ctl = { get(): number; set(n: number): void; max(): number; toggle(): void; pause(): void }
declare global { interface Window { __vnRate?: number[] } } // verify가 setPlaybackRate 호출을 읽는 기록

// 스페이스를 누르고 있으면(delay ms 이상) 최대 2배속, 떼면 원래 속도. 그 전에 떼면 재생/일시정지
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

// 플레이어는 하나(iframe 재생성 시 재생이 끊김)를 fixed로 띄우고, 자리표시자(slot) 위치·크기를 따라다닌다.
export default function Stage({ children, ctl, slot, hold }: { children: ReactNode; ctl: Ctl; slot: RefObject<HTMLDivElement | null>; hold?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [fast, setFast] = useState(0)
  const key = useHold(ctl, 300, setFast)
  const kb = useRef(key); kb.current = key

  // 스페이스바: 입력창·버튼에 포커스가 없을 때만. 키 반복(repeat)은 무시
  useEffect(() => {
    const skip = (e: KeyboardEvent) => e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || !!(e.target as HTMLElement)?.closest?.('input,textarea,select,button,a,[contenteditable],[role=dialog]')
    const dn = (e: KeyboardEvent) => { if (skip(e)) return; e.preventDefault(); if (!e.repeat) kb.current.down() }
    const up = (e: KeyboardEvent) => { if (skip(e)) return; e.preventDefault(); kb.current.up() }
    // 영상(유튜브 iframe)을 클릭하면 키 입력이 iframe으로 가서 스페이스 2배속이 안 먹음 → 포커스를 앱으로 되돌림
    // (덮개를 씌우면 유튜브 전체화면·음소거 버튼이 눌리지 않아서 이 방식. 대신 유튜브 자체 단축키는 안 먹음)
    const back = () => setTimeout(() => { const a = document.activeElement; if (a?.tagName === 'IFRAME' && box.current?.contains(a)) { (a as HTMLElement).blur(); window.focus() } }, 0)
    // 데스크톱 앱(pywebview): 유튜브 전체화면은 앱 창 안만 채움 → 창도 같이 전체화면
    const fs = () => (window as { pywebview?: { api?: { fullscreen?: (on: boolean) => void } } }).pywebview?.api?.fullscreen?.(!!document.fullscreenElement)
    addEventListener('keydown', dn); addEventListener('keyup', up); addEventListener('blur', back); document.addEventListener('fullscreenchange', fs)
    return () => { removeEventListener('keydown', dn); removeEventListener('keyup', up); removeEventListener('blur', back); document.removeEventListener('fullscreenchange', fs) }
  }, [])

  // 매 프레임 슬롯 위치를 따라감 (접기·크게 보기·리사이즈 모두 한 번에 처리)
  // ponytail: rAF 폴링 — 슬롯 하나라 충분. 느려지면 ResizeObserver로 교체
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = box.current, s = slot.current
      if (!el) return
      if (!s || s.offsetWidth === 0) { el.style.display = 'none'; return }
      const r = s.getBoundingClientRect()
      Object.assign(el.style, { display: '', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [slot])

  return (
    <div ref={box} data-stage data-fast={fast} style={{ display: 'none' }}
      className="fixed z-20 bg-black">
      {children}
      {/* 크게 보기 때만: 위(음소거·설정) 줄과 아래(전체화면·공유, 아래에서 ~130px) 버튼을 뺀 가운데를 꾹 누르면 2배속, 짧게 누르면 재생/정지 */}
      {hold && <div data-stage-cover className="absolute inset-x-0 top-[56px] bottom-[136px] hidden min-[1100px]:block cursor-pointer select-none"
        onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); key.down() } }}
        onPointerUp={() => key.up()} onPointerCancel={() => key.up()} />}
      {fast > 0 && <span data-stage-badge className="absolute top-3 left-1/2 -translate-x-1/2 px-3 h-7 grid place-items-center rounded-full bg-black/70 text-white text-[13px] font-semibold pointer-events-none">{fast}배속 ▶▶</span>}
    </div>
  )
}
