// 인포그래픽: 서버가 준 JSON(layout·blocks)을 800px 세로 포스터로 그린다. 같은 JSON으로 레이아웃 5종 전환, PNG 2배 저장.
// 포스터는 인라인 스타일만 쓴다(PNG로 만들 때 외부 CSS가 SVG 안으로 못 들어가므로).
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Award, BookOpen, Brain, ChartColumn, CheckCircle, Clock, Coins, Download, Flag, Globe, Heart, Layers, Lightbulb, MessageCircle, Puzzle, Repeat, Rocket, Search, Settings, Shield, Smile, Sparkles, Star, Target, TrendingUp, TriangleAlert, Users, Wallet, Zap } from 'lucide-react'
import fontUrl from 'pretendard/dist/web/variable/woff2/PretendardVariable.woff2?url'

export type Layout = 'steps' | 'compare' | 'stats' | 'timeline' | 'cycle'
type Blk = { icon: string; heading: string; text: string; stat: string; ref: number | null }
export type Info = { title: string; subtitle: string; layout: Layout; blocks: Blk[]; takeaway: string }
const LAYOUTS: [Layout, string][] = [['steps', '단계'], ['compare', '비교'], ['stats', '수치'], ['timeline', '타임라인'], ['cycle', '순환']]
// 서버 templates.py ICONS 목록과 같은 이름(전체 lucide를 넣으면 번들이 커져서 고정 목록만)
export const ICONS = { lightbulb: Lightbulb, target: Target, rocket: Rocket, users: Users, clock: Clock, chart: ChartColumn, 'trending-up': TrendingUp, shield: Shield, heart: Heart, star: Star, book: BookOpen, brain: Brain, search: Search, settings: Settings, wallet: Wallet, zap: Zap, flag: Flag, 'check-circle': CheckCircle, 'alert-triangle': TriangleAlert, 'message-circle': MessageCircle, globe: Globe, layers: Layers, puzzle: Puzzle, repeat: Repeat, award: Award, coins: Coins, smile: Smile } as const
const W = 800
let fontB64: string | undefined // Mindmap.tsx와 같은 방식: 글꼴을 base64로 한 번만 읽어 캐시

export const pal = (dark: boolean) => dark
  ? { bg: '#111210', sub: '#1a1b18', fg: '#ecede6', soft: '#b9bba9', muted: '#8a8d7a', link: '#9b99ff', line: '#2a2b27' }
  : { bg: '#ffffff', sub: '#f4f5f4', fg: '#0c0d08', soft: '#434739', muted: '#9fa28e', link: '#6663fd', line: '#e4e4e7' }

// 포스터 요소 → PNG(2배) 저장. prep으로 복제본을 손본다(버튼 제거·이미지 인라인 등). Cartoon.tsx도 같이 쓴다.
export async function posterPng(el: HTMLElement, w: number, bg: string, file: string, prep?: (clone: HTMLElement) => Promise<void> | void) {
  fontB64 ??= await fetch(fontUrl).then((r) => r.blob()).then((b) => new Promise<string>((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.readAsDataURL(b) }))
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.cssText += `;transform:none;width:${w}px;position:fixed;left:-99999px;top:0`
  document.body.append(clone) // 화면 밖에 붙여 폭 w 기준 높이를 잰다
  await prep?.(clone)
  const h = clone.offsetHeight
  clone.remove(); clone.style.position = 'static'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>@font-face{font-family:"Pretendard Variable";font-weight:45 920;src:url(${fontB64}) format("woff2")}</style><foreignObject width="${w}" height="${h}">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2
  const g = cv.getContext('2d')!; g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height)
  const a = document.createElement('a'); a.download = file; a.href = cv.toDataURL('image/png'); a.click()
}

