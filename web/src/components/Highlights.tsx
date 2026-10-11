import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Highlighter, MessageSquare, StickyNote, Trash2 } from 'lucide-react'
import Sidebar, { MobileBar } from './Sidebar'

export type Hl = { id: string; text: string; section: string; memo: string; created_at: string }

async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || '요청을 처리하지 못했어요')
  return r.json()
}

// ---- 리포트 본문(data-report) 안에서 글자를 찾아 Range로 ----
// 공백을 빼고 비교해서, 여러 줄·여러 요소에 걸친 선택도 같은 글로 찾는다
function findRange(root: Element, text: string): Range | null {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let flat = ''
  const map: [Text, number][] = []
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null)
    for (let i = 0; i < n.data.length; i++) if (!/\s/.test(n.data[i])) { flat += n.data[i]; map.push([n, i]) }
  const key = text.replace(/\s+/g, '')
  const at = key ? flat.indexOf(key) : -1
  if (at < 0) return null
  const r = document.createRange()
  r.setStart(...map[at])
  const [en, eo] = map[at + key.length - 1]
  r.setEnd(en, eo + 1)
  return r
}
const reportRoot = () => document.querySelector('[data-report]')
function scrollToHl(text: string) {
  const root = reportRoot(), r = root && findRange(root, text)
  r?.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// ---- 노트 화면용 묶음: 목록·오른쪽 탭·채팅 인용 ----
export function useReportNotes(nid: string, openRight: () => void) {
  const [list, setList] = useState<Hl[]>([])
  const [rtab, setRtab] = useState<'chat' | 'hl'>('chat')
  const [quote, setQuote] = useState<{ text: string; k: number } | null>(null)
  const [focusId, setFocusId] = useState('')
  useEffect(() => { api<Hl[]>(`/api/notes/${nid}/highlights`).then(setList).catch(() => setList([])) }, [nid])
  const edit = (id: string, memo: string) => {
    setList((l) => l.map((h) => (h.id === id ? { ...h, memo } : h)))
    api(`/api/notes/${nid}/highlights/${id}`, 'PUT', { memo }).catch(() => {})
  }
  const del = (id: string) => {
    setList((l) => l.filter((h) => h.id !== id))
    api(`/api/notes/${nid}/highlights/${id}`, 'DELETE').catch(() => {})
  }
  const pick = async (kind: 'hl' | 'memo' | 'ask', text: string, section: string) => {
    getSelection()?.removeAllRanges()
    if (kind === 'ask') { setQuote({ text, k: Date.now() }); setRtab('chat'); openRight(); return }
    const same = list.find((h) => h.text === text)
    const h = same ?? await api<Hl>(`/api/notes/${nid}/highlights`, 'POST', { text, section })
    if (!same) setList((l) => [...l, h])
    if (kind === 'memo') { setFocusId(h.id); setRtab('hl'); openRight() }
  }
  return { list, rtab, setRtab, quote, focusId, edit, del, pick }
}

// ---- 본문 위에 노란 배경 칠하기(CSS Custom Highlight: 글자 DOM은 건드리지 않음) ----
export function HighlightLayer({ list, dep }: { list: Hl[]; dep: string }) {
  const [sp] = useSearchParams()
  const jumped = useRef(false)
  useEffect(() => {
    const root = reportRoot()
    const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const HL = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
    if (!root || !reg || !HL) return
    let timer = 0
    const paint = () => {
      const plain: Range[] = [], memo: Range[] = []
      for (const h of list) { const r = findRange(root, h.text); if (r) (h.memo ? memo : plain).push(r) }
      reg.set('vn-hl', new HL(...plain)); reg.set('vn-memo', new HL(...memo))
    }
    paint()
    const want = sp.get('h'), hit = want && list.find((h) => h.id === want)
    if (hit && !jumped.current) { jumped.current = true; setTimeout(() => scrollToHl(hit.text), 300) }
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(paint, 150) })  // 용어 풀이 등으로 본문이 바뀌면 다시 칠함
    mo.observe(root, { childList: true, subtree: true, characterData: true })
    return () => { mo.disconnect(); clearTimeout(timer); reg.delete('vn-hl'); reg.delete('vn-memo') }
  }, [list, dep, sp])
  return (
    <style>{`:root{--vn-hl:#fff0a0}.dark{--vn-hl:rgba(250,204,21,.34)}
::highlight(vn-hl){background-color:var(--vn-hl)}
::highlight(vn-memo){background-color:var(--vn-hl);text-decoration:underline;text-decoration-color:#e0a100;text-decoration-thickness:2px}`}</style>
  )
}

