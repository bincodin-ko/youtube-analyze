// 인포그래픽: 서버가 준 JSON(layout·blocks·style)을 800px 세로 포스터로 그린다. 같은 JSON으로 레이아웃 5종 전환, PNG 2배 저장.
// 스타일 6종(릴리스 「인포그래픽 스타일 선택」과 같은 이름)은 THEMES로 색·글꼴·모양만 바꾼다(글자는 HTML이라 한글이 깨지지 않음).
// 포스터는 인라인 스타일만 쓴다(PNG로 만들 때 외부 CSS가 SVG 안으로 못 들어가므로).
import { useLayoutEffect, useRef, useState, type Ref } from 'react'
import { ArrowDown, ArrowRight, Award, BookOpen, Brain, ChartColumn, CheckCircle, Clock, Coins, Download, Flag, Globe, Heart, Layers, Lightbulb, MessageCircle, Puzzle, Repeat, Rocket, Search, Settings, Shield, Smile, Sparkles, Star, Target, TrendingUp, TriangleAlert, Users, Wallet, Zap } from 'lucide-react'
import fontUrl from 'pretendard/dist/web/variable/woff2/PretendardVariable.woff2?url'
import '@fontsource/gaegu/400.css'
import '@fontsource/gaegu/700.css'

export type Layout = 'steps' | 'compare' | 'stats' | 'timeline' | 'cycle'
type Blk = { icon: string; heading: string; text: string; stat: string; ref: number | null }
export type InfoStyle = 'onepager' | 'colorful' | 'scientific' | 'handwriting' | 'minimal' | 'corporate'
export type Info = { title: string; subtitle: string; layout: Layout; blocks: Blk[]; takeaway: string; style?: InfoStyle }
const LAYOUTS: [Layout, string][] = [['steps', '단계'], ['compare', '비교'], ['stats', '수치'], ['timeline', '타임라인'], ['cycle', '순환']]
// 서버 templates.py INFO_STYLES와 같은 키. 이름·설명은 릴리스 화면 글자 그대로
export const INFO_STYLES: { key: InfoStyle; name: string; desc: string }[] = [
  { key: 'onepager', name: '원페이저', desc: '한 페이지 요약' }, { key: 'colorful', name: '컬러풀', desc: '창의적/밝은' }, { key: 'scientific', name: '과학적', desc: '학술적/데이터 중심' },
  { key: 'handwriting', name: '손글씨', desc: '스케치/손그림' }, { key: 'minimal', name: '미니멀', desc: '심플/깔끔' }, { key: 'corporate', name: '기업용', desc: '전문적/공식적' },
]
// 서버 templates.py ICONS 목록과 같은 이름(전체 lucide를 넣으면 번들이 커져서 고정 목록만)
export const ICONS = { lightbulb: Lightbulb, target: Target, rocket: Rocket, users: Users, clock: Clock, chart: ChartColumn, 'trending-up': TrendingUp, shield: Shield, heart: Heart, star: Star, book: BookOpen, brain: Brain, search: Search, settings: Settings, wallet: Wallet, zap: Zap, flag: Flag, 'check-circle': CheckCircle, 'alert-triangle': TriangleAlert, 'message-circle': MessageCircle, globe: Globe, layers: Layers, puzzle: Puzzle, repeat: Repeat, award: Award, coins: Coins, smile: Smile } as const
const W = 800
const PRET = '"Pretendard Variable", Pretendard, sans-serif'
let fontB64: string | undefined // Mindmap.tsx와 같은 방식: 글꼴을 base64로 한 번만 읽어 캐시

export const pal = (dark: boolean) => dark
  ? { bg: '#111210', sub: '#1a1b18', fg: '#ecede6', soft: '#b9bba9', muted: '#8a8d7a', link: '#9b99ff', line: '#2a2b27' }
  : { bg: '#ffffff', sub: '#f4f5f4', fg: '#0c0d08', soft: '#434739', muted: '#9fa28e', link: '#6663fd', line: '#e4e4e7' }

