import { useEffect, useRef } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import fontUrl from 'pretendard/dist/web/variable/woff2/PretendardVariable.woff2?url'
import { Download, Maximize2, Minus, Plus, RefreshCw, Scan } from 'lucide-react'

const tf = new Transformer()
let fontB64: string | undefined // 한 번 읽은 글꼴 캐시
const BRANCH = ['#6663fd', '#0e9f8e', '#e0702b', '#c8447a', '#2f8fd8', '#8a9a1f'] // 가지(## 섹션)별 색, 첫 색은 릴리스 보라
const LEVELS = [['short', '간단'], ['normal', '보통'], ['detailed', '자세히']] as const
export type Level = typeof LEVELS[number][0]
const TIME = /\[(\d+(?::\d{2})?)\]/g
const FONT = '400 13px/18px "Pretendard Variable",Pretendard,sans-serif'

// 마인드맵 박스: 상단 상세도 선택 + 회색 배경 + 하단 회색 바(다시 생성·다운로드·전체화면 / 확대·축소).
// [m:ss] 클릭 → onSeek, 노드 글 클릭 → onAsk(채팅 입력 채우기). 동그라미는 markmap 기본 접기.
export default function Mindmap({ md, busy, prog, level, setLevel, onRegen, name, onSeek, onAsk }: {
  md: string | null; busy: boolean; prog: number; level: Level; setLevel: (l: Level) => void; onRegen: () => void; name: string
  onSeek: (tok: string) => void; onAsk: (text: string) => void
}) {
  const box = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), mm = useRef<Markmap | null>(null), home = useRef<() => void>(undefined)
  useEffect(() => {
    if (!svg.current || !md) return
    svg.current.replaceChildren()
    const { root } = tf.transform(md.replace(TIME, '[$1](#t)')) // [m:ss] → 클릭 가능한 링크
    mm.current = Markmap.create(svg.current, {
      autoFit: false, initialExpandLevel: -1, duration: 250, maxWidth: 280, paddingX: 10, spacingHorizontal: 40, spacingVertical: 6,
      color: (n) => { const b = Number(String(n.state?.path ?? '1').split('.')[1]); return b ? BRANCH[(b - 1) % BRANCH.length] : '#111111' },
    }, root)
    // 처음엔 맞춤이 아니라 100%(글자 13px 그대로): 뿌리를 왼쪽 가운데에. 세로는 지도 전체의 중앙(지도가 박스보다 크면 위아래는 끌어서 이동, 글자 크기가 우선)
    const m = mm.current, s = svg.current
    home.current = () => {
      const z = (s as any).__zoom, r = s.getBoundingClientRect(), b = s.querySelector('g')!.getBoundingClientRect()
      const u = (b.left - r.left - z.x) / z.k, top = (b.top - r.top - z.y) / z.k, h = b.height / z.k
      const v = top + h / 2 - r.height / 2
      ;(m as any).svg.call((m as any).zoom.transform, new z.constructor(1, 16 - u, -v))
    }
    box.current?.scrollIntoView({ block: "start" }) // 상단 툴바 아래에 박스가 꽉 차게(하단 바까지 보이게)
    const t = setTimeout(() => home.current?.(), 450)
    return () => { clearTimeout(t); m.destroy(); mm.current = null }
  }, [md])

  const click = (e: React.MouseEvent) => {
    const t = e.target as Element, a = t.closest('a'), f = t.closest('foreignObject')
    if (a) { e.preventDefault(); onSeek(a.textContent ?? '') }
    else if (f) onAsk((f.textContent ?? '').replace(/\s*\[?\d+(:\d{2})?\]?$/, '').trim())
  }

  // SVG → canvas → PNG 저장. 웹폰트는 SVG 이미지 안으로 못 들어가므로 Pretendard를 base64로 SVG <style>에 직접 넣는다
  const download = async () => {
    const s = svg.current!, { width: w, height: h } = s.getBoundingClientRect()
    fontB64 ??= await fetch(fontUrl).then((r) => r.blob()).then((b) => new Promise<string>((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.readAsDataURL(b) }))
    await document.fonts.ready
    const c = s.cloneNode(true) as SVGSVGElement
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', String(w)); c.setAttribute('height', String(h))
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    st.textContent = `@font-face{font-family:"Pretendard Variable";font-weight:45 920;src:url(${fontB64}) format("woff2")}` +
      `svg,text,foreignObject,foreignObject *{font-family:"Pretendard Variable",sans-serif!important}text{fill:#222}foreignObject{color:#222}` +
      `strong{font-weight:700}a{color:#6663fd;text-decoration:none}a::before{content:"["}a::after{content:"]"}`
    c.prepend(st)
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c))
    await img.decode()
    const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2
    const x = cv.getContext('2d')!; x.fillStyle = '#ffffff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height)
    const a = document.createElement('a'); a.download = `${name}-마인드맵.png`; a.href = cv.toDataURL('image/png'); a.click()
  }

  const bar = 'flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#e4e4e1] text-[13px] text-[#666] hover:bg-[#d9d9d6] disabled:opacity-50'
  return (
    <div ref={box} className="relative scroll-mt-12 left-1/2 -translate-x-1/2 w-[calc(100cqw-32px)] max-w-[1800px] flex flex-col h-[calc(100vh-48px)] min-h-[560px] rounded-xl bg-[#f4f4f2] overflow-hidden fullscreen:w-screen fullscreen:max-w-none fullscreen:translate-x-0 fullscreen:left-0 fullscreen:h-screen fullscreen:rounded-none">
      <div className="h-11 shrink-0 flex items-center gap-2 px-2.5">
        <div className="flex rounded-md bg-[#e4e4e1] p-0.5">
          {LEVELS.map(([k, l]) => <button key={k} disabled={busy} onClick={() => setLevel(k)} className={`h-7 px-3 rounded text-[13px] disabled:opacity-60 ${level === k ? 'bg-white font-semibold text-[#222] shadow-sm' : 'text-[#666]'}`}>{l}</button>)}
        </div>
        {busy && <span className="text-[13px] text-[#666] truncate">만드는 중… 노드 {prog}개</span>}
      </div>
      {md ? <svg ref={svg} onClick={click} style={{ font: FONT, ['--markmap-font' as string]: FONT }} className="flex-1 min-h-0 w-full [&_text]:fill-[#222] [&_foreignObject]:text-[#222] [&_a]:text-[#6663fd] [&_a]:no-underline [&_a::before]:content-['['] [&_a::after]:content-[']'] [&_a]:cursor-pointer" />
        : <div className="flex-1 grid place-items-center text-center text-[14px] text-[#666] px-6">{busy ? `만드는 중… 노드 ${prog}개 (보통 1분 안팎)` : '이 상세도의 마인드맵이 아직 없어요. 아래 "생성"을 누르세요'}</div>}
      <div className="h-11 shrink-0 bg-[#e4e4e1]/70 flex items-center gap-2 px-2.5">
        <button className={bar} disabled={busy} onClick={onRegen}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />{md ? '다시 생성' : '생성'}</button>
        <button className={bar} disabled={!md} onClick={download}><Download size={14} />다운로드</button>
        <button className={bar} onClick={() => document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen()} title="전체화면"><Maximize2 size={14} /></button>
        <div className="ml-auto flex gap-1.5">
          <button className={bar} disabled={!md} onClick={() => mm.current?.fit()} title="전체 보기(맞춤)"><Scan size={14} />전체 보기</button>
          <button className={bar} disabled={!md} onClick={() => home.current?.()} title="글자 13px 실제 크기">100%</button>
          <button className={bar} onClick={() => mm.current?.rescale(1.25)} title="확대"><Plus size={14} /></button>
          <button className={bar} onClick={() => mm.current?.rescale(0.8)} title="축소"><Minus size={14} /></button>
        </div>
      </div>
    </div>
  )
}

export const getMindmap = (id: string, level: Level): Promise<string | null> =>
  fetch(`/api/notes/${id}/mindmap?level=${level}`).then((r) => r.json()).then((j) => j.markdown ?? null)
// 스트리밍 생성: 글자 조각이 오는 동안 노드 수(#·- 줄)를 알리고, 끝의 NUL 뒤가 최종 마크다운(ERR:면 실패)
export const makeMindmap = async (id: string, level: Level, onProg: (n: number) => void): Promise<string> => {
  const r = await fetch(`/api/notes/${id}/mindmap?level=${level}`, { method: 'POST' })
  if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).detail || '마인드맵을 만들지 못했어요')
  const rd = r.body.getReader(), dec = new TextDecoder()
  let acc = ''
  for (;;) {
    const { done, value } = await rd.read()
    if (done) break
    acc += dec.decode(value, { stream: true })
    onProg((acc.match(/^(#|-)/gm) ?? []).length)
  }
  const out = acc.split('\0')[1] ?? ''
  if (!out || out.startsWith('ERR:')) throw new Error(out.slice(4) || '마인드맵을 만들지 못했어요')
  return out
}
