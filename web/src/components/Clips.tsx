// 브라우저 확장으로 스크랩한 구간 목록(이 영상 것만). 없으면 아무것도 안 보임. 클릭 → 그 구간 시작부터 재생
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { fmtTime } from '../api'

type Clip = { id: string; start: number; end: number; memo: string }

export default function Clips({ videoId, seek }: { videoId?: string; seek: (t: number) => void }) {
  const [list, setList] = useState<Clip[]>([])
  useEffect(() => {
    if (!videoId) return
    fetch(`/api/clips?video_id=${videoId}`).then((r) => r.json()).then(setList).catch(() => {})
  }, [videoId])
  if (!list.length) return null
  const del = (id: string) => fetch(`/api/clips/${id}`, { method: 'DELETE' }).then(() => setList((l) => l.filter((c) => c.id !== id)))
  return (
    <div className="px-4 pb-3 shrink-0" data-testid="clips">
      <p className="text-[13px] font-semibold mb-1.5">스크랩 구간 <span className="text-muted font-normal">{list.length}</span></p>
      <ul className="flex flex-col gap-1 max-h-[132px] overflow-y-auto">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-lg bg-subtle px-2.5 h-9">
            <button onClick={() => seek(c.start)} className="text-link text-[13px] tabular-nums shrink-0 hover:underline">{fmtTime(c.start)} – {fmtTime(c.end)}</button>
            <span className="text-[13px] text-soft truncate min-w-0 flex-1" title={c.memo}>{c.memo}</span>
            <button onClick={() => del(c.id)} className="text-muted hover:text-fg shrink-0" title="삭제"><X size={14} /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}
