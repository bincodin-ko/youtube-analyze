// 리포트 맨 아래(릴리스 배치): 👍 👎 ↻ · 공유 · 다운로드 · 복사 / 「컬렉션 지정」 상자 / 「💡 확장」 추천 3줄.
// 👍👎는 서버(feedback.json)에 저장돼 새로고침해도 유지. ↻는 확인 창을 거친다. Notion·Slack은 로그인이 필요해 넣지 않음(CHANGES).
import { useEffect, useState } from 'react'
import { Check, Copy, Download, FolderInput, Lightbulb, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import { collectionsChanged, listCollections, moveNote, type Collection } from '../api'
import ShareMenu from './ShareMenu'
import Backdrop from './Backdrop'

export const useFeedback = (id: string) => {
  const [fb, setFb] = useState<Record<string, number>>({})
  useEffect(() => { fetch(`/api/notes/${id}/feedback`).then((r) => r.json()).then(setFb).catch(() => {}) }, [id])
  const set = (k: string, v: number) => {
    const nv = fb[k] === v ? 0 : v
    setFb((o) => ({ ...o, [k]: nv }))
    fetch(`/api/notes/${id}/feedback/${encodeURIComponent(k)}?v=${nv}`, { method: 'PUT' }).catch(() => {})
  }
  return { fb, set }
}

export default function ReportFoot({ id, fkey, fb, onFb, onRedo, busy, text, file, sugg, onSugg, collectionId }: {
  id: string; fkey: string; fb: Record<string, number>; onFb: (k: string, v: number) => void
  onRedo?: () => void; busy?: boolean; text: () => string; file: string
  sugg: { key: string; label: string }[]; onSugg: (k: string) => void; collectionId?: number | null
}) {
  const [ask, setAsk] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cols, setCols] = useState<Collection[] | null>(null)
  const [col, setCol] = useState(collectionId ?? null)
  const v = fb[fkey] ?? 0
  const ib = 'grid place-items-center size-9 rounded-lg text-muted hover:bg-subtle hover:text-fg disabled:opacity-40'
  const copy = async () => { await navigator.clipboard.writeText(text()); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const download = () => {
    const a = document.createElement('a'); a.download = file
    a.href = URL.createObjectURL(new Blob([text()], { type: 'text/markdown;charset=utf-8' })); a.click(); URL.revokeObjectURL(a.href)
  }
  const move = async (cid: number | null) => { setCols(null); await moveNote(id, cid); setCol(cid); collectionsChanged() }
  return (
    <div data-foot="" className="mt-12">
      <div className="flex items-center gap-0.5">
        <button aria-label="좋아요" aria-pressed={v === 1} onClick={() => onFb(fkey, 1)} className={ib}><ThumbsUp size={16} className={v === 1 ? 'fill-fg text-fg' : ''} /></button>
        <button aria-label="별로예요" aria-pressed={v === -1} onClick={() => onFb(fkey, -1)} className={ib}><ThumbsDown size={16} className={v === -1 ? 'fill-fg text-fg' : ''} /></button>
        {onRedo && <button aria-label="다시 만들기" title="다시 만들기" disabled={busy} onClick={() => setAsk(true)} className={ib}><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /></button>}
        <div className="ml-auto flex items-center gap-0.5 rounded-xl bg-subtle px-1">
          <ShareMenu id={id} ready className={ib} />
          <button aria-label="다운로드" title="Markdown으로 저장" onClick={download} className={ib}><Download size={16} /></button>
          <button aria-label="복사" title="복사" onClick={copy} className={ib}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        </div>
      </div>
      <div className="relative mt-6 rounded-xl border border-line py-6 grid place-items-center gap-3 text-center">
        <p className="text-[14px] text-muted">다시 보고 싶은 중요한 자료인가요?</p>
        <button onClick={() => listCollections().then(setCols).catch(() => setCols([]))} className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-subtle text-[14px] hover:bg-line">
          <FolderInput size={15} />{col ? '컬렉션 바꾸기' : '컬렉션 지정'}
        </button>
        {cols && <>
          <Backdrop z="z-20" onClose={() => setCols(null)} />
          <div className="absolute bottom-[calc(100%-8px)] z-30 w-[220px] rounded-xl border border-line bg-bg p-1.5 shadow-[0_4px_16px_rgba(0,0,0,.08)] text-left">
            <button onClick={() => move(null)} className="flex items-center justify-between w-full h-9 px-3 rounded-lg text-[14px] hover:bg-subtle">인박스{col == null && <Check size={14} />}</button>
            {cols.map((c) => <button key={c.id} onClick={() => move(c.id)} className="flex items-center justify-between w-full h-9 px-3 rounded-lg text-[14px] hover:bg-subtle"><span className="truncate">{c.name}</span>{col === c.id && <Check size={14} />}</button>)}
            {!cols.length && <p className="px-3 py-2 text-[13px] text-muted">컬렉션이 없어요. 보관함에서 만들 수 있어요</p>}
          </div>
        </>}
      </div>
      {sugg.length > 0 && <div className="mt-8">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold mb-2"><Lightbulb size={16} />확장</h3>
        {sugg.map((s) => <button key={s.key} onClick={() => onSugg(s.key)} className="block w-full text-left h-[46px] px-2 border-t border-line text-[15px] text-soft hover:bg-subtle hover:text-fg">{s.label}</button>)}
      </div>}
      {ask && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={() => setAsk(false)}>
          <div role="dialog" aria-modal aria-label="다시 만들기 확인" className="w-full max-w-[380px] rounded-2xl bg-bg border border-line p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold">다시 만들까요?</h3>
            <p className="mt-2 text-[14px] text-soft">지금 결과는 사라지고 새로 만들어요.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAsk(false)} className="h-9 px-4 rounded-full border border-line text-[14px]">취소</button>
              <button onClick={() => { setAsk(false); onRedo?.() }} className="h-9 px-4 rounded-full bg-fg text-bg text-[14px] font-semibold">다시 만들기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
