import mock from './mock/note.json'

export const MOCK = import.meta.env.VITE_MOCK === '1'

export type Bullet = { text: string; refs: number[] }
export type Scene = { time: number; file: string }
export type Child = { id: string; title: string; start: number; bullets: Bullet[]; scene: Scene | null }
export type Section = { id: string; title: string; start: number; children: Child[] }
export type Note = {
  id: string; url: string; video_id: string; title: string; channel: string; thumbnail: string
  lang?: string; collection_id?: number | null
  kind?: 'video' | 'article' | 'pdf' | 'audio' | 'localvideo'; duration: number; upload_date: string; created_at: string
  status: 'processing' | 'done' | 'error'; step: string; error: string | null
  transcript: { start: number; end: number; text: string; page?: number }[]
  report: { title: string; overview: string; key_points: string[]; sections: Section[] } | null
}
export type NoteSummary = Pick<Note, 'id' | 'title' | 'channel' | 'thumbnail' | 'duration' | 'created_at' | 'status'> & { step?: string; collection_id?: number | null; kind?: Note['kind'] }

const m = mock as unknown as Note

// 처리 중인 노트는 제목·채널·날짜·대본이 아직 null → 화면이 멈추지 않게 빈 값으로 채움
const fill = <T extends Partial<Note>>(n: T): T => ({
  ...n, title: n.title ?? '영상 정보를 가져오는 중…', channel: n.channel ?? '', thumbnail: n.thumbnail ?? '',
  upload_date: n.upload_date ?? '', created_at: n.created_at ?? '', transcript: n.transcript ?? [],
})

export async function listNotes(): Promise<NoteSummary[]> {
  if (MOCK) return [m]
  const r = await fetch('/api/notes')
  if (!r.ok) throw new Error('목록을 불러오지 못했어요')
  return (await r.json()).map(fill)
}
export async function getNote(id: string): Promise<Note> {
  if (MOCK) return m
  const r = await fetch(`/api/notes/${id}`)
  if (!r.ok) throw new Error('노트를 불러오지 못했어요')
  return fill(await r.json())
}
export async function createNote(url: string): Promise<{ id: string }> {
  if (MOCK) return { id: 'mock' }
  const r = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
  if (!r.ok) throw new Error('링크를 처리하지 못했어요')
  return r.json()
}

// 장면 이미지 주소 (mock은 빈 회색)
const GRAY = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#e4e5e1"/></svg>')
export const sceneSrc = (id: string, file: string) => (MOCK ? GRAY : `/media/${id}/${file}`)

export const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
export const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([\w-]{11})/)?.[1]

// ---- 보관함·검색·재생목록 ----
async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init && { ...init, headers: { 'Content-Type': 'application/json' } })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || '요청을 처리하지 못했어요')
  return r.json()
}
const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export type Collection = { id: number; name: string; count: number }
export type SearchHit = { id: string; title: string; channel: string; thumbnail: string; created_at: string; where: string; snippet: string }
export type PlaylistPreview = { title: string; total: number; entries: { id: string; title: string; duration: number | null; thumbnail: string }[] }

export const listCollections = () => (MOCK ? Promise.resolve([]) : j<Collection[]>('/api/collections'))
export const createCollection = (name: string) => j<{ id: number }>('/api/collections', send('POST', { name }))
export const getCollection = async (id: string) => {
  const c = await j<{ id: number; name: string; notes: NoteSummary[] }>(`/api/collections/${id}`)
  return { ...c, notes: c.notes.map(fill) }
}
export const moveNote = (nid: string, collection_id: number | null) => j(`/api/notes/${nid}/collection`, send('PUT', { collection_id }))
export const search = (q: string) => j<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`)
export const previewPlaylist = (url: string) => j<PlaylistPreview>('/api/playlist/preview', send('POST', { url }))
export const createPlaylist = (title: string, videos: { id: string; title: string }[]) => j<{ collection_id: number }>('/api/playlist', send('POST', { title, videos }))
// 재생목록·채널 링크인지 (영상 ID가 있으면 영상 하나로 처리. list= 또는 /@채널, /channel/, /c/)
export const isListUrl = (u: string) => !ytId(u) && /youtube\.com\/.*[?&]list=[\w-]+|youtube\.com\/(@[^/?#]+|channel\/|c\/)/.test(u)
// 사이드바 컬렉션 목록 새로고침 신호
export const collectionsChanged = () => window.dispatchEvent(new Event('collections'))

// ---- 번역·삭제·컬렉션 관리 ----
export type Trans = { texts: string[] | null; partial: (string | null)[] | null; done: number; total: number; busy: boolean; err: string | null }
export const getTranslation = (id: string) => j<Trans>(`/api/notes/${id}/translate`)
export const translateNote = (id: string) => j<Trans>(`/api/notes/${id}/translate`, send('POST', {}))
export const deleteNote = (id: string) => j(`/api/notes/${id}`, { method: 'DELETE' })
export const renameCollection = (id: number, name: string) => j(`/api/collections/${id}`, send('PUT', { name }))
export const deleteCollection = (id: number) => j(`/api/collections/${id}`, { method: 'DELETE' })

// 휴지통·구독(릴리스 홈 배치)
export const trashList = () => j<(NoteSummary & { deleted_at: string })[]>('/api/trash')
export const restoreNote = (id: string) => j(`/api/notes/${id}/restore`, { method: 'POST' })
export const deleteForever = (id: string) => j(`/api/notes/${id}?forever=1`, { method: 'DELETE' })
export type Sub = { url: string; name: string }
export type SubVideo = { id: string; title: string; thumbnail: string; channel: string; duration: number | null }
export const listSubs = () => j<Sub[]>('/api/subs')
export const addSub = (url: string) => j<Sub[]>('/api/subs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
export const delSub = (url: string) => j<Sub[]>(`/api/subs?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
export const subVideos = () => j<SubVideo[]>('/api/subs/videos')
