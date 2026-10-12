// "확장 리포트 추가" 창(릴리스 구성): 추천(☆가 있으면 「즐겨찾기」로 바뀜) · 나만의 템플릿 · 더 깊이 이해하기 · 시각자료 · 이해 점검하기 · 그 외(접기).
// 같은 카드가 여러 칸에 나올 수 있고(릴리스와 같음) 선택은 키 기준. 이미 만든 것은 흐리게+못 누름. 영상 노트는 「중요 인용구」가 미리 선택.
import { useState } from 'react'
import { ChevronDown, Pencil, Plus, Settings, Star, Trash2, X } from 'lucide-react'
import type { Tpls } from './Expand'

const lsGet = () => { try { return new Set<string>(JSON.parse(localStorage.getItem('tplStar') || '[]')) } catch { return new Set<string>() } }
// 칸별 카드(키). 추천은 자료 종류별(릴리스: 영상=인용구·액션·배경·인포그래픽 / 웹 글=배경·심화조사·반대 시각·인포그래픽)
const REC_VIDEO = ['quote', 'action', 'background', 'infographic']
const REC_ARTICLE = ['background', 'deep', 'counter', 'infographic']
// 그 외(접기) 칸: 릴리스 순서 + 우리만 있는 것(강의노트·레시피·공부카드)
const REST = ['script', 'timestamp', 'textbook', 'report', 'minutes', 'interview', 'litreview', 'stock', 'investmethod', 'paperreview', 'quote', 'blog', 'sermon', 'lecture', 'recipe', 'study']
const SECTIONS: [string, string[]][] = [
  ['더 깊이 이해하기', ['background', 'counter', 'action', 'deep', 'comments']],
  ['시각자료', ['ppt', 'mindmap', 'infographic', 'cartoon']],
  ['이해 점검하기', ['flash', 'quiz']],
]