// ---- 글자를 드래그하면 뜨는 작은 메뉴 ----
export function SelectionMenu({ onPick }: { onPick: (k: 'hl' | 'memo' | 'ask', text: string, section: string) => void }) {
  const [s, setS] = useState<{ x: number; top: number; bottom: number; text: string; section: string } | null>(null)
  useEffect(() => {
    const up = (e: MouseEvent) => {
      if ((e.target as Element).closest?.('[data-selmenu]')) return
      setTimeout(() => {
        const sel = getSelection(), root = reportRoot()
        if (!sel || sel.isCollapsed || !root || !root.contains(sel.getRangeAt(0).commonAncestorContainer)) return setS(null)
        const r = sel.getRangeAt(0), text = sel.toString().trim()
        if (!text) return setS(null)
        const el = r.startContainer instanceof Element ? r.startContainer : r.startContainer.parentElement
        const b = r.getBoundingClientRect()
        setS({ x: b.left + b.width / 2, top: b.top, bottom: b.bottom, text, section: el?.closest('[data-sec]')?.getAttribute('data-sec') ?? '' })
      })
    }
    const down = (e: MouseEvent) => { if (!(e.target as Element).closest?.('[data-selmenu]')) setS(null) }
    const hide = () => setS(null)
    document.addEventListener('mouseup', up); document.addEventListener('mousedown', down); document.addEventListener('scroll', hide, true)
    return () => { document.removeEventListener('mouseup', up); document.removeEventListener('mousedown', down); document.removeEventListener('scroll', hide, true) }
  }, [])
  if (!s) return null
  const btn = 'flex items-center gap-1.5 h-9 px-3 text-[13px] font-semibold whitespace-nowrap hover:bg-white/15 first:rounded-l-full last:rounded-r-full'
  const go = (k: 'hl' | 'memo' | 'ask') => { onPick(k, s.text, s.section); setS(null) }
  return (
    <div data-selmenu onMouseDown={(e) => e.preventDefault()}
      style={{ left: Math.min(Math.max(s.x, 150), innerWidth - 150), top: s.top > 60 ? s.top - 46 : s.bottom + 8 }}
      className="fixed z-50 -translate-x-1/2 flex items-center rounded-full bg-fg text-bg shadow-[0_4px_16px_rgba(0,0,0,.25)]">
      <button className={btn} onClick={() => go('hl')}><Highlighter size={14} />하이라이트</button>
      <button className={btn} onClick={() => go('memo')}><StickyNote size={14} />메모</button>
      <button className={btn} onClick={() => go('ask')}><MessageSquare size={14} />채팅에 질문</button>
    </div>
  )
}

