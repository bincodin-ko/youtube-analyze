import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Sidebar, { MobileBar } from '../components/Sidebar'
import { listNotes } from '../api'
import { NoteGrid, usePoll } from './Library'

export default function Home() {
  const nav = useNavigate()
  const [k, setK] = useState(0)
  const { data, err } = usePoll(async () => ({ notes: await listNotes() }), `home${k}`)
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileBar />
        <div className="hidden md:flex items-center h-12 px-6 border-b border-line text-[14px]">영상을 글과 장면으로 정리해 드려요</div>
        <main className="px-4 md:px-8 pt-4 pb-16">
          <button onClick={() => nav('/new')} className="w-full h-[240px] md:h-[290px] rounded-xl bg-[#e6e7e2] dark:bg-subtle flex flex-col items-center justify-center gap-2.5">
            <span className="grid place-items-center size-14 rounded-full bg-fg text-bg"><Plus size={22} strokeWidth={1.5} /></span>
            <span className="text-[16px] mt-1">새로 추가하기</span>
            <span className="text-[14px] text-muted px-4">유튜브 영상·재생목록·채널 링크를 붙여 넣으면 요약 노트가 만들어져요</span>
          </button>
          <h2 className="text-[18px] font-bold mb-4 mt-10">최근 노트</h2>
          {err && <p className="text-muted text-[14px]">{err}</p>}
          {data?.notes.length === 0 && <p className="text-muted text-[14px]">아직 노트가 없어요. 위에서 유튜브 링크를 추가해 보세요.</p>}
          {data && <NoteGrid notes={data.notes} onMoved={() => setK(k + 1)} />}
        </main>
      </div>
    </div>
  )
}