type Theme = {
  bg: string; card: string; fg: string; soft: string; muted: string; accent: string; line: string; font: string; radius: number; border: string
  num: string; numFg: string; takeBg: string; takeFg: string; takeBorder?: string; tints?: string[]; head?: { bg: string; fg: string; sub: string }; tilt?: boolean; fig?: boolean
}
export const theme = (s: InfoStyle | undefined, dark: boolean): Theme => {
  const c = pal(dark)
  const base: Theme = { bg: c.bg, card: c.sub, fg: c.fg, soft: c.soft, muted: c.muted, accent: c.link, line: c.line, font: PRET, radius: 20, border: 'none', num: c.fg, numFg: c.bg, takeBg: '#dfff32', takeFg: '#0c0d08' }
  switch (s) {
    case 'colorful': return { ...base, bg: '#fffdf7', card: '#fff', fg: '#1b1b3a', soft: '#45456a', muted: '#8a8aa8', accent: '#ff5a5f', line: '#f0e6d8', radius: 24, num: '#ff5a5f', numFg: '#fff', takeBg: '#1b1b3a', takeFg: '#fff', tints: ['#ffe1e1', '#fff0c2', '#d9f5e3', '#dbeaff', '#ece1ff', '#ffe6d1'] }
    case 'scientific': return { ...base, bg: '#fbfbf8', card: '#ffffff', fg: '#14213d', soft: '#3d4a63', muted: '#7a8499', accent: '#1f4e8c', line: '#c9ccd3', radius: 4, border: '1px solid #c9ccd3', num: '#1f4e8c', numFg: '#fff', takeBg: '#eef3fb', takeFg: '#14213d', takeBorder: '6px solid #1f4e8c', fig: true }
    case 'handwriting': return { ...base, bg: '#fffaf0', card: '#fff', fg: '#2b2b2b', soft: '#4a4a4a', muted: '#8c8170', accent: '#e8590c', line: '#3a3a3a', font: `Gaegu, ${PRET}`, radius: 18, border: '2px dashed #3a3a3a', num: '#2b2b2b', numFg: '#fffaf0', takeBg: '#fff3a8', takeFg: '#2b2b2b', tints: ['#ffe8d6', '#e3f2fd', '#e8f5e9', '#fce4ec', '#fff9c4', '#ede7f6'], tilt: true }
    case 'minimal': return { ...base, bg: '#ffffff', card: 'transparent', fg: '#111111', soft: '#555555', muted: '#999999', accent: '#111111', line: '#e5e5e5', radius: 0, border: 'none', num: '#111111', numFg: '#ffffff', takeBg: 'transparent', takeFg: '#111111', takeBorder: '2px solid #111111' }
    case 'corporate': return { ...base, bg: '#f4f6fa', card: '#ffffff', fg: '#0b2545', soft: '#3c4f6b', muted: '#7d8ba1', accent: '#13315c', line: '#d6dce8', radius: 8, border: '1px solid #d6dce8', num: '#13315c', numFg: '#fff', takeBg: '#13315c', takeFg: '#ffffff', head: { bg: '#0b2545', fg: '#ffffff', sub: '#a9bcd6' } }
    default: return base // onepager = 원래 모양(다크 모드도 따름)
  }
}

const b64 = (blob: Blob) => new Promise<string>((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.readAsDataURL(blob) })
// 손글씨(Gaegu) 같은 추가 웹폰트: 포스터에 쓰인 글자가 든 조각(unicode-range)만 base64로 넣는다
async function extraFonts(text: string): Promise<string> {
  const used = new Set([...text].map((ch) => ch.codePointAt(0)!))
  const out: string[] = []
  for (const sh of [...document.styleSheets]) {
    let rules: CSSRuleList; try { rules = sh.cssRules } catch { continue }
    for (const r of [...rules]) {
      if (!(r instanceof CSSFontFaceRule) || !r.style.getPropertyValue('font-family').includes('Gaegu')) continue
      const range = r.style.getPropertyValue('unicode-range')
      const hit = !range || range.split(',').some((p) => {
        const [a, b] = p.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16))
        for (const u of used) if (u >= a && u <= (b ?? a)) return true
        return false
      })
      const url = r.style.getPropertyValue('src').match(/url\("?([^")]+\.woff2)"?\)/)?.[1]
      if (!hit || !url) continue
      const data = await fetch(new URL(url, sh.href ?? location.href)).then((x) => x.blob()).then(b64)
      out.push(`@font-face{font-family:"Gaegu";font-weight:${r.style.getPropertyValue('font-weight')};src:url(${data}) format("woff2")}`)
    }
  }
  return out.join('')
}