// ---- 오른쪽 패널 「하이라이트」 탭 ----
export function HighlightPanel({ list, focusId, edit, del }: { list: Hl[]; focusId: string; edit: (id: string, m: string) => void; del: (id: string) => void }) {
  const [open, setOpen] = useState('')  // 메모칸을 연 항목
  useEffect(() => { if (focusId) setOpen(focusId) }, [focusId])
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-4 py-4">
      {list.length === 0 && <p className="mt-6 text-[14px] leading-[1.7] text-muted">리포트 본문에서 글자를 드래그하면 하이라이트와 메모를 남길 수 있어요.</p>}
      {list.map((h) => (
        <div key={h.id} className="group mb-3 rounded-xl border border-line p-3">
          <button onClick={() => scrollToHl(h.text)} title="본문에서 보기" className="block w-full text-left">
            <span className="block border-l-[3px] border-[#e0a100] pl-2.5 text-[14px] leading-[1.6] line-clamp-4 break-words">{h.text}</span>
          </button>
          {(h.memo || open === h.id) ? (
            <textarea autoFocus={open === h.id} defaultValue={h.memo} rows={2} placeholder="메모를 적어 보세요"
              onBlur={(e) => { if (e.target.value !== h.memo) edit(h.id, e.target.value) }}
              className="mt-2 w-full resize-none rounded-lg bg-subtle text-fg px-2.5 py-2 text-[14px] leading-[1.55] outline-none placeholder:text-muted" />
          ) : null}
          <div className="mt-1.5 flex items-center text-[12px] text-muted">
            <span>{h.created_at.slice(5, 10).replace('-', '. ')}</span>
            {!h.memo && open !== h.id && <button onClick={() => setOpen(h.id)} className="ml-3 hover:text-fg">+ 메모</button>}
            <button onClick={() => del(h.id)} title="삭제" className="ml-auto grid place-items-center size-6 rounded hover:bg-subtle hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- 사이드바 「하이라이트」: 모든 노트의 하이라이트 모아보기 ----
type Group = { note: { id: string; title: string; channel: string; thumbnail: string }; items: Hl[] }
export function HighlightsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => { api<Group[]>('/api/highlights').then(setGroups).catch((e) => setErr(e.message)) }, [])
  useEffect(load, [load])
  const del = (nid: string, hid: string) => { api(`/api/notes/${nid}/highlights/${hid}`, 'DELETE').then(load).catch(() => {}) }
  const total = groups?.reduce((a, g) => a + g.items.length, 0) ?? 0
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileBar />
        <div className="hidden md:flex items-center h-12 px-6 border-b border-line text-[14px]">하이라이트</div>
        <main className="px-4 md:px-8 pt-6 pb-16 max-w-[760px]">
          <h2 className="text-[22px] font-bold">하이라이트 모아보기</h2>
          {err && <p className="mt-3 text-[14px] text-muted">{err}</p>}
          {groups && <p className="mt-1 mb-6 text-[14px] text-muted">노트 {groups.length}개 · 하이라이트 {total}개</p>}
          {groups?.length === 0 && <p className="text-[14px] text-muted">아직 없어요. 노트 리포트에서 글자를 드래그해 보세요.</p>}
          {groups?.map((g) => (
            <section key={g.note.id} className="mb-8">
              <Link to={`/note/${g.note.id}`} className="flex items-center gap-3 mb-3 hover:underline">
                <span className="w-[72px] aspect-video shrink-0 rounded-md bg-subtle overflow-hidden">{g.note.thumbnail && <img src={g.note.thumbnail} alt="" className="size-full object-cover" />}</span>
                <span className="min-w-0 text-[15px] font-semibold leading-snug line-clamp-2">{g.note.title}</span>
              </Link>
              {g.items.map((h) => (
                <div key={h.id} className="group relative mb-2 rounded-xl border border-line p-3.5 pr-10 hover:bg-subtle">
                  <Link to={`/note/${g.note.id}?h=${h.id}`} className="block">
                    <span className="block border-l-[3px] border-[#e0a100] pl-3 text-[15px] leading-[1.65] break-words">{h.text}</span>
                    {h.memo && <span className="mt-2 flex items-start gap-1.5 text-[14px] text-soft"><StickyNote size={14} className="mt-[5px] shrink-0" /><span className="whitespace-pre-wrap break-words">{h.memo}</span></span>}
                    <span className="mt-2 block text-[12px] text-muted">{h.created_at.slice(0, 10).replaceAll('-', '. ')}</span>
                  </Link>
                  <button onClick={() => del(g.note.id, h.id)} title="삭제" className="absolute right-2 top-2 grid place-items-center size-7 rounded text-muted invisible group-hover:visible hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}
