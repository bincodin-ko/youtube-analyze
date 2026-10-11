import { useState } from 'react'
import { Check, Copy, FileCode, FileDown, FileText, Share2 } from 'lucide-react'

// 툴바 "공유" → 릴리스 공유 메뉴 모양(탭: 내보내기·복사). 로컬 앱이라 "공유(링크 공개)" 탭은 없음
export default function ShareMenu({ id, ready, className }: { id: string; ready: boolean; className: string }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'export' | 'copy'>('export')
  const [copied, setCopied] = useState(false)
  const url = (fmt: string) => `/api/notes/${id}/export?fmt=${fmt}`
  const copy = async () => {
    const r = await fetch(url('md'))
    await navigator.clipboard.writeText(await r.text())
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  const row = 'flex items-center gap-3 w-full h-[52px] px-4 rounded-xl border border-line hover:bg-subtle text-[15px] text-left'
  const items: [string, string, typeof FileText][] = [['md', 'Markdown (.md)', FileText], ['html', 'HTML · 장면 이미지 포함', FileCode], ['pdf', 'PDF', FileDown]]
  return (
    <div className="relative">
      <button disabled={!ready} onClick={() => setOpen(!open)} title={ready ? '공유' : '노트가 완성되면 쓸 수 있어요'}
        className={className + ' !flex items-center w-auto gap-1.5 px-2 text-[14px] whitespace-nowrap disabled:opacity-60'}>
        <Share2 size={17} strokeWidth={1.6} />공유
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-30 w-[290px] rounded-xl border border-line bg-bg shadow-[0_4px_16px_rgba(0,0,0,.08)] p-4">
            <div className="flex gap-4 text-[15px] border-b border-line">
              {([['export', '내보내기'], ['copy', '복사']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`pb-2 -mb-px border-b-2 ${tab === k ? 'border-fg font-semibold' : 'border-transparent text-muted'}`}>{l}</button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {tab === 'export' ? items.map(([fmt, label, Icon]) => (
                <a key={fmt} href={url(fmt)} download className={row} onClick={() => setOpen(false)}>
                  <Icon size={18} strokeWidth={1.6} className="text-soft" />{label}
                </a>
              )) : (
                <button onClick={copy} className={row}>
                  {copied ? <Check size={18} /> : <Copy size={18} strokeWidth={1.6} className="text-soft" />}
                  {copied ? '복사했어요' : '전체 복사 (Markdown)'}
                </button>
              )}
            </div>
            {tab === 'export' && <p className="mt-3 text-[12px] text-muted">PDF는 만드는 데 몇 초 걸려요.</p>}
          </div>
        </>
      )}
    </div>
  )
}
