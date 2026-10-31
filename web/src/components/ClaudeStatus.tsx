// 채팅 입력창 설정: 답할 AI·범위(모드) 고르기 + Claude 계정 연결/끊기. 모드는 이 브라우저에 기억(기본 자동)
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Cpu, Loader2, Sparkles } from 'lucide-react'
import { MOCK } from '../api'

export type ChatMode = 'auto' | 'local_strict' | 'local_open' | 'claude'
export type ClaudeState = { installed: boolean; loggedIn: boolean; email?: string; plan?: string }
type Models = { local: string; local_ready: boolean | null }

export const MODE_LABEL: Record<ChatMode, string> = { auto: '자동 · 로컬+Claude', local_strict: '로컬 · 영상 안만', local_open: '로컬 · 영상 밖도', claude: 'Claude · 영상 밖도' }
// 입력창 버튼용 짧은 이름(좁은 칸에서 줄바꿈 안 되게)
const MODE_SHORT: Record<ChatMode, string> = { auto: '자동', local_strict: '로컬·영상 안', local_open: '로컬·영상 밖도', claude: 'Claude' }
const MODE_DESC: Record<ChatMode, string> = {
  auto: '영상에 있는 건 로컬 모델이 답하고, 영상에 없는 부분만 Claude가 이어서 (Claude) 표시를 붙여 답해요. Claude에는 그 질문, 영상 제목, 로컬 답 첫 문장만 보내요(대본은 안 보내요).',
  local_strict: '이 PC의 로컬 모델이 영상 내용으로만 답해요. 영상에 없는 건 없다고 해요. 질문이 PC 밖으로 나가지 않아요.',
  local_open: '로컬 모델이 영상에 없는 것도 일반 지식으로 답해요. 질문이 PC 밖으로 나가지 않아요.',
  claude: '내 Claude 구독 계정으로 답해요. 영상에 없는 것도 일반 지식으로 답해요. 질문이 Anthropic으로 보내져요.',
}

// ---- 모드(모든 채팅이 같은 값 사용) ----
const KEY = 'chatMode2' // 기본을 자동으로 바꾸며 키를 새로(예전 'chatMode' 값은 무시)
const isMode = (m: unknown): m is ChatMode => m === 'auto' || m === 'local_strict' || m === 'local_open' || m === 'claude'
let mode: ChatMode = (() => { try { const m = localStorage.getItem(KEY); return isMode(m) ? m : 'auto' } catch { return 'auto' } })()
const modeSubs = new Set<(m: ChatMode) => void>()
export function useChatMode(): [ChatMode, (m: ChatMode) => void] {
  const [m, setM] = useState(mode)
  useEffect(() => { modeSubs.add(setM); return () => { modeSubs.delete(setM) } }, [])
  return [m, (x) => { mode = x; try { localStorage.setItem(KEY, x) } catch { /* 이번 화면만 */ } modeSubs.forEach((f) => f(x)) }]
}

// ---- 답의 "(Claude)" 표시 보이기/숨기기(모든 채팅 공통, 이 브라우저에 기억) ----
let label = (() => { try { return localStorage.getItem('claudeLabel') !== '0' } catch { return true } })()
const labelSubs = new Set<(b: boolean) => void>()
export function useClaudeLabel(): [boolean, (b: boolean) => void] {
  const [b, setB] = useState(label)
  useEffect(() => { labelSubs.add(setB); return () => { labelSubs.delete(setB) } }, [])
  return [b, (x) => { label = x; try { localStorage.setItem('claudeLabel', x ? '1' : '0') } catch { /* 이번 화면만 */ } labelSubs.forEach((f) => f(x)) }]
}

// ---- Claude 연결 상태·로컬 모델 정보 ----
let claude: ClaudeState | null = null
let models: Models | null = null
const subs = new Set<() => void>()
async function load(fresh = false) {
  if (MOCK) return
  try {
    const [a, b] = await Promise.all([fetch(`/api/claude/status${fresh ? '?fresh=1' : ''}`), fetch('/api/chat/models')])
    if (a.ok) claude = await a.json()
    if (b.ok) models = await b.json()
    subs.forEach((f) => f())
  } catch { /* 서버 없으면 표시만 안 함 */ }
}
function useInfo() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); if (!claude) load(); return () => { subs.delete(f) } }, [])
  return { claude, models }
}

const PLAN: Record<string, string> = { max: 'Max', pro: 'Pro', team: 'Team', enterprise: 'Enterprise' }

