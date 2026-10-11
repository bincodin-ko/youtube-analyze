// 유튜브 영상 페이지: 플레이어 아래 "구간 스크랩" 바 + 단축키 Alt+S(시작) / Alt+E(끝)
let start = null, end = null
const video = () => document.querySelector('video.html5-main-video') || document.querySelector('video')
const vid = () => new URLSearchParams(location.search).get('v') || (location.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/) || [])[1]
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

function mark(kind) {
  const v = video()
  if (!v) return
  if (kind === 's') { start = v.currentTime; end = null } else end = v.currentTime
  render()
}

function render(msg) {
  const bar = document.getElementById('yn-bar')
  if (!bar) return
  bar.querySelector('.yn-range').textContent = msg || (start == null ? '시작 지점을 눌러 주세요' : `${fmt(start)} – ${end == null ? '?' : fmt(end)}`)
  bar.querySelector('.yn-save').disabled = start == null || end == null || end <= start
}

async function save() {
  const bar = document.getElementById('yn-bar'), memo = bar.querySelector('.yn-memo')
  const title = document.title.replace(/ - YouTube$/, '')
  const r = await chrome.runtime.sendMessage({ path: '/api/clips', method: 'POST', body: { video_id: vid(), url: `https://www.youtube.com/watch?v=${vid()}`, start, end, memo: memo.value, title } })
  if (r.off) return render('영상노트를 먼저 켜 주세요(바탕화면 아이콘)')
  if (r.error) return render(r.error)
  start = end = null; memo.value = ''
  render('저장했어요 ✓')
  setTimeout(() => render(), 2000)
}

function mount() {
  if (!vid()) return document.getElementById('yn-bar')?.remove()
  if (document.getElementById('yn-bar')) return
  const host = document.querySelector('#above-the-fold, #info-contents, ytd-watch-metadata')
  if (!host) return
  const bar = document.createElement('div')
  bar.id = 'yn-bar'
  bar.innerHTML = `<b>영상노트</b>
    <button class="yn-s" title="Alt+S">구간 시작</button><button class="yn-e" title="Alt+E">구간 끝</button>
    <span class="yn-range"></span><input class="yn-memo" placeholder="메모(선택)" maxlength="500"><button class="yn-save">스크랩 저장</button>`
  bar.querySelector('.yn-s').onclick = () => mark('s')
  bar.querySelector('.yn-e').onclick = () => mark('e')
  bar.querySelector('.yn-save').onclick = save
  host.prepend(bar)
  render()
}

addEventListener('keydown', (e) => {
  if (!e.altKey || !/^Key[SE]$/.test(e.code)) return
  e.preventDefault()
  mark(e.code === 'KeyS' ? 's' : 'e')
}, true)
setInterval(mount, 1000) // 유튜브는 페이지 이동이 SPA라 주기적으로 확인(가벼움)
