import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Folder, Highlighter, House, MoreHorizontal, PanelLeft, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { collectionsChanged, createCollection, deleteCollection, listCollections, renameCollection, type Collection } from '../api'
import { Logo, ThemeButton } from './ui'

const item = () => 'flex items-center gap-2.5 h-[35px] px-1 rounded-md text-[16px] font-semibold'

export default function Sidebar() {
  const nav = useNavigate()
  return (
    <aside className="hidden md:flex flex-col w-[245px] shrink-0 h-screen sticky top-0 bg-subtle border-r border-line">
      <div className="flex items-center justify-between h-[48px] px-4 pt-2">
        <div className="flex items-center gap-2 font-extrabold text-[19px]"><Logo size={30} />영상노트</div>
        <PanelLeft size={20} strokeWidth={1.5} className="text-muted" />
      </div>
      <div className="flex gap-2 px-3 mt-5">
        <button onClick={() => nav('/new')} className="flex-1 flex items-center gap-2 h-10 px-3 rounded-lg bg-bg border border-line text-muted text-[15px]">
          <Plus size={18} strokeWidth={1.5} className="ml-1" /> 새로 추가하기
        </button>
        <button onClick={() => nav('/search')} title="검색" className="grid place-items-center size-10 rounded-lg bg-bg border border-line text-soft"><Search size={17} /></button>
      </div>
      <nav className="px-3 mt-6 flex flex-col gap-[3px]">
        <NavLink to="/" end className={item}><House size={19} strokeWidth={1.6} />홈</NavLink>
        <NavLink to="/library" className={item}><BookOpen size={19} strokeWidth={1.6} />라이브러리</NavLink>
        <Collections />
        <NavLink to="/highlights" className={item}><Highlighter size={19} strokeWidth={1.6} />하이라이트</NavLink>
      </nav>
      <div className="mt-auto border-t border-line px-3 py-3">
        <ThemeButton label />
      </div>
    </aside>
  )
}

export function MobileBar() {
  const nav = useNavigate()
  return (
    <header className="md:hidden flex items-center justify-between h-12 px-4 border-b border-line bg-subtle">
      <button onClick={() => nav('/')} className="flex items-center gap-2 font-extrabold text-[17px]"><Logo size={26} />영상노트</button>
      <div className="flex items-center gap-1">
        <button onClick={() => nav('/new')} className="h-8 px-3 rounded-full bg-fg text-bg text-[14px] font-semibold">+ 새로 추가</button>
        <ThemeButton />
      </div>
    </header>
  )
}

// 라이브러리 아래 컬렉션 목록 + 새 컬렉션(이름 입력 후 Enter)
function Collections() {
  const nav = useNavigate()
  const [list, setList] = useState<Collection[]>([])
  const loc = useLocation()
  const [name, setName] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ id: number; top: number } | null>(null)  // … 메뉴가 열린 컬렉션(버튼 위치)
  const [edit, setEdit] = useState<number | null>(null)  // 이름 바꾸는 중인 컬렉션
  const [ask, setAsk] = useState<Collection | null>(null)
  const mc = list.find((c) => c.id === menu?.id)
  useEffect(() => {
    const load = () => listCollections().then(setList).catch(() => {})
    load()
    window.addEventListener('collections', load)
    return () => window.removeEventListener('collections', load)
  }, [])
  const add = async (v: string) => {
    const n = v.trim()
    setName(null)
    if (!n) return
    const { id } = await createCollection(n)
    collectionsChanged()
    nav(`/collection/${id}`)
  }
  const sub = ({ isActive }: { isActive: boolean }) => `flex items-center gap-2 h-[30px] pl-7 pr-1 rounded-md text-[14px] truncate ${isActive ? 'bg-bg font-semibold' : 'text-soft hover:text-fg'}`
  const rename = async (c: Collection, v: string) => {
    setEdit(null)
    if (v.trim() && v.trim() !== c.name) { await renameCollection(c.id, v.trim()); collectionsChanged() }
  }
  const remove = async (c: Collection) => {
    setAsk(null); await deleteCollection(c.id); collectionsChanged()
    if (loc.pathname === `/collection/${c.id}`) nav('/library')
  }
  return (
    <div className="flex flex-col gap-[2px] max-h-[40vh] overflow-y-auto scroll-thin">
      {list.map((c) => edit === c.id ? (
        <input key={c.id} autoFocus defaultValue={c.name} onBlur={(e) => rename(c, e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.value = c.name; if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
          className="ml-7 h-[30px] px-2 rounded-md border border-line bg-bg text-[14px] outline-none focus:border-fg" />
      ) : (
        <div key={c.id} className="group relative">
          <NavLink to={`/collection/${c.id}`} className={sub} title={c.name}>
            <Folder size={15} strokeWidth={1.6} className="shrink-0" /><span className="truncate">{c.name}</span>
            <span className={`ml-auto text-[12px] text-muted ${menu?.id === c.id ? 'invisible' : 'group-hover:invisible'}`}>{c.count}</span>
          </NavLink>
          <button onClick={(e) => setMenu(menu?.id === c.id ? null : { id: c.id, top: e.currentTarget.getBoundingClientRect().bottom + 2 })} title="더보기"
            className={`absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-6 rounded text-soft hover:bg-line ${menu?.id === c.id ? '' : 'invisible group-hover:visible'}`}><MoreHorizontal size={15} /></button>
        </div>
      ))}
      {menu && mc && createPortal(  // 스크롤 영역 밖(body)에 띄워 잘리지 않게
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div style={{ top: menu.top }} className="fixed left-[40px] w-[190px] z-50 rounded-xl border border-line bg-bg shadow-[0_4px_16px_rgba(0,0,0,.08)] p-1.5 text-[14px]">
            <button onClick={() => { setMenu(null); setEdit(mc.id) }} className="flex items-center gap-2 w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left"><Pencil size={14} />이름 바꾸기</button>
            <button onClick={() => { setMenu(null); setAsk(mc) }} className="flex items-center gap-2 w-full h-9 px-2.5 rounded-lg hover:bg-subtle text-left text-red-500"><Trash2 size={14} />컬렉션 삭제</button>
          </div>
        </>, document.body)}
      {ask && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={() => setAsk(null)}>
          <div role="dialog" aria-modal className="w-full max-w-[400px] rounded-2xl bg-bg border border-line p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold">컬렉션을 삭제할까요?</h3>
            <p className="mt-2 text-[14px] text-soft leading-relaxed break-words">「{ask.name}」만 지워지고, 안의 노트 {ask.count}개는 라이브러리에 그대로 남아요.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAsk(null)} className="h-9 px-4 rounded-full border border-line text-[14px]">취소</button>
              <button onClick={() => remove(ask)} className="h-9 px-4 rounded-full bg-red-600 text-white text-[14px] font-semibold">삭제</button>
            </div>
          </div>
        </div>,
        document.body)}
      {name === null ? (
        <button onClick={() => setName('')} className="flex items-center gap-2 h-[30px] pl-7 text-[14px] text-muted hover:text-fg"><Plus size={15} />새 컬렉션</button>
      ) : (
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={(e) => add(e.currentTarget.value)} placeholder="컬렉션 이름"
          onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.value = ''; if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
          className="ml-7 h-[30px] px-2 rounded-md border border-line bg-bg text-[14px] outline-none focus:border-fg" />
      )}
    </div>
  )
}
