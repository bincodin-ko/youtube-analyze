// 현재 탭 주소를 영상노트로 보냄. 유튜브 영상이면 영상 노트, 그 밖의 http(s) 페이지는 웹 글 노트
const $ = (id) => document.getElementById(id)
let url = new URLSearchParams(location.search).get('tab') // 확인용: 팝업을 일반 탭으로 열 때 주소 지정

async function init() {
  if (!url) url = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url
  const ok = /^https?:\/\//.test(url || '')
  $('page').textContent = ok ? url : '이 페이지는 보낼 수 없어요(http·https 페이지만)'
  $('send').disabled = !ok
}

$('send').onclick = async () => {
  $('send').disabled = true
  $('msg').textContent = '보내는 중…'
  const r = await chrome.runtime.sendMessage({ path: '/api/notes', method: 'POST', body: { url } })
  $('send').disabled = false
  if (r.off) return ($('msg').textContent = '영상노트를 먼저 켜 주세요(바탕화면 아이콘)')
  if (r.error) return ($('msg').textContent = r.error)
  const a = Object.assign(document.createElement('a'), { href: `http://127.0.0.1:${r.port}/note/${r.data.id}`, target: '_blank', textContent: '노트 열기 →' })
  $('msg').replaceChildren('보냈어요. ', a)
}
init()
