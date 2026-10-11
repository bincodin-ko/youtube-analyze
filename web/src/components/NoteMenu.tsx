import { useState } from 'react'
import { Check, Folder, MoreHorizontal, Trash2 } from 'lucide-react'
import { collectionsChanged, deleteNote, listCollections, moveNote, type Collection } from '../api'
import Backdrop from './Backdrop'

// 앱 안의 삭제 확인 모달 (브라우저 confirm 대신)
export function ConfirmNote({ id, title, onCancel, onDone }: { id: string; title: string; onCancel: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = () => { setBusy(true); deleteNote(id).then(() => { collectionsChanged(); onDone() }).catch((e) => { setErr(e.message); setBusy(false) }) }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={onCancel}>
      <div role="dialog" aria-modal className="w-full max-w-[400px] rounded-2xl bg-bg border border-line p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[17px] font-bold">노트를 삭제할까요?</h3>
        <p className="mt-2 text-[14px] text-soft leading-relaxed break-words line-clamp-3">「{title}」과 장면 이미지가 모두 지워지고 되돌릴 수 없어요.</p>
        {err && <p className="mt-2 text-[13px] text-red-500">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 px-4 rounded-full border border-line text-[14px]">취소</button>
          <button disabled={busy} onClick={go} className="h-9 px-4 rounded-full bg-red-600 text-white text-[14px] font-semibold disabled:opacity-60">{busy ? '삭제 중…' : '삭제'}</button>
        </div>
      </div>
    </div>
  )
}

// 결과 화면 상단 … 메뉴: 컬렉션 지정, 노트 삭제
export default function NoteMenu({ id, title, collectionId, canDelete, className, onDeleted }:
  { id: string; title: string; collectionId?: number | null; canDelete: boolean; className: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [cols, setCols] = useState<Collection[]>([])
  const [cur, setCur] = useState(collectionId ?? null)
  const [ask, setAsk] = useState(false)
  const toggle = () => { setOpen(!open); if (!open) listCollections().then(setCols).catch(() => {}) }
  const move = async (cid: number | null) => { setOpen(false); await moveNote(id, cid); setCur(cid); collectionsChanged() }
  return (
    <div className="relative">
      <button onClick={toggle} title="더보기" className={className}><MoreHorizontal size={18} /></button>
      {open && (
        <>
          <Backdrop z="z-20" onClose={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-30 w-[220px] rounded-xl border border-line bg-bg shadow-[0_4px_16px_rgba(0,0,0,.08)] p-1.5 text-[14px]">
            <p className="px-2.5 pt-1 pb-1.5 text-[12px] text-muted">컬렉션 지정</p>
            {cols.length === 0 && <p className="px-2.5 pb-2 text-[13px] text-muted">왼쪽 "+ 새 컬렉션"으로 먼저 만들어 주세요</p>}
            {cols.map((c) => (
              <button key={c.id} onClick={() => move(c.id)} className="flex items-center gap-2 w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left">
                <Folder size={15} strokeWidth={1.6} className="shrink-0" /><span className="truncate">{c.name}</span>
                {cur === c.id && <Check size={15} className="ml-auto shrink-0" />}
              </button>
            ))}
            {cur != null && <button onClick={() => move(null)} className="w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left text-muted">컬렉션에서 빼기</button>}
            <div className="my-1 border-t border-line" />
            <button disabled={!canDelete} onClick={() => { setOpen(false); setAsk(true) }} title={canDelete ? '' : '처리 중에는 지울 수 없어요'}
              className="flex items-center gap-2 w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left text-red-500 disabled:opacity-40"><Trash2 size={15} />노트 삭제</button>
          </div>
        </>
      )}
      {ask && <ConfirmNote id={id} title={title} onCancel={() => setAsk(false)} onDone={onDeleted} />}
    </div>
  )
}
