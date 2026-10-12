// 확장 탭: 만든 확장 리포트 목록(툴바 드롭다운)·본문 보기. 추가 창은 ExpandModal, 스타일 선택은 StylePicker, 카드·퀴즈는 ExpandCards.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe, Loader2, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { fmtTime, type Note } from '../api'
import { RichT } from './ReportExtras'
import { Flashcards, QuizView, type Card, type Quiz } from './ExpandCards'
import Infographic, { INFO_STYLES, Poster, SAMPLE, theme, type Info, type InfoStyle } from './Infographic'
import ExpandModal from './ExpandModal'
import StylePicker from './StylePicker'
import ReportFoot, { useFeedback } from './ReportFoot'
import Cartoon, { type Toon } from './Cartoon'
import { PptDeck, PptPicker, type Deck } from './Ppt'
import Backdrop from './Backdrop'

export type Tpls = { builtin: { key: string; name: string; cat: string; desc: string; kind: string }[]; custom: { key: string; name: string; prompt: string }[] }
type Src = { url: string; title: string }
type Blk = { heading: string; img?: string; illust?: string; table?: { cols: string[]; rows: string[][] }; bullets: { text: string; refs: number[]; src?: Src[] }[] }
type Ext = Partial<Omit<Info, 'blocks'>> & { kind: 'md' | 'flash' | 'quiz' | 'infographic' | 'cartoon' | 'ppt'; title: string; blocks?: any[]; cards?: Card[]; questions?: Quiz[]; noweb?: boolean }
type Opts = { style?: string; extra?: string; count?: number }

// 만들기 전에 스타일을 고르는 템플릿(릴리스: 인포그래픽·카툰)
const PICK = ['infographic', 'cartoon', 'ppt']
const WEB = ['background', 'counter', 'deep'] // 웹 조사 + 소제목 삽화
// 카툰 스타일 6종(릴리스 「만화 스타일 선택」 글자 그대로). 서버 cartoon.py STYLES와 같은 키
export const TOON_STYLES = [
  { key: 'webtoon', name: '웹툰', desc: '한국 웹툰' }, { key: 'realistic', name: '사실적', desc: '실사 만화' }, { key: 'anime', name: '일본 애니', desc: '일본 애니메이션' },
  { key: 'chibi', name: '치비', desc: '귀여운 SD 캐릭터' }, { key: 'disney', name: '디즈니', desc: '디즈니 애니메이션' }, { key: 'comicbook', name: '코믹북', desc: '미국 코믹북' },
]
// 리포트 아래 「💡 확장」 추천(릴리스 문구). 아직 안 만든 것 중 앞에서 3개
const SUGG = [['quote', '중요 인용구 한눈에 보기'], ['action', '바로 적용할 수 있는 액션 아이템 도출'], ['background', '관련 배경지식 심층 탐색'], ['deep', '자료를 바탕으로 추가 리서치 수행'], ['counter', '반대 시각으로 균형 있게 이해']]

const call = async <T,>(url: string, method = 'GET', body?: unknown): Promise<T> => {
  const r = await fetch(url, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || '요청을 처리하지 못했어요')
  return r.json()
}
const urlExt = () => new URLSearchParams(location.search).get('ext')

