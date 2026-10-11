import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppWindow, ArrowLeft, Film, FileText, ListVideo, Loader2, Play, Upload, X } from 'lucide-react'
import { collectionsChanged, createNote, createPlaylist, fmtTime, isListUrl, previewPlaylist, ytId, type PlaylistPreview } from '../api'

// 파일 올리기: fetch는 진행률이 없어 XHR 사용 (POST /api/upload, multipart)
const ACCEPT = { pdf: '.pdf', file: '.mp3,.m4a,.wav,.flac,.ogg,.aac,.mp4,.mkv,.mov,.webm,.avi' }
function upload(f: File, onPct: (p: number) => void): Promise<{ id: string }> {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(), fd = new FormData()
    fd.append('file', f)
    x.open('POST', '/api/upload')
    x.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100))
    x.onload = () => x.status === 200 ? res(JSON.parse(x.responseText)) : rej(new Error((() => { try { return JSON.parse(x.responseText).detail } catch { return '' } })() || '파일을 올리지 못했어요'))
    x.onerror = () => rej(new Error('파일을 올리지 못했어요'))
    x.send(fd)
  })
}
const sizeStr = (b: number) => b > 1e6 ? `${(b / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1e3))}KB`

export default function New() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'yt' | 'web' | 'pdf' | 'file'>('yt')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [pct, setPct] = useState(0)
  const [drag, setDrag] = useState(false)
  const pick = useRef<HTMLInputElement>(null)
  const isFile = tab === 'pdf' || tab === 'file'
  const [err, setErr] = useState('')
  const [pl, setPl] = useState<PlaylistPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const u = url.trim()
  const list = tab === 'yt' && isListUrl(u)
  const ok = isFile ? !!file : tab === 'web' ? /^https?:\/\/\S+\.\S+/.test(u) : pl ? pl.entries.length > 0 : !list && !!ytId(u)

  // 재생목록·채널 링크면 영상 목록을 미리 받아 칩 + 목록으로 보여 줌
  useEffect(() => {
    if (!list) return
    let alive = true
    setLoading(true); setErr('')
    previewPlaylist(u).then((p) => alive && (setPl(p), setUrl(''))).catch((e) => alive && setErr(e.message)).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [u, list])

  const go = async () => {
    if (!ok || busy) return
    setBusy(true); setErr('')
    try {
      if (file) nav(`/note/${(await upload(file, setPct)).id}`)
      else if (pl) {
        const { collection_id } = await createPlaylist(pl.title, pl.entries)
        collectionsChanged()
        nav(`/collection/${collection_id}`)
      } else nav(`/note/${(await createNote(u)).id}`)
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  return (
    <div className="min-h-screen bg-subtle px-4 pb-16">
      <button onClick={() => nav(-1)} className="absolute top-5 left-5 flex items-center gap-2 h-9 pl-3 pr-4 rounded-lg bg-bg border border-line text-[15px]"><ArrowLeft size={18} strokeWidth={1.5} />뒤로 가기</button>
      <div className="max-w-[700px] mx-auto pt-[80px]">
        <h1 className="text-center text-[36px] font-extrabold leading-tight">자료 가져오기</h1>
        <div className="flex flex-wrap justify-center gap-2 mt-7">
          {([['yt', Play, '유튜브'], ['pdf', FileText, 'PDF'], ['web', AppWindow, '웹사이트'], ['file', Film, '영상/음성 파일']] as const).map(([k, Icon, l]) => (
            <button key={k} onClick={() => { setTab(k); setUrl(''); setErr(''); setPl(null); setFile(null); setPct(0) }}
              className={`flex items-center gap-2 h-12 px-5 rounded-full whitespace-nowrap text-[15px] font-bold border ${tab === k ? 'bg-fg text-bg border-fg' : 'bg-bg border-line'}`}><Icon size={17} />{l}</button>
          ))}
        </div>
        {isFile ? (
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f && !busy) { setFile(f); setErr('') } }}
            onClick={() => !busy && pick.current?.click()}
            className={`mt-7 h-[200px] rounded-xl border-2 border-dashed bg-bg grid place-items-center text-center cursor-pointer ${drag ? 'border-fg' : 'border-line'}`}>
            <input ref={pick} type="file" hidden accept={ACCEPT[tab]} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setErr('') } e.target.value = '' }} />
            {file ? (
              <div className="w-full px-8">
                <span className="inline-flex items-center gap-2 max-w-full h-9 pl-3 pr-1.5 rounded-full bg-subtle text-[14px] font-semibold">
                  {tab === 'pdf' ? <FileText size={16} className="shrink-0" /> : <Film size={16} className="shrink-0" />}<span className="truncate">{file.name}</span>
                  <span className="text-muted font-normal shrink-0">{sizeStr(file.size)}</span>
                  {!busy && <button onClick={(e) => { e.stopPropagation(); setFile(null) }} title="지우기" className="grid place-items-center size-6 rounded-full hover:bg-bg shrink-0"><X size={14} /></button>}
                </span>
                {busy && <div className="mt-4 mx-auto max-w-[360px]"><div className="h-2 rounded-full bg-subtle overflow-hidden"><div className="h-full bg-fg transition-all" style={{ width: `${pct}%` }} /></div><p className="mt-2 text-[13px] text-muted">{pct < 100 ? `올리는 중… ${pct}%` : '준비 중…'}</p></div>}
              </div>
            ) : (
              <div><Upload size={28} strokeWidth={1.5} className="mx-auto text-muted" /><p className="mt-3 text-[15px] font-semibold">{tab === 'pdf' ? 'PDF 파일을 끌어다 놓으세요' : '영상·음성 파일을 끌어다 놓으세요'}</p><p className="mt-1 text-[13px] text-muted">또는 눌러서 파일 선택</p></div>
            )}
          </div>
        ) : tab === 'yt' && pl ? (
          <div className="mt-7 rounded-xl border border-line bg-bg p-2.5">
            <span className="inline-flex items-center gap-2 max-w-full h-9 pl-3 pr-1.5 rounded-full bg-subtle text-[14px] font-semibold">
              <ListVideo size={16} className="shrink-0" /><span className="truncate">{pl.title}</span>
              <span className="text-muted font-normal shrink-0">{pl.entries.length}개</span>
              <button onClick={() => setPl(null)} title="지우기" className="grid place-items-center size-6 rounded-full hover:bg-bg shrink-0"><X size={14} /></button>
            </span>
            <ul className="mt-2 max-h-[340px] overflow-y-auto scroll-thin">
              {pl.entries.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 py-1.5 px-1">
                  <span className="w-5 text-right text-[13px] text-muted shrink-0">{i + 1}</span>
                  <img src={e.thumbnail} alt="" className="w-[72px] aspect-video rounded object-cover bg-subtle shrink-0" />
                  <span className="flex-1 min-w-0 text-[14px] truncate">{e.title}</span>
                  {e.duration != null && <span className="text-[13px] text-muted shrink-0">{fmtTime(e.duration)}</span>}
                  <button onClick={() => setPl({ ...pl, entries: pl.entries.filter((x) => x.id !== e.id) })} title="빼기" className="grid place-items-center size-7 rounded-md text-muted hover:bg-subtle shrink-0"><X size={15} /></button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} autoFocus
            placeholder={tab === 'web' ? 'https://...' : 'https://youtube.com/watch?v=abc'}
            className="mt-7 w-full h-[46px] px-[10px] rounded-xl border border-line bg-bg text-[16px] outline-none focus:border-fg placeholder:text-muted" />
        )}
        {loading && <p className="mt-3 flex items-center justify-center gap-2 text-[14px] text-muted"><Loader2 size={15} className="animate-spin" />재생목록을 불러오는 중…</p>}
        {err && <p className="mt-3 text-[14px] text-center text-muted">{err}</p>}
        {ok && (
          <div className="flex justify-center mt-6">
            <button onClick={go} disabled={busy} className="h-12 px-8 rounded-xl bg-fg text-bg text-[16px] font-bold disabled:opacity-60">{busy ? '준비 중…' : pl ? `${pl.entries.length}개 소화하기` : '소화하기'}</button>
          </div>
        )}
        {tab === 'pdf' ? (
          <ul className="mt-6 space-y-1 text-[13px] text-muted list-disc pl-5">
            <li>글자가 들어 있는 PDF를 올려 주세요. 쪽별 본문을 읽어 리포트로 정리해요.</li>
            <li>스캔본·이미지로만 된 PDF는 글자를 읽을 수 없어요.</li>
          </ul>
        ) : tab === 'file' ? (
          <ul className="mt-6 space-y-1 text-[13px] text-muted list-disc pl-5">
            <li>mp3·m4a·wav 같은 음성, mp4·mkv·mov 같은 영상 파일을 올릴 수 있어요.</li>
            <li>음성을 받아써서 리포트로 정리해요. 영상은 장면도 함께 고르고, 노트에서 바로 재생해요.</li>
            <li>파일은 이 PC에만 저장되고, 노트를 지우면 같이 지워져요.</li>
          </ul>
        ) : tab === 'web' ? (
          <ul className="mt-6 space-y-1 text-[13px] text-muted list-disc pl-5">
            <li>뉴스 기사·블로그 글 같은 웹페이지 링크를 넣어 주세요. 본문을 읽어 리포트로 정리해요.</li>
            <li>외국어 글도 한국어로 정리해요. 본문 속 이미지도 함께 가져와요.</li>
            <li>로그인이 필요하거나 유료인 기사는 가져올 수 없어요.</li>
          </ul>
        ) : (
        <ul className="mt-6 space-y-1 text-[13px] text-muted list-disc pl-5">
          <li>영상 링크 하나, 또는 재생목록·채널 링크를 넣을 수 있어요.</li>
          <li>재생목록·채널은 앞에서부터 한 번에 10개까지 가져와요{pl && pl.total > 10 ? ` (전체 ${pl.total}개)` : ''}.</li>
          <li>영상마다 노트가 하나씩 만들어지고, 재생목록 이름의 컬렉션에 묶여요.</li>
          <li>노트는 순서대로 하나씩 처리돼요. 짧은 영상은 1~3분쯤 걸려요.</li>
        </ul>
        )}
      </div>
    </div>
  )
}
