// 구독(사이드바 「구독」): 홈의 구독 칸과 같은 내용을 한 화면으로
import Sidebar, { MobileBar } from '../components/Sidebar'
import { Subscriptions } from './Home'

export default function Subs() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileBar />
        <div className="hidden md:flex items-center h-12 px-6 border-b border-line text-[14px]">구독</div>
        <main className="px-4 md:px-6 pt-5 pb-16"><Subscriptions /></main>
      </div>
    </div>
  )
}