// 상태 한 곳에: 템플릿 목록·만든 결과·현재 선택('mindmap'이 기본, 주소 ?ext=로 유지)·만드는 중인 키·스타일 고르기 대기열
export function useExpand(id: string, on: boolean, onMindmap: () => void) {
  const [tpls, setTpls] = useState<Tpls>({ builtin: [], custom: [] })
  const [exts, setExts] = useState<Record<string, Ext>>({})
  const [cur, setCurRaw] = useState(() => urlExt() || 'mindmap')
  const [busy, setBusy] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(false)
  const [pick, setPick] = useState<string[]>([])
  const fb = useFeedback(id)
  const setCur = (k: string) => {
    setCurRaw(k)
    const u = new URL(location.href); if (k === 'mindmap') u.searchParams.delete('ext'); else u.searchParams.set('ext', k)
    history.replaceState(history.state, '', u)
  }
  const loadTpls = useCallback(() => { call<Tpls>('/api/templates').then(setTpls).catch(() => {}) }, [])
  const loadExts = useCallback(() => call<Record<string, Ext>>(`/api/notes/${id}/ext`).then(setExts).catch(() => {}), [id])
  useEffect(() => {
    if (!on) return
    loadTpls(); loadExts()
  }, [on, loadTpls, loadExts])
  // 카툰: 서버가 백그라운드로 만들고(POST), 진행·부분 결과를 2초마다 받아온다(GET)
  const [prog, setProg] = useState(''), [redo, setRedo] = useState<number | null>(null)
  const timer = useRef(0)
  useEffect(() => () => clearInterval(timer.current), [])
  const pollToon = () => {
    clearInterval(timer.current)
    timer.current = window.setInterval(async () => {
      const r = await call<{ job: { busy: boolean; msg: string; err: string | null } | null; result: Ext | null }>(`/api/notes/${id}/cartoon`).catch(() => null)
      if (!r) return
      if (r.result) setExts((e) => ({ ...e, cartoon: r.result! }))
      if (r.job?.busy) return setProg(r.job.msg)
      clearInterval(timer.current); setProg(''); setRedo(null); setBusy((b) => b.filter((x) => x !== 'cartoon'))
      if (r.job?.err) setErr(`카툰: ${r.job.err}`)
    }, 2000)
  }
  const makeToon = (panel?: number, o?: Opts) => {
    setBusy((b) => [...new Set([...b, 'cartoon'])]); setProg('콘티 만드는 중'); if (panel != null) setRedo(panel)
    call(`/api/notes/${id}/cartoon${panel != null ? `?panel=${panel}` : ''}`, 'POST', o).then(pollToon).catch((e) => { setErr(`카툰: ${e.message}`); setProg(''); setRedo(null); setBusy((b) => b.filter((x) => x !== 'cartoon')) })
  }
  useEffect(() => { // 새로고침했는데 서버가 아직 그리는 중이면 이어서 보여 준다
    if (on) call<{ job: { busy: boolean } | null }>(`/api/notes/${id}/cartoon`).then((r) => { if (r.job?.busy) { setBusy((b) => [...new Set([...b, 'cartoon'])]); pollToon() } }).catch(() => {})
  }, [on, id]) // eslint-disable-line react-hooks/exhaustive-deps
  // 소제목 삽화: 글이 먼저 오고 그림은 서버가 한 장씩 → 3초마다 결과를 다시 읽는다
  const illTimers = useRef<Record<string, number>>({})
  const [drawing, setDrawing] = useState<string[]>([])
  const pollIllust = useCallback((k: string) => {
    if (illTimers.current[k]) return
    const tick = async () => {
      const r = await call<{ job: { busy: boolean } | null }>(`/api/notes/${id}/ext/${k}/illust`).catch(() => null)
      await loadExts()
      if (r?.job?.busy) { setDrawing((d) => [...new Set([...d, k])]); illTimers.current[k] = window.setTimeout(tick, 3000) }
      else { delete illTimers.current[k]; setDrawing((d) => d.filter((x) => x !== k)) }
    }
    illTimers.current[k] = window.setTimeout(tick, 1500)
  }, [id, loadExts])
  useEffect(() => () => Object.values(illTimers.current).forEach(clearTimeout), [])
  const make = (k: string, o?: Opts) => {
    if (k === 'cartoon') return makeToon(undefined, o)
    setBusy((b) => [...b, k])
    call<Ext>(k === 'ppt' ? `/api/notes/${id}/ppt` : `/api/notes/${id}/ext/${k}`, 'POST', k === 'ppt' ? { style: 'minimal', count: 5, ...o } : o).then((x) => { setExts((e) => ({ ...e, [k]: x })); if (WEB.includes(k)) pollIllust(k) })
      .catch((e) => setErr(`${nameOf(k)}: ${e.message}`)).finally(() => setBusy((b) => b.filter((x) => x !== k)))
  }
  const nameOf = (k: string) => k === 'mindmap' ? '마인드맵' : tpls.builtin.find((t) => t.key === k)?.name ?? tpls.custom.find((t) => t.key === k)?.name ?? exts[k]?.title ?? k
  // 선택한 템플릿들: 스타일을 골라야 하는 것(인포그래픽·카툰)은 스타일 창을 차례로 띄우고, 나머지는 바로 동시에 생성
  const add = (keys: string[]) => {
    setModal(false); setErr(''); setCur(keys[0])
    keys.filter((k) => !PICK.includes(k)).forEach((k) => (k === 'mindmap' ? onMindmap() : make(k)))
    setPick(keys.filter((k) => PICK.includes(k)))
  }
  const picked = (k: string, o: Opts | null) => { setPick((p) => p.filter((x) => x !== k)); if (o) make(k, o) }
  const del = (k: string) => { call(`/api/notes/${id}/ext/${k}`, 'DELETE').then(() => { setExts((e) => { const { [k]: _, ...rest } = e; return rest }); setCur('mindmap') }) }
  const setExt = (k: string, x: Ext) => setExts((e) => ({ ...e, [k]: x }))
  return { setExt, tpls, exts, cur, setCur, busy, prog, redo, makeToon, err, modal, setModal, loadTpls, nameOf, add, make, del, pick, picked, drawing, pollIllust, fb }
}
export type Ex = ReturnType<typeof useExpand>

