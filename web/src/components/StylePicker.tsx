// 「인포그래픽 스타일 선택」「만화 스타일 선택」 창(릴리스와 같은 배치): 스타일 3칸 격자 + ✓ · 미리보기 · 고급 설정(추가 프롬프트) · 취소/만들기.
// 「만들기」를 눌러야 생성한다(취소·X·Esc·바깥 누르기는 아무것도 안 만듦).
import { useEffect, useState, type ReactNode } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

export type Opt = { key: string; name: string; desc: string }

export default function StylePicker({ title, sub, opts, preview, onClose, onMake }: {
  title: string; sub: string; opts: Opt[]; preview: (key: string) => ReactNode
  onClose: () => void; onMake: (o: { style: string; extra: string }) => void
}) {
  const [style, setStyle] = useState(opts[0].key)
  const [adv, setAdv] = useState(false)
  const [extra, setExtra] = useState('')
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="relative w-full min-w-0 max-w-[536px] max-h-[90vh] flex flex-col rounded-3xl bg-bg shadow-[0_8px_40px_rgba(0,0,0,.18)]">
        <button onClick={onClose} aria-label="닫기" className="absolute right-5 top-5 text-muted hover:text-fg"><X size={18} /></button>
        <div className="pt-8 pb-5 px-6 text-center shrink-0">
          <h2 className="text-[20px] font-bold">{title}</h2>
          <p className="mt-2 text-[13px] text-soft">{sub}</p>
        </div>
        <div className="px-6 pb-4 overflow-y-auto scroll-thin">
          <h3 className="text-[15px] font-bold mb-3">스타일</h3>
          <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="스타일">
            {opts.map((o) => (
              <button key={o.key} role="radio" aria-checked={style === o.key} onClick={() => setStyle(o.key)}
                className={`relative text-left h-[80px] px-4 rounded-xl border ${style === o.key ? 'border-fg border-[1.5px]' : 'border-line hover:bg-subtle'}`}>
                <div className="text-[15px] font-medium">{o.name}</div>
                <div className="mt-1 text-[13px] text-soft truncate">{o.desc}</div>
                {style === o.key && <span className="absolute -top-2 -right-2 size-7 rounded-full bg-fg text-bg grid place-items-center"><Check size={15} /></span>}
              </button>
            ))}
          </div>
          {!adv && <>
            <h3 className="text-[15px] font-bold mt-7 mb-3">미리보기</h3>
            <div data-preview={style} className="h-[180px] rounded-xl border border-line overflow-hidden bg-subtle">{preview(style)}</div>
          </>}
          <button onClick={() => setAdv(!adv)} aria-expanded={adv} className="mt-6 flex items-center gap-1.5 text-[15px] font-bold">
            <ChevronDown size={16} className={adv ? '' : '-rotate-90'} />고급 설정
          </button>
          {adv && <div className="mt-3">
            <label htmlFor="sp-extra" className="block text-[14px] mb-2">추가 프롬프트 (선택사항)</label>
            <textarea id="sp-extra" autoFocus value={extra} onChange={(e) => setExtra(e.target.value)} rows={4} maxLength={500} placeholder="추가로 반영할 스타일이나 요구사항을 입력하세요..."
              className="w-full p-3.5 rounded-xl border border-line bg-bg text-[15px] leading-[1.6] outline-none focus:border-fg resize-none" />
            <p className="mt-2 text-[12px] text-muted">예: "밝은 색상 사용", "간단하게", "데이터 차트 포함" 등</p>
          </div>}
        </div>
        <div className="flex gap-3 p-5 shrink-0">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-subtle text-[15px] font-semibold hover:bg-line">취소</button>
          <button onClick={() => onMake({ style, extra: extra.trim() })} className="flex-1 h-12 rounded-xl bg-accent text-[#0c0d08] text-[15px] font-bold hover:brightness-95">만들기</button>
        </div>
      </div>
    </div>
  )
}