export default function Infographic({ data, name, onRef }: { data: Info; name: string; onRef: (n: number) => void }) {
  const [layout, setLayout] = useState<Layout>(data.layout)
  const dark = document.documentElement.classList.contains('dark')
  const poster = useRef<HTMLDivElement>(null), wrap = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ s: 1, h: 0 })
  // 좁은 화면에서는 포스터를 통째로 축소해 맞춘다
  useLayoutEffect(() => {
    const f = () => setFit({ s: Math.min(1, (wrap.current?.clientWidth ?? W) / W), h: poster.current?.offsetHeight ?? 0 })
    f(); const ro = new ResizeObserver(f); ro.observe(wrap.current!); ro.observe(poster.current!)
    return () => ro.disconnect()
  }, [layout, data])
  const c = pal(dark)

  const download = () => posterPng(poster.current!, W, c.bg, `${name}-인포그래픽.png`)

  const card = (b: Blk, i: number, num = true) => {
    const Ic = ICONS[b.icon as keyof typeof ICONS] ?? Sparkles
    return (
      <div style={{ background: c.sub, borderRadius: 20, padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', flex: 'none', width: 52, height: 52, borderRadius: 26, background: c.bg, border: `1px solid ${c.line}`, display: 'grid', placeItems: 'center' }}>
          <Ic size={24} color={c.fg} />
          {num && <span style={{ position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: 11, background: c.fg, color: c.bg, fontSize: 12, fontWeight: 700, lineHeight: '22px', textAlign: 'center' }}>{i + 1}</span>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {b.stat && <div style={{ fontSize: layout === 'stats' ? 44 : 26, fontWeight: 800, lineHeight: 1.15, color: c.link, wordBreak: 'keep-all', marginBottom: 4 }}>{b.stat}</div>}
          <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.4, color: c.fg, wordBreak: 'keep-all' }}>{b.heading}</div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: c.soft, marginTop: 6, wordBreak: 'keep-all' }}>
            {b.text}
            {b.ref != null && <button onClick={() => onRef(b.ref!)} style={{ color: c.link, fontSize: 12, marginLeft: 4, background: 'none', border: 0, padding: 0 }}>[{b.ref}]</button>}
          </div>
        </div>
      </div>
    )
  }
  const arrow = (down: boolean) => <div style={{ display: 'grid', placeItems: 'center', color: c.muted, height: down ? 32 : '100%' }}>{down ? <ArrowDown size={22} /> : <ArrowRight size={22} />}</div>
  const bs = data.blocks
  const pairs = Array.from({ length: Math.ceil(bs.length / 2) }, (_, k) => bs.slice(k * 2, k * 2 + 2))
  const body = layout === 'steps' ? (
    <div>{bs.map((b, i) => <div key={i}>{card(b, i)}{i < bs.length - 1 && arrow(true)}</div>)}</div>
  ) : layout === 'timeline' ? (
    <div style={{ position: 'relative', paddingLeft: 36 }}>
      <div style={{ position: 'absolute', left: 9, top: 12, bottom: 12, width: 2, background: c.line }} />
      {bs.map((b, i) => (
        <div key={i} style={{ position: 'relative', marginBottom: i < bs.length - 1 ? 16 : 0 }}>
          <div style={{ position: 'absolute', left: -36, top: 28, width: 20, height: 20, borderRadius: 10, background: c.fg, border: `4px solid ${c.bg}`, boxSizing: 'border-box' }} />
          {card(b, i)}
        </div>
      ))}
    </div>
  ) : layout === 'cycle' ? (
    <div>
      {pairs.map((p, k) => (
        <div key={k}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 1fr', alignItems: 'stretch' }}>
            <div>{card(p[0], k * 2)}</div>{p[1] ? arrow(false) : <div />}<div>{p[1] && card(p[1], k * 2 + 1)}</div>
          </div>
          {k < pairs.length - 1 && <div style={{ display: 'grid', placeItems: 'center', height: 32, color: c.muted }}><ArrowDown size={22} /></div>}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20, color: c.muted, fontSize: 14 }}><Repeat size={18} />마지막 단계 다음은 다시 1번으로 돌아갑니다</div>
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: bs.length === 3 && layout === 'compare' ? '1fr' : '1fr 1fr', gap: 16 }}>{bs.map((b, i) => <div key={i}>{card(b, i, layout !== 'compare')}</div>)}</div>
  )

  const btn = (on: boolean) => `h-8 px-3 rounded-full text-[13px] border ${on ? 'border-fg bg-subtle font-semibold' : 'border-line text-muted hover:bg-subtle'}`
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {LAYOUTS.map(([k, n]) => <button key={k} onClick={() => setLayout(k)} className={btn(k === layout)}>{n}</button>)}
        <button onClick={download} className="ml-auto h-8 px-3 rounded-full text-[13px] bg-subtle hover:bg-line flex items-center gap-1.5"><Download size={14} />PNG 저장</button>
      </div>
      <div ref={wrap} style={{ height: fit.h * fit.s || undefined, overflow: 'hidden' }}>
        <div ref={poster} style={{ width: W, boxSizing: 'border-box', padding: 48, background: c.bg, color: c.fg, fontFamily: '"Pretendard Variable", Pretendard, sans-serif', transform: `scale(${fit.s})`, transformOrigin: 'top left', border: `1px solid ${c.line}` }}>
          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.3, wordBreak: 'keep-all' }}>{data.title}</div>
          <div style={{ fontSize: 18, color: c.muted, marginTop: 8, marginBottom: 32, minHeight: 4, wordBreak: 'keep-all' }}>{data.subtitle}</div>
          {body}
          {data.takeaway && <div style={{ marginTop: 32, background: '#dfff32', color: '#0c0d08', borderRadius: 20, padding: '20px 28px', fontSize: 20, fontWeight: 700, lineHeight: 1.5, wordBreak: 'keep-all' }}>{data.takeaway}</div>}
        </div>
      </div>
    </div>
  )
}
