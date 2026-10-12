# 영상노트 현황 (확장 기능 주변, 2026-10-12)

## 흐름
노트 화면(web/src/pages/Note.tsx) 3단: 왼쪽 영상·스크립트 / 가운데 리포트 「요약·확장」 + 길이 메뉴 / 오른쪽 채팅·하이라이트.
확장 탭: ExpandMenu 드롭다운(만든 확장 리포트 전환 + 「확장 리포트 추가」) → ExpandModal(카테고리 2열 카드·☆·나만의 템플릿·N개 추가) → Expand.tsx가 kind별로 그림.

## 백엔드
- backend/app/templates.py: BUILTIN 15종(강의노트·중요 인용구·액션아이템·블로그·관련 배경지식·반대 시각 조사·회의록·레시피·공부카드·마인드맵·인포그래픽·카툰·플래시카드·퀴즈) + 나만의 템플릿(data/templates.json). 결과 data/media/<id>/ext_<key>.json. kind: md|flash|quiz|infographic|mindmap|cartoon
- backend/app/ai.py `_claude()`: `claude -p --model sonnet`, 도구 없음(웹 검색 안 함). `_ask(prompt, timeout, parse, extra)`로 `--tools` 추가 가능
- backend/app/cartoon.py: 콘티(claude) → ComfyUI FLUX.2 klein 4B로 칸 그림, 그림체 고정
- backend/app/mindmap.py: 마인드맵 마크다운 생성(3단계)

## 프론트
- Infographic.tsx: JSON → React 도식 5레이아웃 전환, PNG 저장. 스타일 없음
- Cartoon.tsx: 격자·칸별 다시 그리기·PNG
- Mindmap.tsx: markmap, 전체 보기/100%/PNG
- ReportExtras.tsx: 리포트 아래 부가 요소(용어 풀이 등)
- 색·글꼴: Tailwind v4 토큰(index.css), Pretendard, 다크 모드

## 상태 유지
- 확장 리포트 결과: 파일(ext_*.json) → 새로고침·재시작 후 유지
- 크게 보기·채팅 시간 표시: localStorage

## 기존 테스트 기준 (0-3)
- verify --online 27/27 통과, 78초 (mimic/lilys-ext/baseline-verify.log)
- seed가 사용자가 지운 시험 노트(a24a…)를 못 찾아 실패 → 최근 백업에서 가져오도록 verify/run.py seed() 수정

## 이미 있는 것 vs 릴리스 (0-4)
| 릴리스 | 영상노트 |
|---|---|
| 추가 창 카테고리·☆·N개 추가 | 있음 (카테고리 구성 다름) |
| 관련 배경지식·반대 시각 조사 | 있음, 웹 검색·출처 칩·소제목 그림 없음 |
| 심화조사 | 없음 |
| 인포그래픽 | 있음(React 도식), 스타일 선택 없음 |
| 카툰 | 있음(로컬 FLUX), 스타일 선택 없음 |
| 마인드맵 | 있음, 3단계·다시 생성 버튼 없음 |
| 리포트 아래 👍👎↻·내보내기 줄·「확장」 추천 | 없음 |
| 댓글분석·PPT·애니메이션·팟캐스트·스크립트·타임스탬프·교재·보고서·사용자 인터뷰·문헌검토·투자 종목 분석·투자 방법론·논문 리뷰·말씀 | 없음 |