export default function ExpandModal({ tpls, made, youtube, article, onClose, onAdd, onChanged }: {
  tpls: Tpls; made: Set<string>; youtube: boolean; article: boolean; onClose: () => void; onAdd: (keys: string[]) => void; onChanged: () => void
}) {
  const [sel, setSel] = useState<string[]>(() => (!article && !made.has('quote') ? ['quote'] : []))
  const [star, setStar] = useState(lsGet)
  const [manage, setManage] = useState(false)
  const [more, setMore] = useState(true)
  const [form, setForm] = useState<{ key?: string; name: string; prompt: string } | null>(null)
  const [err, setErr] = useState('')
  const names = Object.fromEntries(tpls.builtin.map((t) => [t.key, t]))
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const flip = (k: string) => setStar((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k)
    try { localStorage.setItem('tplStar', JSON.stringify([...n])) } catch { /* 저장 불가 */ }
    return n
  })
  const save = async () => {
    if (!form) return
    const r = await fetch(form.key ? `/api/templates/${form.key}` : '/api/templates', {
      method: form.key ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, prompt: form.prompt }),
    })
    if (!r.ok) return setErr((await r.json().catch(() => null))?.detail || '저장하지 못했어요')
    setForm(null); setErr(''); onChanged()
  }
  const remove = async (k: string) => {
    await fetch(`/api/templates/${k}`, { method: 'DELETE' })
    setSel((s) => s.filter((x) => x !== k)); onChanged()
  }
  const card = (k: string, name: string, desc?: string) => {
    const done = made.has(k), on = sel.includes(k)
    return (
      <div key={k} className="relative">
        <button onClick={() => toggle(k)} disabled={done} title={done ? '이미 만들었어요' : desc} aria-pressed={on} data-tpl={k}
          className={`flex items-center w-full h-[44px] pl-3.5 pr-10 rounded-xl border text-[14px] text-left truncate disabled:text-muted disabled:cursor-default ${on ? 'border-fg bg-subtle' : 'border-line enabled:hover:bg-subtle'}`}>
          <span className="truncate">{name}</span>{k === 'ppt' && <span className="ml-1.5 px-1.5 rounded bg-accent text-[#0c0d08] text-[10px] font-bold leading-[16px]">NEW</span>}
        </button>
        <button onClick={() => flip(k)} aria-label={`${name} 즐겨찾기`} aria-pressed={star.has(k)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
          <Star size={15} className={star.has(k) ? 'fill-fg text-fg' : ''} />
        </button>
      </div>
    )
  }
  const cards = (keys: string[]) => keys.filter((k) => names[k] && (k !== 'comments' || youtube)).map((k) => card(k, names[k].name, names[k].desc))
  const grid = 'grid grid-cols-2 gap-3'
  const head = 'text-[14px] text-soft mb-3'
  const placed = new Set([...REC_VIDEO, ...REC_ARTICLE, ...SECTIONS.flatMap(([, ks]) => ks)])
  const rest = [...REST, ...tpls.builtin.map((t) => t.key).filter((k) => !placed.has(k) && !REST.includes(k))]
  const starred = [...tpls.builtin.map((t) => t.key), ...tpls.custom.map((t) => t.key)].filter((k) => star.has(k))
  const custom = (k: string) => tpls.custom.find((t) => t.key === k)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="확장 리포트 추가" onClick={(e) => e.stopPropagation()} className="w-[480px] max-w-full max-h-[85vh] flex flex-col rounded-3xl bg-bg shadow-[0_8px_40px_rgba(0,0,0,.18)]">
        <h2 className="relative h-[60px] shrink-0 grid place-items-center text-[16px] font-bold border-b border-line">
          {form ? (form.key ? '템플릿 수정' : '나만의 템플릿 만들기') : '확장 리포트 추가'}
          <button onClick={onClose} aria-label="닫기" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-fg"><X size={18} /></button>
        </h2>
        {form ? (
          <div className="p-6 overflow-y-auto">
            <label className="block text-[14px] font-bold mb-2">이름</label>
            <input autoFocus value={form.name} maxLength={30} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 면접 질문 만들기"
              className="w-full h-11 px-3.5 rounded-xl border border-line bg-bg text-[15px] outline-none focus:border-fg" />
            <label className="block text-[14px] font-bold mt-5 mb-2">지시문</label>
            <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} rows={6} placeholder="이 영상 내용으로 AI가 어떤 글을 만들어야 하는지 적어 주세요. 예: 이 내용으로 면접 질문 10개와 모범 답안을 만들어 줘"
              className="w-full p-3.5 rounded-xl border border-line bg-bg text-[15px] leading-[1.6] outline-none focus:border-fg resize-none" />
            <p className="mt-2 text-[13px] text-muted">결과는 소제목과 문장(출처 [n] 포함) 형태로 만들어져요.</p>
            {err && <p className="mt-2 text-[13px] text-red-500">{err}</p>}
          </div>
        ) : (
          <div className="p-6 overflow-y-auto scroll-thin">
            <div data-sec={starred.length ? '즐겨찾기' : '추천'}>
              <h3 className={head}>{starred.length ? '즐겨찾기' : '추천'}</h3>
              <div className={grid}>{starred.length ? starred.map((k) => custom(k) ? card(k, custom(k)!.name) : cards([k])) : cards(article ? REC_ARTICLE : REC_VIDEO)}</div>
            </div>
            <h3 className={head + ' mt-6 flex items-center gap-1.5'}>나만의 템플릿
              <button onClick={() => setManage(!manage)} aria-label="템플릿 관리" className={`hover:text-fg ${manage ? 'text-fg' : 'text-muted'}`}><Settings size={14} /></button>
            </h3>
            <div className={grid}>
              {tpls.custom.map((t) => manage ? (
                <div key={t.key} className="flex items-center h-[44px] pl-3.5 pr-2 rounded-xl border border-line text-[14px]">
                  <span className="truncate flex-1">{t.name}</span>
                  <button onClick={() => setForm(t)} aria-label="수정" className="p-1.5 text-muted hover:text-fg"><Pencil size={14} /></button>
                  <button onClick={() => remove(t.key)} aria-label="삭제" className="p-1.5 text-muted hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ) : card(t.key, t.name))}
              <button onClick={() => { setErr(''); setForm({ name: '', prompt: '' }) }} className="flex items-center justify-center gap-1.5 h-[44px] rounded-xl bg-subtle text-[14px] hover:bg-line"><Plus size={15} />만들기</button>
            </div>
            {SECTIONS.map(([cat, ks]) => (
              <div key={cat} className="mt-6" data-sec={cat}>
                <h3 className={head}>{cat}</h3>
                <div className={grid}>{cards(ks)}</div>
              </div>
            ))}
            {more && <div className={grid + ' mt-6'} data-sec="그 외">{cards(rest)}</div>}
            <button onClick={() => setMore(!more)} aria-expanded={more} className="mt-5 mx-auto flex items-center gap-1 text-[14px] text-soft underline underline-offset-4">
              {more ? '접기' : '더보기'}<ChevronDown size={14} className={more ? 'rotate-180' : ''} />
            </button>
          </div>
        )}
        <div className="flex gap-3 p-4 shrink-0 border-t border-line">
          <button onClick={form ? () => setForm(null) : onClose} className="flex-1 h-11 rounded-xl bg-subtle text-[14px] font-semibold hover:bg-line">{form ? '뒤로' : '취소'}</button>
          {form
            ? <button disabled={!form.name.trim() || !form.prompt.trim()} onClick={save} className="flex-[1.4] h-11 rounded-xl bg-fg text-bg text-[14px] font-bold disabled:opacity-40">저장</button>
            : <button disabled={!sel.length} onClick={() => onAdd(sel)} className="flex-[1.4] h-11 rounded-xl bg-fg text-bg text-[14px] font-bold disabled:opacity-40">{sel.length ? `${sel.length}개 추가` : '추가'}</button>}
        </div>
      </div>
    </div>
  )
}