// 포스터 요소 → PNG(2배) 저장. prep으로 복제본을 손본다(버튼 제거·이미지 인라인 등). Cartoon.tsx도 같이 쓴다.
export async function posterPng(el: HTMLElement, w: number, bg: string, file: string, prep?: (clone: HTMLElement) => Promise<void> | void) {
  fontB64 ??= await fetch(fontUrl).then((r) => r.blob()).then(b64)
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.cssText += `;transform:none;width:${w}px;position:fixed;left:-99999px;top:0`
  document.body.append(clone) // 화면 밖에 붙여 폭 w 기준 높이를 잰다
  await prep?.(clone)
  const h = clone.offsetHeight
  clone.remove(); clone.style.position = 'static'
  const more = getComputedStyle(el).fontFamily.includes('Gaegu') ? await extraFonts(el.textContent ?? '') : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>@font-face{font-family:"Pretendard Variable";font-weight:45 920;src:url(${fontB64}) format("woff2")}${more}</style><foreignObject width="${w}" height="${h}">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2
  const g = cv.getContext('2d')!; g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height)
  const a = document.createElement('a'); a.download = file; a.href = cv.toDataURL('image/png'); a.click()
}

// 스타일 선택 창 미리보기용 견본(릴리스는 고정 그림, 우리는 실제 포스터를 작게 그림)
export const SAMPLE: Info = {
  title: '좋은 습관을 만드는 3단계', subtitle: '작게 시작해서 꾸준히 이어가기', layout: 'steps', takeaway: '완벽함보다 반복이 습관을 만든다',
  blocks: [
    { icon: 'target', heading: '목표를 아주 작게', text: '하루 2분이면 끝나는 행동부터 시작합니다.', stat: '2분', ref: null },
    { icon: 'clock', heading: '같은 시간에', text: '이미 하는 일 바로 뒤에 붙여 둡니다.', stat: '', ref: null },
    { icon: 'check-circle', heading: '기록하기', text: '달력에 표시하면 끊기지 않습니다.', stat: '66일', ref: null },
  ],
}

