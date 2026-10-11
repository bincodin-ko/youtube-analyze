import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronsLeft, ChevronsRight, FileText, Lightbulb, List, Loader2, PanelLeft, Search, ExternalLink } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { fmtTime, getNote, getTranslation, sceneSrc, translateNote, type Note, type Trans } from '../api'
import NoteMenu from '../components/NoteMenu'
import { ThemeButton } from '../components/ui'
import ShareMenu from '../components/ShareMenu'
import Chat, { PanelTabs } from '../components/Chat'
import { HighlightLayer, HighlightPanel, SelectionMenu, useReportNotes } from '../components/Highlights'
import { DeepLink } from './Combined'
import { LengthMenu, RichT, TermList, loadStyleReport, useTerms, type Report, type Style } from '../components/ReportExtras'
import Clips from '../components/Clips'
import Mindmap, { getMindmap, makeMindmap, type Level } from '../components/Mindmap'
import { ExpandBody, ExpandMenu, useExpand } from '../components/Expand'

// ---- YouTube IFrame 플레이어 ----
type YTPlayer = { seekTo(s: number, a: boolean): void; playVideo(): void; getCurrentTime(): number; destroy(): void }
type YTGlobal = { Player: new (el: HTMLElement, o: object) => YTPlayer }
declare global { interface Window { YT?: YTGlobal; onYouTubeIframeAPIReady?: () => void } }

function loadYT(): Promise<YTGlobal> {
  return new Promise((res) => {
    if (window.YT?.Player) return res(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT!) }
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script')
      s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    }
  })
}

function usePlayer(videoId: string | undefined, onTime: (t: number) => void) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const pending = useRef<number | null>(null)
  useEffect(() => {
    if (!videoId || !host.current) return
    let dead = false, timer = 0
    const el = document.createElement('div')
    host.current.replaceChildren(el)
    loadYT().then((YT) => {
      if (dead) return
      player.current = new YT.Player(el, {
        videoId, width: '100%', height: '100%', playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            if (pending.current != null) { player.current?.seekTo(pending.current, true); player.current?.playVideo(); pending.current = null }
            timer = window.setInterval(() => onTime(player.current?.getCurrentTime() ?? 0), 500)
          },
        },
      })
    })
    return () => { dead = true; clearInterval(timer); player.current?.destroy(); player.current = null }
  }, [videoId, onTime])
  const seek = useCallback((t: number) => {
    const p = player.current
    if (p?.seekTo) { p.seekTo(t, true); p.playVideo(); onTime(t) } else pending.current = t
  }, [onTime])
  return { host, seek }
}

// ---- 처리 중 4단계 ----
const STEPS = [['transcript', '자막 받는 중'], ['summary', '요약 중'], ['scenes', '장면 캡처 중'], ['done', '완료']] as const

// 종류별 단계 문구 (video는 기본값)
const LABELS: Record<string, Record<string, string>> = {
  article: { transcript: '본문 읽는 중', scenes: '이미지 고르는 중' }, pdf: { transcript: '본문 읽는 중', scenes: '정리하는 중' },
  audio: { transcript: '음성 받아쓰는 중', scenes: '정리하는 중' }, localvideo: { transcript: '음성 받아쓰는 중' },
}

function Progress({ id, initial, error, onDone, kind }: { kind?: string; id: string; initial: string; error: string | null; onDone: () => void }) {
  const [step, setStep] = useState(initial || 'transcript')
  const [err, setErr] = useState(error)
  useEffect(() => {
    if (id === 'mock') return
    const es = new EventSource(`/api/notes/${id}/events`)
    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.step === 'error') { setErr(d.message || '처리에 실패했어요'); es.close() }
      else if (d.step === 'done') { es.close(); onDone() }
      else { setStep(d.step); if (d.status === 'done') onDone() } // 단계가 끝날 때마다 다시 불러와 대본부터 먼저 보이게
    }
    return () => es.close()
  }, [id, onDone])
  const cur = Math.max(0, STEPS.findIndex(([k]) => k === step))
  return (
    <div className="pt-24">
      <h1 className="text-[24px] font-bold">노트를 만들고 있어요</h1>
      <ol className="mt-8 space-y-4">
        {STEPS.map(([k, label], i) => (
          <li key={k} className={`flex items-center gap-3 text-[16px] ${i > cur ? 'text-muted' : ''}`}>
            <span className="grid place-items-center size-6">
              {i < cur ? <Check size={18} /> : i === cur && !err ? <Loader2 size={18} className="animate-spin" /> : <span className="size-2 rounded-full bg-line" />}
            </span>
            {LABELS[kind ?? '']?.[k] ?? label}
            {i === cur && !err && <span className="size-2 rounded-full bg-accent" />}
          </li>
        ))}
      </ol>
      {err && <p className="mt-6 text-[15px] text-muted">{err}</p>}
    </div>
  )
}

