import { useEffect } from 'react'

/** 열린 메뉴 뒤의 투명 막: 바깥을 누르거나 Esc 를 누르면 닫힌다 */
export default function Backdrop({ onClose, z = 'z-10' }: { onClose: () => void; z?: string }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return <div className={`fixed inset-0 ${z}`} onClick={onClose} />
}