// 툴바 드롭다운: 마인드맵 + 만든 확장 리포트(새 것이 위) + "확장 리포트 추가"
export function ExpandMenu({ ex }: { ex: Ex }) {
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState<string | null>(null) // 「…」 메뉴(삭제)가 열린 항목
  const keys = ['mindmap', ...new Set([...ex.busy.filter((k) => !ex.exts[k]), ...Object.keys(ex.exts).reverse()])]
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label={`확장 리포트 목록: ${ex.nameOf(ex.cur)}`} className="flex items-center gap-1 h-9 px-2 text-[15px] max-w-[130px]"><span className="truncate">{ex.nameOf(ex.cur)}</span><ChevronDown size={16} className="shrink-0" /></button>
      {open && (
        <>
          <Backdrop z="z-10" onClose={() => setOpen(false)} />
          <div className="absolute z-20 top-10 left-0 w-[200px] rounded-xl border border-line bg-bg p-1.5 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
            {keys.map((k) => (
              <div key={k} className="relative group">
                <button onClick={() => { setOpen(false); ex.setCur(k) }} className={`flex items-center gap-2 w-full h-9 pl-3 pr-9 rounded-lg text-[15px] ${k === ex.cur ? 'bg-subtle' : 'hover:bg-subtle'}`}>
                  <span className="truncate flex-1 text-left">{ex.nameOf(k)}</span>
                  {ex.busy.includes(k) ? <Loader2 size={14} className="animate-spin shrink-0" /> : k === ex.cur && <Check size={15} className="shrink-0" />}
                </button>
                {k !== 'mindmap' && ex.exts[k] && <button aria-label={`${ex.nameOf(k)} 더보기`} onClick={() => setMore(more === k ? null : k)} className="absolute right-1 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md text-muted hover:bg-line"><MoreHorizontal size={15} /></button>}
                {more === k && <button onClick={() => { setMore(null); setOpen(false); ex.del(k) }} className="absolute right-0 top-8 z-30 flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line bg-bg text-[14px] text-red-500 shadow-[0_4px_16px_rgba(0,0,0,.08)] hover:bg-subtle"><Trash2 size={14} />삭제</button>}
              </div>
            ))}
            <div className="my-1 border-t border-line" />
            <button onClick={() => { setOpen(false); ex.setModal(true) }} className="flex items-center gap-2 w-full h-9 px-3 rounded-lg text-[15px] hover:bg-subtle"><Plus size={15} />확장 리포트 추가</button>
          </div>
        </>
      )}
    </div>
  )
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
// 결과 → Markdown(복사·다운로드용)
const toMd = (x: Ext) => {
  const out = [`# ${x.title}`]
  if (x.kind === 'md') for (const b of x.blocks as Blk[]) {
    out.push('', `## ${b.heading}`)
    if (b.table) out.push('', `| ${b.table.cols.join(' | ')} |`, `|${b.table.cols.map(() => '---').join('|')}|`, ...b.table.rows.map((r) => `| ${r.join(' | ')} |`), '')
    for (const t of b.bullets) out.push(`- ${t.text}${(t.src ?? []).map((s) => ` [${host(s.url)}](${s.url})`).join('')}`) }
  else if (x.kind === 'flash') x.cards!.forEach((c, i) => out.push('', `${i + 1}. ${c.q}`, `   - ${c.a}`))
  else if (x.kind === 'quiz') x.questions!.forEach((q, i) => out.push('', `${i + 1}. ${q.q}`, ...q.choices.map((c, j) => `   ${j === q.answer ? '✔' : '-'} ${c}`)))
  else if (x.kind === 'infographic') { out.push('', x.subtitle ?? ''); for (const b of (x.blocks ?? []) as { heading: string; text: string }[]) out.push(`- **${b.heading}** ${b.text}`); if (x.takeaway) out.push('', `> ${x.takeaway}`) }
  else if (x.kind === 'cartoon') for (const p of ((x as unknown as Toon).panels ?? [])) out.push(`- ${p.bubble} — ${p.caption}`)
  return out.join('\n')
}