// ---- 본문 조각 ----
function Ref({ n, note, seek }: { n: number; note: Note; seek: (t: number) => void }) {
  const t = note.transcript[n]?.start
  if (t == null) return null
  return <button onClick={() => seek(t)} className="text-link text-[12px] align-baseline mx-0.5 hover:underline" title={note.kind === 'article' || note.kind === 'pdf' ? `문단 ${n}` : fmtTime(t)}>[{n}]</button>
}

// ---- 스크립트 패널 ----
function Script({ note, time, seek }: { note: Note; time: number; seek: (t: number) => void }) {
  const [open, setOpen] = useState(true)
  const [q, setQ] = useState('')
  // 해외 영상 번역 토글(B4): 원문 | 한국어. 번역본은 서버에 저장돼 있으면 바로 표시
  const foreign = !!note.lang && note.lang !== 'ko'
  const [ko, setKo] = useState(false)
  const [tr, setTr] = useState<Trans | null>(null)
  const [trErr, setTrErr] = useState('')
  const busy = !!tr?.busy
  useEffect(() => { if (foreign) getTranslation(note.id).then((t) => { setTr(t); if (t.busy) setKo(true) }).catch(() => {}) }, [foreign, note.id])
  // 번역 중이면 2초마다 진행 상황을 받아 끝난 묶음부터 보여줌
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => getTranslation(note.id).then(setTr).catch(() => {}), 2000)
    return () => clearInterval(t)
  }, [busy, note.id])
  const pick = (v: boolean) => {
    setKo(v); setTrErr('')
    if (v && !tr?.texts && !busy) translateNote(note.id).then(setTr).catch((e) => setTrErr(e.message))
  }
  const part = tr?.texts ?? tr?.partial ?? null
  const show = ko && part ? part : null
  const box = useRef<HTMLDivElement>(null)
  const active = useMemo(() => {
    let a = -1
    note.transcript.forEach((l, i) => { if (l.start <= time + 0.3) a = i })
    return a
  }, [note, time])
  useEffect(() => {
    const c = box.current, el = c?.querySelector<HTMLElement>(`[data-i="${active}"]`)
    if (c && el) c.scrollTo({ top: el.offsetTop - c.offsetTop - 60, behavior: 'smooth' })
  }, [active])
  const lines = note.transcript.map((l, i) => ({ l, i })).filter(({ l, i }) => !q || l.text.includes(q) || !!show?.[i]?.includes(q))
  return (
    <div className="flex flex-col min-h-0 flex-1 border-t border-line">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between h-[43px] px-4 text-[14px] font-semibold shrink-0">
        스크립트<ChevronDown size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          {foreign && (
            <div className="px-4 pb-2 shrink-0 flex items-center gap-2">
              <div className="flex rounded-lg border border-line overflow-hidden text-[13px]">
                {([[false, '원문'], [true, '한국어']] as const).map(([v, l]) => (
                  <button key={l} onClick={() => pick(v)} className={`h-8 px-3.5 ${ko === v ? 'bg-subtle font-semibold' : 'text-muted'}`}>{l}</button>
                ))}
              </div>
              {busy && <span className="flex items-center gap-1 text-[13px] text-muted"><Loader2 size={13} className="animate-spin" />번역 중 {tr!.done}/{tr!.total}</span>}
            </div>
          )}
          {(trErr || tr?.err) && <p className="px-4 pb-2 text-[13px] text-red-500">{trErr || tr?.err}</p>}
          <div className="px-4 pb-2 shrink-0">
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-line text-muted">
              <Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="스크립트 검색" className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-fg placeholder:text-muted" />
            </div>
          </div>
          <div ref={box} className="relative flex-1 min-h-0 overflow-y-auto scroll-thin px-3 pb-6">
            {lines.length === 0 && <p className="px-2 py-4 text-[14px] text-muted">{note.transcript.length ? '찾는 내용이 없어요' : '대본을 받는 중이에요'}</p>}
            {lines.map(({ l, i }) => (
              <button key={i} data-i={i} onClick={() => seek(l.start)}
                className={`block w-full text-left px-2 py-2 rounded-md text-[15px] leading-[1.65] ${i === active ? 'bg-hl' : ''}`}>
                <span className="text-muted text-[13px] mr-2">{fmtTime(l.start)}</span><span className={show && show[i] == null ? 'opacity-45' : ''}>{show?.[i] ?? l.text}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---- 웹 글 원문 패널(영상 플레이어 자리) ----
function ArticlePanel({ note, hl, open, setOpen }: { note: Note; hl: number | null; open: boolean; setOpen: (o: boolean) => void }) {
  const d = note.upload_date.split('-').map(Number)
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3 shrink-0 leading-tight">
        <p className="text-[14px] font-semibold truncate">{note.channel}</p>
        {note.upload_date && <p className="text-[13px] text-muted mt-1">{d[0]}. {d[1]}. {d[2]}.</p>}
        {note.kind === 'article' && <a href={note.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-[13px] text-link hover:underline"><ExternalLink size={14} className="shrink-0" /><span className="truncate">원문 링크 열기</span></a>}
      </div>
      <div className="flex flex-col min-h-0 flex-1 border-t border-line">
        <button onClick={() => setOpen(!open)} className="flex items-center justify-between h-[43px] px-4 text-[14px] font-semibold shrink-0">
          원문<ChevronDown size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-3 pb-6">
            {note.transcript.length === 0 && <p className="px-2 py-4 text-[14px] text-muted">본문을 읽는 중이에요</p>}
            {note.transcript.map((l, i) => (
              <p key={i} id={`para-${i}`} className={`px-2 py-2 rounded-md text-[15px] leading-[1.65] transition-colors duration-500 ${i === hl ? 'bg-hl' : ''}`}>
                <span className="text-muted text-[13px] mr-2">[{i}]{l.page ? ` ${l.page}쪽` : ''}</span>{l.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- 페이지 ----
export default function NotePage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [note, setNote] = useState<Note | null>(null)
  const [err, setErr] = useState('')
  const [left, setLeft] = useState(true)
  const [right, setRight] = useState(true)
  const [tab, setTab] = useState<'video' | 'report' | 'chat'>('report')
  const [time, setTime] = useState(0)
  const [mode, setMode] = useState<'summary' | 'expand'>('summary')
  // 길이·난이도 리포트(짧게·길게·쉽게): 한 번 받은 건 alts에 두고 바로 표시
  const [style, setStyle] = useState<Style>('default')
  const [alts, setAlts] = useState<Partial<Record<Style, Report>>>({})
  const [styleBusy, setStyleBusy] = useState(false)
  const [styleErr, setStyleErr] = useState('')
  const pickStyle = (st: Style) => {
    setStyleErr(''); setMode('summary')
    if (st === 'default' || alts[st]) return setStyle(st)
    setStyleBusy(true)
    loadStyleReport(id, st).then((rp) => { setAlts((a) => ({ ...a, [st]: rp })); setStyle(st) }).catch((e) => setStyleErr(e.message)).finally(() => setStyleBusy(false))
  }
  const terms = useTerms(id, note?.status === 'done' && !!note.report)
  const seen = new Set<string>() // 용어마다 리포트 안 첫 등장에만 밑줄
  const [mds, setMds] = useState<Partial<Record<Level, string>>>({}) // 상세도별 마인드맵
  const [mmLevel, setMmLevel] = useState<Level>('normal')
  const [mmBusy, setMmBusy] = useState(false)
  const [mmProg, setMmProg] = useState(0)
  const [mmErr, setMmErr] = useState('')
  const md = mds[mmLevel] ?? null
  useEffect(() => { if (mode === 'expand' && !mds[mmLevel]) getMindmap(id, mmLevel).then((m) => m && setMds((o) => ({ ...o, [mmLevel]: m }))).catch(() => {}) }, [mode, id, mmLevel])
  const genMindmap = () => { const lv = mmLevel; setMmBusy(true); setMmErr(''); setMmProg(0); makeMindmap(id, lv, setMmProg).then((m) => setMds((o) => ({ ...o, [lv]: m }))).catch((e) => setMmErr(e.message)).finally(() => setMmBusy(false)) }
  const ex = useExpand(id, mode === 'expand', genMindmap) // 확장 탭 템플릿·플래시카드·퀴즈
  const [lb, setLb] = useState<number | null>(null)
  // 마인드맵을 볼 때는 좌우 패널을 접어 넓게 보고, 나가면 원래 상태로 복원
  const wide = mode === 'expand' && ex.cur === 'mindmap'
  useEffect(() => { if (!wide) return; const p = [left, right]; setLeft(false); setRight(false); return () => { setLeft(p[0]); setRight(p[1]) } }, [wide]) // eslint-disable-line react-hooks/exhaustive-deps
  const rn = useReportNotes(id, () => { setRight(true); if (matchMedia('(max-width:1099px)').matches) setTab('chat') }) // 하이라이트·메모·채팅 인용
  const reload = useCallback(() => { getNote(id).then(setNote).catch((e) => setErr(e.message)) }, [id])
  useEffect(reload, [reload])
  const art = note?.kind === 'article' || note?.kind === 'pdf'  // 영상 없이 원문 문단으로 이동하는 종류
  const local = note?.kind === 'audio' || note?.kind === 'localvideo'  // 내 파일: HTML5 재생
  const media = useRef<HTMLMediaElement>(null)
  const mediaSeek = useCallback((t: number) => { const m = media.current; if (m) { m.currentTime = t; m.play().catch(() => {}); setTime(t) } }, [])
  const { host, seek: ytSeek } = usePlayer(art || local ? undefined : note?.video_id, setTime)
  // 웹 글: 출처 [n] 클릭 → 원문 패널을 펴고 그 문단으로 스크롤 + 잠깐 강조 (transcript[n].start = 문단 번호)
  const [hl, setHl] = useState<number | null>(null)
  const [srcOpen, setSrcOpen] = useState(true)
  const seek = art ? (n: number) => { setSrcOpen(true); setLeft(true); if (matchMedia('(max-width:1099px)').matches) setTab('video'); setHl(n) } : local ? mediaSeek : ytSeek
  useEffect(() => {
    if (hl == null) return
    document.getElementById(`para-${hl}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = setTimeout(() => setHl(null), 2200)
    return () => clearTimeout(t)
  }, [hl])

  const shown = (style !== 'default' && alts[style]) || note?.report
  const scenes = useMemo(() => shown?.sections.flatMap((s) => s.children).filter((c) => c.scene).map((c) => ({ src: sceneSrc(note!.id, c.scene!.file), time: c.scene!.time, title: `${c.id}. ${c.title}` })) ?? [], [note, shown])
  const goto = (anchor: string, t: number) => {
    document.getElementById(`sec-${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    seek(t)
  }
  if (err) return <div className="p-10 text-[15px]">{err} <button className="underline ml-2" onClick={() => nav('/')}>홈으로</button></div>
  if (!note) return <div className="p-10 text-muted">불러오는 중…</div>
  const r = shown
  const date = note.upload_date.split('-').map(Number)

  const iconBtn = 'grid place-items-center size-9 rounded-lg hover:bg-subtle text-soft'
  return (
    <div className="flex flex-col h-screen">
      <div className="min-[1100px]:hidden flex h-11 border-b border-line shrink-0">
        {([['video', '영상 · 스크립트'], ['report', '리포트'], ['chat', '채팅']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 text-[15px] font-semibold border-b-2 ${tab === k ? 'border-fg' : 'border-transparent text-muted'}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-1 min-h-0">
        {/* 왼쪽 330 */}
        <section className={`${tab === 'video' ? 'flex' : 'hidden'} ${left ? 'min-[1100px]:flex' : 'min-[1100px]:hidden'} flex-col w-full min-[1100px]:w-[330px] shrink-0 border-r border-line min-h-0`}>
          <div className="flex items-center gap-2 h-12 px-3 shrink-0">
            <button onClick={() => nav('/')} className={iconBtn + ' border border-line'} title="홈"><PanelLeft size={18} strokeWidth={1.5} /></button>
            <button onClick={() => nav('/new')} className="h-8 px-3.5 rounded-full bg-fg text-bg text-[14px] font-semibold">새로 만들기</button>
            <List size={19} className="text-muted ml-2" strokeWidth={1.5} />
            <button onClick={() => setLeft(false)} className="ml-auto hidden min-[1100px]:grid place-items-center size-8 text-soft" title="접기"><ChevronsLeft size={18} /></button>
          </div>
          {art ? <ArticlePanel note={note} hl={hl} open={srcOpen} setOpen={setSrcOpen} /> : <>
          {local ? (() => {
            const p = { ref: media as never, src: `/media/${note.id}/source.${note.url.split('.').pop()}`, controls: true, preload: 'metadata', onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => setTime(e.currentTarget.currentTime) }
            return note.kind === 'audio' ? <audio {...p} className="w-full px-3 h-14 shrink-0" /> : <video {...p} className="aspect-video w-full bg-black shrink-0" />
          })() : <div ref={host} className="aspect-video w-full bg-black shrink-0 [&_iframe]:size-full" />}
          <div className="flex items-center gap-3 px-4 h-[64px] shrink-0">
            {note.channel && <span className="grid place-items-center size-10 rounded-full bg-subtle text-[15px] font-bold shrink-0">{note.channel.slice(0, 1)}</span>}
            <div className="min-w-0 leading-tight">
              <p className="text-[14px] truncate">{note.channel}</p>
              {note.upload_date && <p className="text-[13px] text-muted mt-0.5">{date[0]}. {date[1]}. {date[2]}.</p>}
            </div>
          </div>
          {!local && <Clips videoId={note.video_id} seek={seek} />}
          <Script note={note} time={time} seek={seek} />
          </>}
        </section>

        {/* 가운데 리포트 */}
        <section className={`${tab === 'report' ? 'block' : 'hidden'} min-[1100px]:block @container flex-1 min-w-0 overflow-y-auto scroll-thin`}>
          <div className="sticky top-0 z-10 bg-bg flex items-center gap-1 h-12 px-3 border-b border-line">
            {!left && <button onClick={() => setLeft(true)} className={iconBtn + ' hidden min-[1100px]:grid'} title="펼치기"><ChevronsRight size={18} /></button>}
            <div className="flex rounded-lg border border-line overflow-hidden text-[14px] mr-1">
              {([['summary', FileText, '요약'], ['expand', Lightbulb, '확장']] as const).map(([k, Icon, l]) => (
                <button key={k} onClick={() => setMode(k)} className={`flex items-center gap-1.5 h-[34px] px-3.5 ${mode === k ? 'bg-subtle font-semibold' : 'text-muted'}`}><Icon size={15} />{l}</button>
              ))}
            </div>
            {mode === 'expand' && <ExpandMenu ex={ex} />}
            <LengthMenu style={style} busy={styleBusy} onPick={pickStyle} />
            <div className="ml-auto flex items-center">
              <ShareMenu id={note.id} ready={note.status === 'done' && !!r} className={iconBtn} />
              <NoteMenu id={note.id} title={note.title} collectionId={note.collection_id} canDelete={note.status !== 'processing'} className={iconBtn} onDeleted={() => nav('/library')} />
              <ThemeButton />
              {!right && <button onClick={() => setRight(true)} className={iconBtn + ' hidden min-[1100px]:grid'} title="펼치기"><ChevronsLeft size={18} /></button>}
            </div>
          </div>
          <div data-report className="max-w-[560px] mx-auto px-5 min-[1100px]:px-[60px] pb-24">
            {styleErr && <p className="mt-4 text-[14px] text-muted">{styleErr}</p>}
            {note.status !== 'done' || !r ? (
              <Progress kind={note.kind} id={note.id} initial={note.step} error={note.error} onDone={reload} />
            ) : styleBusy ? (
              <div className="pt-24 flex items-center gap-3 text-[16px]"><Loader2 size={18} className="animate-spin" />리포트를 다시 쓰는 중이에요 (30~60초)</div>
            ) : mode === 'expand' ? (
              <>
                <ExpandBody ex={ex} note={note} seek={seek}>
                <h1 className="text-[32px] font-bold leading-[1.35] mt-[88px] mb-10 break-keep">{r.title}</h1>
                <h3 className="text-[14px] font-bold mb-3">마인드맵</h3>
                <Mindmap md={md} busy={mmBusy} prog={mmProg} level={mmLevel} setLevel={setMmLevel} onRegen={genMindmap} name={note.title}
                  onSeek={(tok) => { seek(tok.includes(':') ? Number(tok.split(':')[0]) * 60 + Number(tok.split(':')[1]) : Number(tok)); if (!art && matchMedia('(max-width:1099px)').matches) setTab('video') }}
                  onAsk={(t) => rn.pick('ask', `「${t}」 이 부분 자세히 설명해줘`, '')} />
                {mmErr && <p className="mt-3 text-[14px] text-muted">{mmErr}</p>}
                </ExpandBody>
              </>
            ) : (
              <>
                <h1 className="text-[32px] font-bold leading-[1.35] mt-[88px] mb-10 break-keep">{r.title}</h1>
                <p className="text-[16px] leading-[1.85]"><RichT text={r.overview} terms={terms} seen={seen} /></p>
                <ul className="mt-5 space-y-1.5 text-[15px] list-disc pl-5 marker:text-muted">{r.key_points.map((k, i) => <li key={i}><RichT text={k} terms={terms} seen={seen} /></li>)}</ul>
                <hr className="border-line mt-8" />
                <h3 className="text-[14px] font-bold mt-14 mb-5">목차</h3>
                <nav className="border-l border-line pl-6 text-[14px] text-muted space-y-2">
                  {r.sections.map((s) => (
                    <div key={s.id} className="space-y-2">
                      <button onClick={() => goto(s.id, s.start)} className="block text-left hover:text-fg">{s.id}. {s.title}</button>
                      {s.children.map((c) => <button key={c.id} onClick={() => goto(c.id, c.start)} className="block text-left pl-2 hover:text-fg">{c.id}. {c.title}</button>)}
                    </div>
                  ))}
                </nav>
                {r.sections.map((s) => (
                  <div key={s.id} className="mt-16">
                    <h2 id={`sec-${s.id}`} className="text-[20px] font-bold scroll-mt-16 mb-6">{s.id}. {s.title}</h2>
                    {s.children.map((c) => {
                      const si = scenes.findIndex((x) => x.title.startsWith(c.id + '.'))
                      return (
                        <div key={c.id} data-sec={c.id} className="mb-10">
                          <h3 id={`sec-${c.id}`} className="text-[18px] font-bold scroll-mt-16 mb-3">{c.id}. {c.title}
                            <button onClick={() => seek(c.start)} className="text-link text-[12px] font-normal ml-1.5 hover:underline" title={art ? `문단 ${c.start}` : fmtTime(c.start)}>[{Math.min(...c.bullets.flatMap((b) => b.refs))}]</button>
                          </h3>
                          {c.scene && (
                            <div className="mb-3">
                              <button onClick={() => setLb(si)} className="block w-full">
                                <img src={sceneSrc(note.id, c.scene.file)} alt={c.title} loading="lazy" className="w-full aspect-video object-cover rounded-xl bg-subtle" />
                              </button>
                              {!art && <div className="flex justify-end mt-1"><button onClick={() => seek(c.scene!.time)} className="text-[12px] text-muted hover:text-fg">[{fmtTime(c.scene.time)}] ▶</button></div>}
                            </div>
                          )}
                          <ol className="list-decimal pl-6 space-y-2 text-[16px] leading-[1.7]">
                            {c.bullets.map((b, i) => (
                              <li key={i}><RichT text={b.text} terms={terms} seen={seen} />{b.refs.map((n) => <Ref key={n} n={n} note={note} seek={seek} />)}</li>
                            ))}
                <TermList terms={terms} />
                          </ol>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        {/* 오른쪽 채팅 자리 */}
        <section className={`${tab === 'chat' ? 'flex' : 'hidden'} ${right ? 'min-[1100px]:flex' : 'min-[1100px]:hidden'} flex-col w-full min-w-0 min-[1100px]:w-[330px] shrink-0 min-[1100px]:border-l border-line min-h-0`}>
          <div className="flex items-center h-12 px-4 border-b border-line shrink-0">
            <PanelTabs tab={rn.rtab} setTab={rn.setRtab} />
            <button onClick={() => setRight(false)} className="ml-auto text-soft hidden min-[1100px]:block" title="접기"><ChevronsRight size={18} /></button>
          </div>
          <div className={rn.rtab === 'chat' ? 'contents' : 'hidden'}><Chat note={note} seek={seek} quote={rn.quote} /></div>
          {rn.rtab === 'hl' && <HighlightPanel list={rn.list} focusId={rn.focusId} edit={rn.edit} del={rn.del} />}
        </section>
        <SelectionMenu onPick={rn.pick} />
        <HighlightLayer list={rn.list} dep={`${style}${mode}${note.status}${styleBusy}`} />
        <DeepLink seek={seek} ready={note.status === 'done'} />
      </div>

      <Lightbox open={lb !== null} index={lb ?? 0} close={() => setLb(null)} slides={scenes.map((s) => ({ src: s.src }))}
        on={{ view: ({ index }) => setLb(index) }} carousel={{ finite: true }}
        toolbar={{
          buttons: [
            !art && <button key="play" onClick={() => { const s = scenes[lb ?? 0]; if (s) { seek(s.time); setTab('video') } setLb(null) }}
              className="mr-2 h-9 px-4 rounded-full bg-accent text-[#0c0d08] text-[14px] font-bold">이 장면부터 재생</button>,
            'close',
          ],
        }} />
    </div>
  )
}