// 포스터 본체(Infographic과 스타일 선택 미리보기가 같이 씀)
export function Poster({ data, layout, t, onRef, innerRef }: { data: Info; layout: Layout; t: Theme; onRef?: (n: number) => void; innerRef?: Ref<HTMLDivElement> }) {
  const card = (b: Blk, i: number, num = true) => {
    const Ic = ICONS[b.icon as keyof typeof ICONS] ?? Sparkles
    const bg = t.tints ? t.tints[i % t.tints.length] : t.card
    return (
      <div data-card="" style={{ background: bg, border: t.border, borderRadius: t.radius, padding: t.card === 'transparent' ? '20px 0' : 24, borderTop: t.card === 'transparent' ? `1px solid ${t.line}` : undefined, display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 0, height: '100%', boxSizing: 'border-box', transform: t.tilt ? `rotate(${i % 2 ? 0.6 : -0.6}deg)` : undefined }}>
        <div style={{ position: 'relative', flex: 'none', width: 52, height: 52, borderRadius: t.radius ? 26 : 0, background: t.tints ? '#ffffffaa' : t.bg, border: t.tilt ? '2px solid #3a3a3a' : `1px solid ${t.line}`, display: 'grid', placeItems: 'center' }}>
          <Ic size={24} color={t.accent === '#111111' ? t.fg : t.accent} />
          {num && <span style={{ position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: t.radius ? 11 : 0, background: t.num, color: t.numFg, fontSize: 12, fontWeight: 700, lineHeight: '22px', textAlign: 'center', fontFamily: PRET }}>{i + 1}</span>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {t.fig && <div style={{ fontSize: 11, letterSpacing: 1.5, color: t.muted, fontWeight: 700, marginBottom: 4 }}>FIG. {i + 1}</div>}
          {b.stat && <div style={{ fontSize: layout === 'stats' ? 44 : 26, fontWeight: 800, lineHeight: 1.15, color: t.accent, wordBreak: 'keep-all', marginBottom: 4 }}>{b.stat}</div>}
          <div style={{ fontSize: t.tilt ? 24 : 19, fontWeight: 700, lineHeight: 1.4, color: t.fg, wordBreak: 'keep-all' }}>{b.heading}</div>
          <div style={{ fontSize: t.tilt ? 19 : 15, lineHeight: 1.65, color: t.soft, marginTop: 6, wordBreak: 'keep-all' }}>
            {b.text}
            {b.ref != null && onRef && <button onClick={() => onRef(b.ref!)} style={{ color: t.accent, fontSize: 12, marginLeft: 4, background: 'none', border: 0, padding: 0, fontFamily: PRET }}>[{b.ref}]</button>}
          </div>
        </div>
      </div>
    )
  }
  const arrow = (down: boolean) => <div style={{ display: 'grid', placeItems: 'center', color: t.muted, height: down ? 32 : '100%' }}>{down ? <ArrowDown size={22} /> : <ArrowRight size={22} />}</div>
  const bs = data.blocks
  const pairs = Array.from({ length: Math.ceil(bs.length / 2) }, (_, k) => bs.slice(k * 2, k * 2 + 2))
  const body = layout === 'steps' ? (
    <div>{bs.map((b, i) => <div key={i}>{card(b, i)}{i < bs.length - 1 && arrow(true)}</div>)}</div>
  ) : layout === 'timeline' ? (
    <div style={{ position: 'relative', paddingLeft: 36 }}>
      <div style={{ position: 'absolute', left: 9, top: 12, bottom: 12, width: 2, background: t.line }} />
      {bs.map((b, i) => (
        <div key={i} style={{ position: 'relative', marginBottom: i < bs.length - 1 ? 16 : 0 }}>
          <div style={{ position: 'absolute', left: -36, top: 28, width: 20, height: 20, borderRadius: 10, background: t.num, border: `4px solid ${t.bg}`, boxSizing: 'border-box' }} />
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
          {k < pairs.length - 1 && <div style={{ display: 'grid', placeItems: 'center', height: 32, color: t.muted }}><ArrowDown size={22} /></div>}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20, color: t.muted, fontSize: 14 }}><Repeat size={18} />마지막 단계 다음은 다시 1번으로 돌아갑니다</div>
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: bs.length === 3 && layout === 'compare' ? '1fr' : '1fr 1fr', gap: 16 }}>{bs.map((b, i) => <div key={i}>{card(b, i, layout !== 'compare')}</div>)}</div>
  )
  const h = t.head
  return (
    <div ref={innerRef} data-style={data.style ?? 'onepager'} style={{ width: W, boxSizing: 'border-box', padding: 48, paddingTop: h ? 0 : 48, background: t.bg, color: t.fg, fontFamily: t.font, border: `1px solid ${t.line}` }}>
      <div style={h ? { background: h.bg, color: h.fg, margin: '0 -48px 32px', padding: '44px 48px 36px' } : { marginBottom: 32, borderBottom: t.fig ? `2px solid ${t.fg}` : undefined, paddingBottom: t.fig ? 16 : 0 }}>
        <div style={{ fontSize: t.tilt ? 46 : 38, fontWeight: 800, lineHeight: 1.3, wordBreak: 'keep-all', textAlign: t.tilt ? 'center' : undefined }}>{data.title}</div>
        <div style={{ fontSize: t.tilt ? 22 : 18, color: h ? h.sub : t.muted, marginTop: 8, minHeight: 4, wordBreak: 'keep-all', textAlign: t.tilt ? 'center' : undefined }}>{data.subtitle}</div>
      </div>
      {body}
      {data.takeaway && <div style={{ marginTop: 32, background: t.takeBg, color: t.takeFg, border: t.takeBorder && !t.fig ? t.takeBorder : undefined, borderLeft: t.fig ? t.takeBorder : undefined, borderRadius: t.radius, padding: '20px 28px', fontSize: t.tilt ? 24 : 20, fontWeight: 700, lineHeight: 1.5, wordBreak: 'keep-all' }}>{data.takeaway}</div>}
    </div>
  )
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
  const t = theme(data.style, dark)
  const download = () => posterPng(poster.current!, W, t.bg, `${name}-인포그래픽.png`)

  const btn = (on: boolean) => `h-8 px-3 rounded-full text-[13px] border ${on ? 'border-fg bg-subtle font-semibold' : 'border-line text-muted hover:bg-subtle'}`
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {LAYOUTS.map(([k, n]) => <button key={k} onClick={() => setLayout(k)} className={btn(k === layout)}>{n}</button>)}
        <span className="text-[13px] text-muted ml-1">{INFO_STYLES.find((s) => s.key === (data.style ?? 'onepager'))?.name}</span>
        <button onClick={download} className="ml-auto h-8 px-3 rounded-full text-[13px] bg-subtle hover:bg-line flex items-center gap-1.5"><Download size={14} />PNG 저장</button>
      </div>
      <div ref={wrap} style={{ height: fit.h * fit.s || undefined, overflow: 'hidden' }}>
        <div style={{ transform: `scale(${fit.s})`, transformOrigin: 'top left', width: W }}>
          <Poster data={data} layout={layout} t={t} onRef={onRef} innerRef={poster} />
        </div>
      </div>
    </div>
  )
}
