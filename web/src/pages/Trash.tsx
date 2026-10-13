// 휴지통(릴리스 사이드바 「휴지통」): 지운 노트를 다시 꺼내거나 영구 삭제
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Trash2 } from 'lucide-react'
import Sidebar, { MobileBar } from '../components/Sidebar'
import { collectionsChanged, deleteForever, restoreNote, trashList, type NoteSummary } from '../api'
import { usePoll } from './Library'
import { TypeIcon } from './Home'

export default function Trash() {
  const [k, setK] = useState(0)
  const { data, err } = usePoll(async () => ({ notes: await trashList() }), `trash${k}`)
  const [ask, setAsk] = useState<NoteSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const done = () => { setK(k + 1); collectionsChanged() }
  useEffect(() => { if (!ask) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsk(null) }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [ask])
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileBar />
        <div className="hidden md:flex items-center h-12 px-6 border-b border-line text-[14px]">휴지통</div>
        <main className="px-4 md:px-8 pt-6 pb-16 max-w-[900px]">
          <h1 className="flex items-center gap-2 text-[18px] font-bold mb-4"><Trash2 size={18} />휴지통</h1>
          {err && <p className="text-[14px] text-red-500">{err}</p>}
          {data?.notes.length === 0 && <p className="text-[14px] text-muted">휴지통이 비어 있어요.</p>}
          <ul className="divide-y divide-line">
            {data?.notes.map((n) => (
              <li key={n.id} data-trash-row="" className="flex items-center gap-3 py-2.5">
                <TypeIcon kind={n.kind} size={16} />
                <Link to={`/note/${n.id}`} className="flex-1 min-w-0 truncate text-[14px] hover:underline">{n.title}</Link>
                <button onClick={() => restoreNote(n.id).then(done)} className="flex items-center gap-1 h-8 px-3 rounded-lg border border-line text-[13px] hover:bg-subtle"><RotateCcw size={13} />복원</button>
                <button onClick={() => setAsk(n)} className="h-8 px-3 rounded-lg text-[13px] text-red-500 hover:bg-subtle">영구 삭제</button>
              </li>
            ))}
          </ul>
        </main>
      </div>
      {ask && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={() => setAsk(null)}>
          <div role="dialog" aria-modal aria-label="영구 삭제 확인" className="w-full max-w-[400px] rounded-2xl bg-bg border border-line p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold">영구 삭제할까요?</h3>
            <p className="mt-2 text-[14px] text-soft break-words line-clamp-3">「{ask.title}」과 장면 이미지가 모두 지워지고 되돌릴 수 없어요.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button autoFocus onClick={() => setAsk(null)} className="h-9 px-4 rounded-full border border-line text-[14px]">취소</button>
              <button disabled={busy} onClick={() => { setBusy(true); deleteForever(ask.id).then(() => { setAsk(null); done() }).finally(() => setBusy(false)) }} className="h-9 px-4 rounded-full bg-red-600 text-white text-[14px] font-semibold disabled:opacity-60">영구 삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
