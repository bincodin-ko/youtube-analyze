// 영상노트 서버 호출은 전부 여기서(127.0.0.1만). 포트는 8765~8775 중 /api/notes가 목록([)으로 답하는 곳을 자동 탐색
let port = null

async function findPort() {
  const ok = async (p) => {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/api/notes`, { signal: AbortSignal.timeout(1500) })
      return r.ok && (await r.text()).startsWith('[')
    } catch { return false }
  }
  if (port && (await ok(port))) return port
  const { ports } = await chrome.storage.local.get('ports') // 확인용으로만 바꾸는 값(기본 8765~8775)
  for (const p of ports || Array.from({ length: 11 }, (_, i) => 8765 + i)) if (await ok(p)) return (port = p)
  return (port = null)
}

async function call({ path, method = 'GET', body }) {
  const p = await findPort()
  if (!p) return { off: true }
  const r = await fetch(`http://127.0.0.1:${p}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  return r.ok ? { data, port: p } : { error: data.detail || '요청을 처리하지 못했어요', port: p }
}

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  call(msg).then(send).catch((e) => send({ error: String(e) }))
  return true // 비동기 응답
})
