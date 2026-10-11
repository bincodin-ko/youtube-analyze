import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

// 새 로고: 둥근 사각 안 재생 삼각형 + 노트 줄
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M9 8.5v8l6.5-4z" fill="var(--bg)" />
      <rect x="9" y="19" width="14" height="2" rx="1" fill="var(--bg)" />
      <rect x="9" y="23" width="9" height="2" rx="1" fill="var(--bg)" />
      <rect x="18" y="10.5" width="5" height="2" rx="1" fill="var(--bg)" />
    </svg>
  )
}

try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark')
} catch { /* 저장소 사용 불가 */ }

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* 저장 불가 */ }
  }, [dark])
  return [dark, () => setDark((d) => !d)] as const
}

export function ThemeButton({ label = false }: { label?: boolean }) {
  const [dark, toggle] = useTheme()
  const Icon = dark ? Sun : Moon
  return (
    <button onClick={toggle} title={dark ? '라이트 모드' : '다크 모드'}
      className={label ? 'flex items-center gap-2 h-9 px-1 text-[15px] text-soft hover:text-fg' : 'grid place-items-center size-9 rounded-lg hover:bg-subtle text-soft'}>
      <Icon size={18} strokeWidth={1.7} />{label && (dark ? '라이트 모드' : '다크 모드')}
    </button>
  )
}

// **굵게** 를 보라 굵게로
export function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i} className="font-bold text-link">{p}</b> : p))}</>
}