// 입력창 아래 버튼 + 위로 열리는 메뉴
export function ModePicker() {
  const [m, setM] = useChatMode()
  const [showLabel, setShowLabel] = useClaudeLabel()
  const { claude: c, models: md } = useInfo()
  const [open, setOpen] = useState(false)
  const [wait, setWait] = useState(false)
  const [err, setErr] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { // 바깥 누르면 닫기
    if (!open) return
    const f = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [open])
  useEffect(() => { // 로그인 창을 띄운 뒤 연결될 때까지 5초마다 확인(최대 5분)
    if (!wait) return
    let n = 0
    const t = setInterval(() => { n++; load(true); if (n > 60) setWait(false) }, 5000)
    return () => clearInterval(t)
  }, [wait])
  useEffect(() => { if (c?.loggedIn) setWait(false) }, [c?.loggedIn])
  const call = async (path: string) => {
    setErr('')
    const r = await fetch(path, { method: 'POST' }).catch(() => null)
    if (!r?.ok) { setErr((await r?.json().catch(() => null))?.detail || '처리하지 못했어요'); return false }
    return true
  }
  const login = async () => { if (await call('/api/claude/login')) setWait(true) }
  const logout = async () => {
    if (!confirm('Claude 계정 연결을 끊을까요? Claude Code 로그인도 함께 풀려요. 다시 쓰려면 연결하기를 눌러 로그인해야 해요.')) return
    if (await call('/api/claude/logout')) { if (m === 'claude') setM('auto'); load(true) }
  }
  const pick = (x: ChatMode) => { setM(x); setOpen(false) }
  const local = md?.local ?? 'gemma4:12b'
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} title="답할 AI와 범위 설정" aria-expanded={open}
        className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] text-soft hover:bg-subtle whitespace-nowrap">
        {m === 'claude' || m === 'auto' ? <Sparkles size={13} className="text-link" /> : <Cpu size={13} />}{MODE_SHORT[m]}<ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute bottom-9 right-0 z-30 w-[300px] rounded-xl border border-line bg-bg shadow-lg p-2 text-[13px]">
          <p className="px-2 pt-1 pb-2 text-muted">답할 AI와 범위</p>
          {(['auto', 'local_strict', 'local_open', 'claude'] as const).map((x) => {
            const off = x === 'claude' && c != null && !c.loggedIn
            return (
              <button key={x} onClick={() => !off && pick(x)} disabled={off}
                className={`w-full text-left rounded-lg px-2 py-2 flex gap-2 ${m === x ? 'bg-subtle' : 'hover:bg-subtle'} disabled:opacity-50`}>
                <span className="w-4 shrink-0 pt-0.5">{m === x && <Check size={14} />}</span>
                <span><span className="font-semibold">{MODE_LABEL[x]}</span>{x === 'auto' && <span className="ml-1.5 text-[11px] text-muted">기본</span>}
                  <span className="block mt-0.5 text-muted leading-snug">{MODE_DESC[x]}</span></span>
              </button>
            )
          })}
          <label className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-subtle cursor-pointer">
            <input type="checkbox" checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} className="size-4" />
            답에 <b className="font-semibold">(Claude)</b> 표시 보이기<span className="ml-auto text-[11px] text-muted">끄면 글자만 숨김</span>
          </label>
          <div className="mt-1 border-t border-line px-2 pt-2 pb-1 space-y-1.5">
            <p className="flex items-center gap-1.5"><Cpu size={13} />로컬 모델 <b className="ml-auto font-semibold">{local}</b></p>
            {md?.local_ready === false && <p className="text-red-500 leading-snug">아직 설치되지 않았어요. 받기 전에는 로컬 모드가 답하지 못해요.</p>}
            {md?.local_ready === null && <p className="text-red-500 leading-snug">Ollama가 꺼져 있어요. 켜야 로컬 모드가 답해요.</p>}
            <p className="flex items-center gap-1.5"><Sparkles size={13} className="text-link" />Claude
              <span className={`ml-auto size-2 rounded-full ${c?.loggedIn ? 'bg-green-500' : 'bg-line'}`} />{c?.loggedIn ? '연결됨' : '연결 안 됨'}</p>
            {c?.loggedIn && <p className="text-muted truncate" title={c.email}>{c.email}{c.plan && ` · ${PLAN[c.plan] ?? c.plan}`}</p>}
            {c?.loggedIn ? (
              <button onClick={logout} className="w-full h-8 rounded-md border border-line hover:bg-subtle">연결 끊기</button>
            ) : c && !c.installed ? (
              <p className="text-muted leading-snug">Claude Code가 설치돼 있지 않아요.</p>
            ) : (
              <>
                <button onClick={login} disabled={wait} className="w-full h-8 rounded-md bg-fg text-bg font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {wait && <Loader2 size={13} className="animate-spin" />}{wait ? '로그인 기다리는 중…' : 'Claude 연결하기'}
                </button>
                {wait && <p className="text-muted leading-snug">새 터미널 창 안내대로 브라우저에서 Claude 계정에 로그인하세요.</p>}
              </>
            )}
            {err && <p className="text-red-500">{err}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// 채팅 아래 한 줄: 지금 누가 어떤 범위로 답하는지
export function ModeNote({ what = '영상' }: { what?: string }) {
  const [m] = useChatMode()
  const { models: md } = useInfo()
  const local = md?.local ?? 'gemma4:12b'
  return <>{m === 'auto' ? `${what}에 있는 건 로컬 모델(${local}), 없는 부분은 Claude가 답해요` : m === 'claude' ? `Claude가 ${what} 밖 질문도 일반 지식으로 답해요` : m === 'local_open' ? `로컬 모델(${local})이 ${what} 밖 질문도 일반 지식으로 답해요` : `로컬 모델(${local})이 ${what} 내용으로만 답해요`}</>
}
