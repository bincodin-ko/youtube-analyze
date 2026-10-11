// 카툰 요약: 칸 격자(넓으면 2열, 좁으면 1열). 그림은 서버(ComfyUI)가 만들고, 말풍선·캡션은 HTML로 덧씌운다.
// 그림 모델이 없으면 simple 모드(아이콘 칸 + 말풍선). PNG 저장은 인라인 스타일만 쓴다(Infographic과 같은 방식).
import { useRef } from 'react'
import { Download, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { ICONS, pal, posterPng } from './Infographic'

type Panel = { scene: string; bubble: string; caption: string; icon: string; ref: number | null; img?: string }
export type Toon = { title: string; mode: 'ai' | 'simple'; fallback_reason?: string; panels: Panel[] }
const TINTS = ['#ffe8a3', '#c9ecff', '#ffd6e0', '#d8f5c2', '#e3dcff', '#ffe0c2', '#c7f2ea', '#f3d9ff']

export default function Cartoon({ id, data, name, prog, redo, onRedo, onRef }: {
  id: string; data: Toon; name: string; prog: string; redo: number | null; onRedo: (i: number) => void; onRef: (n: number) => void
}) {
  const dark = document.documentElement.classList.contains('dark')
  const c = pal(dark)
  const poster = useRef<HTMLDivElement>(null)
  const ink = '#0c0d08'

  // 복제본에서 버튼을 지우고 그림을 data URI로 바꾼 뒤 800px 2열로 저장
  const prep = async (el: HTMLElement) => {
    el.querySelectorAll('[data-nosave]').forEach((x) => x.remove())
    const grid = el.querySelector<HTMLElement>('[data-grid]')!
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)'
    for (const im of el.querySelectorAll('img')) {
      const b = await fetch(im.src).then((r) => r.blob())
      im.src = await new Promise<string>((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.readAsDataURL(b) })
    }
  }

  const panel = (p: Panel, i: number) => {
    const Ic = ICONS[p.icon as keyof typeof ICONS] ?? Sparkles
    const drawing = data.mode === 'ai' && (redo === i || (!p.img && !!prog))
    return (
      <div key={i} style={{ border: `3px solid ${ink}`, borderRadius: 14, overflow: 'hidden', background: '#fff', color: ink, minWidth: 0 }}>
        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: p.img ? '#f4f5f4' : TINTS[i % TINTS.length], display: 'grid', placeItems: 'center' }}>
          {data.mode === 'simple' && <Ic size={96} color={ink} strokeWidth={1.6} />}
          {p.img && <img src={`/media/${id}/${p.img}`} alt={p.scene} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: redo === i ? 0.35 : 1 }} />}
          {drawing && <Loader2 size={32} className="animate-spin" color={ink} style={{ position: 'absolute' }} />}
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ maxWidth: '82%', background: '#fff', border: `2.5px solid ${ink}`, borderRadius: 20, padding: '8px 14px', fontSize: 16, fontWeight: 700, lineHeight: 1.4, wordBreak: 'keep-all' }}>{p.bubble}</div>
          </div>
          {data.mode === 'ai' && p.img && (
            <button data-nosave="" onClick={() => onRedo(i)} disabled={redo !== null} aria-label={`${i + 1}번 칸 다시 그리기`} title="이 칸 다시 그리기"
              style={{ position: 'absolute', right: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, background: '#fff', border: `2px solid ${ink}`, display: 'grid', placeItems: 'center', opacity: redo !== null ? 0.4 : 1 }}>
              <RefreshCw size={15} color={ink} />
            </button>
          )}
        </div>
        <div style={{ borderTop: `3px solid ${ink}`, padding: '10px 14px', fontSize: 14, lineHeight: 1.6, display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fffbe6' }}>
          <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 11, background: ink, color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: '22px', textAlign: 'center', marginTop: 2 }}>{i + 1}</span>
          <span style={{ minWidth: 0, wordBreak: 'keep-all' }}>
            {p.caption}
            {p.ref != null && <button data-nosave="" onClick={() => onRef(p.ref!)} style={{ color: '#6663fd', fontSize: 12, marginLeft: 4, background: 'none', border: 0, padding: 0 }}>[{p.ref}]</button>}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-[13px]">
        {data.mode === 'simple' && <span className="text-muted">그림 모델 없이 만든 간단 버전{data.fallback_reason ? ' (그림 생성에 실패해 대체됨)' : ''}</span>}
        {prog && <span className="flex items-center gap-1.5 text-soft"><Loader2 size={14} className="animate-spin" />{prog}</span>}
        <button onClick={() => posterPng(poster.current!, 800, c.bg, `${name}-카툰.png`, prep)} className="ml-auto h-8 px-3 rounded-full bg-subtle hover:bg-line flex items-center gap-1.5"><Download size={14} />PNG 저장</button>
      </div>
      <div ref={poster} style={{ boxSizing: 'border-box', padding: 24, background: c.bg, color: c.fg, fontFamily: '"Pretendard Variable", Pretendard, sans-serif', border: `1px solid ${c.line}`, borderRadius: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.3, marginBottom: 20, wordBreak: 'keep-all' }}>{data.title}</div>
        <div data-grid="" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>{data.panels.map(panel)}</div>
      </div>
    </div>
  )
}