// 본문: 마인드맵은 Note가 넘긴 children, 나머지는 결과(마크다운 계열·카드·퀴즈). 추가 창·스타일 창도 여기서 연다.
export function ExpandBody({ ex, note, seek, hasMindmap, children }: { ex: Ex; note: Note; seek: (t: number) => void; hasMindmap: boolean; children: React.ReactNode }) {
  const x = ex.exts[ex.cur]
  const { pollIllust } = ex
  useEffect(() => { // 그림이 덜 채워진 웹 리포트를 열면 이어서 확인
    if (x && WEB.includes(ex.cur) && (x.blocks as Blk[] | undefined)?.some((b) => b.illust && !b.img)) pollIllust(ex.cur)
  }, [x, ex.cur, pollIllust])
  const refs = (rs: number[]) => rs.map((n) => {
    const t = note.transcript[n]?.start
    return t == null ? null : <button key={n} onClick={() => seek(t)} className="text-link text-[12px] align-baseline mx-0.5 hover:underline" title={note.kind === 'article' ? `문단 ${n}` : fmtTime(t)}>[{n}]</button>
  })
  const seen = new Set<string>()
  const made = new Set([...Object.keys(ex.exts), ...(hasMindmap ? ['mindmap'] : [])])
  const sugg = SUGG.filter(([k]) => !made.has(k) && !ex.busy.includes(k)).slice(0, 3).map(([key, label]) => ({ key, label }))
  const style = (x as { style?: string } | undefined)?.style
  const foot = x && <ReportFoot id={note.id} fkey={ex.cur} fb={ex.fb.fb} onFb={ex.fb.set} busy={ex.busy.includes(ex.cur)} onRedo={() => ex.make(ex.cur, x.kind === 'ppt' ? { style, count: (x as unknown as Deck).slides.length } : style ? { style } : undefined)}
    text={() => toMd(x)} file={`${note.title}-${ex.nameOf(ex.cur)}.md`} sugg={sugg} onSugg={(k) => ex.add([k])} collectionId={note.collection_id} />
  const pk = ex.pick[0]
  const dark = document.documentElement.classList.contains('dark')
  return (
    <>
      {ex.modal && <ExpandModal tpls={ex.tpls} made={made} youtube={note.kind === 'video'} article={note.kind === 'article'} onClose={() => ex.setModal(false)} onAdd={ex.add} onChanged={ex.loadTpls} />}
      {pk === 'infographic' && <StylePicker key={pk} title="인포그래픽 스타일 선택" sub="만들기를 누르면, 현재 자료들을 멋진 인포그래픽으로 바꿔드려요!" opts={INFO_STYLES}
        preview={(s) => <div className="origin-top-left scale-[0.6] w-[800px] pointer-events-none"><Poster data={{ ...SAMPLE, style: s as InfoStyle }} layout="steps" t={theme(s as InfoStyle, dark)} /></div>}
        onClose={() => ex.picked(pk, null)} onMake={(o) => ex.picked(pk, o)} />}
      {pk === 'cartoon' && <StylePicker key={pk} title="만화 스타일 선택" sub="만들기를 누르면, 현재 자료들을 재미있는 만화로 바꿔드려요!" opts={TOON_STYLES}
        preview={(s) => <img src={`/styles/cartoon-${s}.jpg`} alt={`${TOON_STYLES.find((t) => t.key === s)?.name} 견본`} className="w-full h-full object-cover" />}
        onClose={() => ex.picked(pk, null)} onMake={(o) => ex.picked(pk, o)} />}
      {pk === 'ppt' && <PptPicker key={pk} id={note.id} onClose={() => ex.picked(pk, null)} onMake={(o) => ex.picked(pk, o)} />}
      {ex.err && <p className="mt-4 text-[14px] text-muted">{ex.err}</p>}
      {ex.cur === 'mindmap' ? children : !x ? (
        <div className="pt-24 flex items-center gap-3 text-[16px]">
          {ex.busy.includes(ex.cur) ? <><Loader2 size={18} className="animate-spin" />{ex.nameOf(ex.cur)}을(를) 만드는 중이에요 ({ex.cur === 'cartoon' ? ex.prog || '준비 중' : WEB.includes(ex.cur) ? '웹 조사 포함 1~3분' : '30~60초'})</>
            : ex.pick.includes(ex.cur) ? <>스타일을 고르면 만들어요</>
            : <>아직 만들지 않았어요 <button onClick={() => ex.add([ex.cur])} className="underline">만들기</button></>}
        </div>
      ) : (
        x.kind === 'ppt' ? <div className="mt-[88px]"><PptDeck id={note.id} deck={x as unknown as Deck} onRevised={(d) => ex.setExt('ppt', d as unknown as Ext)} />{foot}</div> :
        x.kind === 'cartoon' ? <div className="mt-[88px]"><Cartoon id={note.id} data={x as unknown as Toon} name={note.title} prog={ex.prog} redo={ex.redo} onRedo={(i) => ex.makeToon(i)} onRef={(n) => { const t = note.transcript[n]?.start; if (t != null) seek(t) }} />{foot}</div> :
        x.kind === 'infographic' ? <div className="mt-[88px]"><Infographic key={ex.cur + (style ?? '')} data={x as unknown as Info} name={note.title} onRef={(n) => { const t = note.transcript[n]?.start; if (t != null) seek(t) }} />{foot}</div> : <>
          <h1 className="text-[32px] font-bold leading-[1.35] mt-[88px] mb-10 break-keep">{x.title}</h1>
          <p className="-mt-6 mb-8 text-[13px] text-muted">{ex.nameOf(ex.cur)}{ex.drawing.includes(ex.cur) && ' · 삽화 그리는 중'}</p>
          {x.noweb && <p data-noweb="" className="-mt-4 mb-8 text-[13px] text-muted">웹 검색 없이 만들었어요 (인터넷 연결이나 검색 한도를 확인해 주세요)</p>}
          {x.kind === 'flash' && <Flashcards key={ex.cur} cards={x.cards!} refs={refs} />}
          {x.kind === 'quiz' && <QuizView key={ex.cur} qs={x.questions!} refs={refs} />}
          {x.kind === 'md' && (x.blocks as Blk[]).map((b, i) => (
            <div key={i} className="mb-10">
              <h2 className="text-[20px] font-bold mb-4">{b.heading}</h2>
              {b.img && <img data-illust="" src={`/media/${note.id}/${b.img}`} alt={b.heading} className="mb-5 w-full aspect-[4/3] object-cover rounded-xl bg-subtle" />}
              {b.table && <div className="mb-5 overflow-x-auto rounded-xl border border-line">
                <table data-table="" className="w-full text-[14px] leading-[1.6] border-collapse">
                  <thead className="bg-subtle"><tr>{b.table.cols.map((c, k) => <th key={k} className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-line">{c}</th>)}</tr></thead>
                  <tbody>{b.table.rows.map((r, k) => <tr key={k} className="border-b border-line last:border-0">{r.map((c, m) => <td key={m} className="px-3 py-2 align-top break-keep">{c}</td>)}</tr>)}</tbody>
                </table>
              </div>}
              <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.7] marker:text-muted">
                {b.bullets.map((t, j) => <li key={j}><RichT text={t.text} terms={[]} seen={seen} />{refs(t.refs)}
                  {t.src?.map((s) => <a key={s.url} data-src="" href={s.url} target="_blank" rel="noreferrer noopener" title={s.title || s.url}
                    className="inline-flex items-center gap-1 align-middle ml-1.5 h-[22px] px-2 rounded-full bg-subtle text-[12px] text-muted hover:text-fg no-underline"><Globe size={11} />{host(s.url)}</a>)}</li>)}
              </ul>
            </div>
          ))}
          {foot}
        </>
      )}
    </>
  )
}
