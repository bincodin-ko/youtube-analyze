"""확장 리포트 템플릿: 프롬프트 한 덩어리씩(dict) + 나만의 템플릿(data/templates.json) + 생성.
결과는 data/media/<id>/ext_<key>.json. kind: md(마크다운 계열 블록) | flash(플래시카드) | quiz(퀴즈)."""
import json, re, uuid
from pathlib import Path
from app import ai

from app.paths import DATA
CUSTOM = DATA / "templates.json"

MD_FORMAT = """JSON 객체 하나만 출력(설명·코드펜스 금지):
{"title":"결과 제목","blocks":[{"heading":"소제목","bullets":[{"text":"한 문장(**핵심어**는 굵게)","refs":[대본 줄 인덱스]}]}]}
모든 글은 한국어. refs는 근거가 되는 대본 줄 인덱스 1~3개(실제 존재하는 번호만, 근거가 없으면 []). blocks 3~7개, block마다 bullets 2~6개."""

# 웹 조사형(배경지식·반대 시각·심화조사): claude가 WebSearch/WebFetch로 찾아 bullet마다 출처 URL을 붙인다(읽기만)
WEB_FORMAT = """먼저 WebSearch로 관련 자료를 찾아보고(필요하면 WebFetch로 열어 확인) 그 내용을 근거로 써라. 찾은 웹 자료는 bullet의 src에 붙인다.
JSON 객체 하나만 출력(설명·코드펜스 금지):
{"title":"결과 제목","blocks":[{"heading":"소제목","illust":"이 소제목을 표현할 삽화 장면을 영어 한 문장으로(글자 없음)","bullets":[{"text":"문장(**핵심어**는 굵게)","refs":[대본 줄 인덱스],"src":[{"url":"https://...","title":"페이지 제목"}]}]}]}
모든 글은 한국어. refs는 대본 근거 줄 인덱스(없으면 []), src는 실제로 열어 본 웹 페이지만(없으면 []). URL을 지어내지 않는다."""
WEB_KEYS = ("background", "counter", "deep")

# 스타일 선택(릴리스 「인포그래픽 스타일 선택」과 같은 6종). 화면 테마는 web/src/components/Infographic.tsx THEMES
INFO_STYLES = {"onepager": "한 페이지 요약", "colorful": "창의적이고 밝은", "scientific": "학술적·데이터 중심", "handwriting": "스케치·손그림 느낌",
               "minimal": "심플하고 깔끔한", "corporate": "전문적·공식적인"}

ICONS = "lightbulb target rocket users clock chart trending-up shield heart star book brain search settings wallet zap flag check-circle alert-triangle message-circle globe layers puzzle repeat award coins smile"
LAYOUTS = ("steps", "compare", "stats", "timeline", "cycle")

# key -> 이름·분류·카드 설명·kind·지시문
BUILTIN = {
    "lecture": dict(name="강의노트", cat="추천", desc="수업 필기처럼 개념·예시·정리 순서로", kind="md",
                    prompt="이 내용을 학생의 강의노트로 정리하라. blocks는 '핵심 개념', '세부 설명과 예시', '용어 정리', '한 줄 복습' 순서로 구성한다."),
    "quote": dict(name="중요 인용구", cat="추천", desc="기억할 만한 말을 그대로 뽑아서", kind="md",
                  prompt="대본에서 기억할 만한 인용구 6~10개를 골라라. 각 block은 주제 하나이며 bullet.text는 대본 표현을 거의 그대로 살린 따옴표 문장 뒤에 한 줄 맥락 설명을 덧붙인다."),
    "action": dict(name="내 액션아이템 도출", cat="추천", desc="바로 해볼 일을 우선순위로", kind="md",
                   prompt="이 내용에서 시청자가 실제로 실행할 수 있는 액션아이템을 도출하라. blocks는 '지금 바로(오늘)', '이번 주', '장기 과제' 순이며 각 bullet은 '동사로 시작하는 구체적 행동 + 왜 하는지'로 쓴다."),
    "blog": dict(name="블로그", cat="추천", desc="그대로 올릴 수 있는 글 형태로", kind="md",
                 prompt="이 내용을 블로그 게시글로 다시 써라. title은 클릭하고 싶은 제목. blocks는 '도입', 본문 소제목 2~4개, '마무리' 순서이고 bullet은 문단처럼 자연스럽게 이어지는 서술 문장으로 쓴다."),
    "background": dict(name="관련 배경지식", cat="더 깊이 이해하기", desc="이 내용을 이해하는 데 필요한 맥락", kind="md",
                       prompt="이 내용에 등장하는 핵심 인물·회사·사건·개념의 배경지식을 웹에서 조사해 설명하라. blocks는 3~5개이고 heading은 'Stuart Gardoll: OpenDesign을 이끄는 AI 엔지니어'처럼 '대상: 한 줄 설명' 형태. 각 block의 bullets는 2~4문장으로 그 대상이 무엇인지와 이 영상 내용과 어떻게 이어지는지를 쓴다."),
    "counter": dict(name="반대 시각 조사", cat="더 깊이 이해하기", desc="다른 의견과 반론, 한계점", kind="md",
                    prompt="이 내용의 주장에 대한 반대 시각·반론·한계를 웹에서 조사해 균형 있게 정리하라. title은 '반대 시각 조사: (주제 한 줄)'. 첫 block의 heading은 '원본 자료의 주장'이고 화자의 주장을 2~3문장(refs 필수)으로 요약한다. 그 뒤 block 3개의 heading은 '1. 반론 제목: 한 줄 요지', '2. ...', '3. ...'처럼 번호를 붙이고 bullets에 근거와 사례를 쓴다. 근거 없는 수치를 지어내지 않는다."),
    "deep": dict(name="심화조사", cat="더 깊이 이해하기", desc="자료와 연결된 추가 리서치", kind="md",
                 prompt="이 자료를 더 깊이 이해하기 위한 심화 조사 노트를 만들어라. title은 '심화 조사 노트'. blocks는 정확히 3개: '1. 서론'(이 자료의 가치와 더 알아봐야 할 지점 2~3문장), '2. 추가 리서치 주제'(더 조사할 질문 3개, bullet 하나가 질문 하나), '3. 추가 리서치 자료 목록'(웹에서 찾은 참고 자료 3~6개, bullet마다 자료 한 줄 소개 + src 필수)."),
    "minutes": dict(name="회의록", cat="노트 형식", desc="안건·논의·결정·할 일 형식", kind="md",
                    prompt="이 내용을 회의록 형식으로 정리하라. blocks는 '개요', '주요 논의', '결정 사항', '후속 할 일' 순서."),
    "recipe": dict(name="레시피", cat="노트 형식", desc="재료와 순서가 있는 요리법·절차", kind="md",
                   prompt="이 내용을 레시피(따라 하는 절차) 형식으로 정리하라. blocks는 '준비물(재료·도구)', '단계별 순서'(bullet 하나가 한 단계), '주의할 점'. 요리가 아니면 작업 절차로 해석한다."),
    "study": dict(name="공부카드", cat="노트 형식", desc="시험 대비 요점 카드 모음", kind="md",
                  prompt="시험 대비용 공부카드 8~12개로 정리하라. 각 block의 heading은 개념 이름, bullets는 정의 1개와 외울 포인트 1~2개."),
    # ---- 그 외(릴리스 「접기」 칸, 2026-10-13) — 결과 형식은 릴리스 고객센터 설명 기준(추측) ----
    "script": dict(name="스크립트", cat="그 외", desc="전체 대화를 문단으로 읽기 좋게", kind="md", prompt=""),  # AI 없이 대본을 묶음(script_blocks)
    "timestamp": dict(name="타임스탬프", cat="그 외", desc="시간순 목차", kind="md",
                      prompt="이 내용을 시간순 목차(타임스탬프)로 정리하라. block 하나가 큰 구간이고 heading은 구간 제목, bullets는 그 구간의 세부 장면 2~5개를 한 줄씩(refs에 그 장면이 시작하는 대본 줄 1개 필수). 영상 전체를 빠짐없이 덮는다."),
    "textbook": dict(name="교재", cat="그 외", desc="학습 목표·본문·정리·확인 문제", kind="md",
                     prompt="이 내용을 교재 한 단원으로 만들어라. blocks는 '학습 목표', 본문 소단원 2~4개(개념 설명과 예시), '핵심 정리', '확인 문제'(문제 3~5개, 각 bullet 끝에 '(답: …)') 순서."),
    "report": dict(name="보고서", cat="그 외", desc="개요·현황·분석·제언", kind="md",
                   prompt="이 내용을 업무 보고서로 정리하라. blocks는 '요약(결론 먼저)', '배경', '주요 내용', '분석·시사점', '제언(다음 할 일)' 순서. 문장은 '~함', '~임'으로 끝나는 보고서체."),
    "interview": dict(name="사용자 인터뷰", cat="그 외", desc="인터뷰 결과를 표로 비교", kind="md", table=True,
                      prompt="이 내용을 사용자 인터뷰 분석으로 정리하라. 첫 block은 '인터뷰 개요'. 그다음 block 'table'에 응답자(또는 화자)별 비교표를 넣는다(cols 예: 응답자·주요 니즈·불편·인용). 이어서 '공통 인사이트', '제품 제안' block."),
    "litreview": dict(name="문헌검토", cat="그 외", desc="선행연구를 주제별로 정리", kind="md",
                      prompt="이 자료를 문헌검토 형식으로 정리하라. blocks는 '연구 질문', 주제별 선행 논의 2~4개(누가 무엇을 주장했는지), '연구 간 공통점·차이', '남은 연구 공백' 순서."),
    "stock": dict(name="투자 종목 분석", cat="그 외", desc="실적·산업·전망을 표로", kind="md", table=True,
                  prompt="이 내용을 투자 관점에서 분석하라. 첫 block은 '한 줄 결론'. 그다음 block 'table'에 언급된 종목·자산별 표(cols 예: 종목·근거·리스크·전망)를 넣는다. 이어서 '산업 동향', '체크포인트', '유의사항(투자 권유 아님)' block. 대본에 없는 숫자는 쓰지 않는다."),
    "investmethod": dict(name="투자 방법론", cat="그 외", desc="투자 전략을 단계별로", kind="md",
                         prompt="이 내용에 나온 투자 방법·전략을 배우기 쉽게 정리하라. blocks는 '핵심 원칙', '실행 단계'(bullet 하나가 한 단계), '자주 하는 실수', '적용 체크리스트', '유의사항(투자 권유 아님)' 순서."),
    "paperreview": dict(name="논문 리뷰", cat="그 외", desc="핵심 기여·방법론·한계", kind="md",
                        prompt="이 내용을 논문 리뷰 형식으로 정리하라. blocks는 '한 줄 요약', '연구 배경·문제', '핵심 기여', '방법론', '결과', '한계와 비판', '더 읽어 볼 질문' 순서. 어려운 용어는 괄호로 쉽게 풀어 쓴다."),
    "sermon": dict(name="말씀", cat="그 외", desc="설교·강연을 본문·요지·적용으로", kind="md",
                   prompt="이 내용을 설교(말씀) 노트로 정리하라. blocks는 '본문·주제', '핵심 메시지', 대지(요점) 2~4개, '삶에 적용하기', '기도·묵상 포인트' 순서. 인용된 구절은 그대로 살린다."),
    "comments": dict(name="댓글분석", cat="더 깊이 이해하기", desc="시청자 반응과 여론", kind="md", prompt=""),  # 유튜브 댓글을 읽어 분석(comments.py)
    "ppt": dict(name="PPT", cat="시각자료", desc="발표용 슬라이드 덱", kind="ppt", prompt=""),  # 생성은 ppt.py
    # 릴리스 「애니메이션」(크레딧으로 확인 2026-10-12): 쉬운 말 리포트 + 소제목마다 움직이는 SVG 도식
    "animation": dict(name="애니메이션", cat="시각자료", desc="움직이는 도식으로 쉽게", kind="anim",
                      prompt="""이 내용을 중학생도 이해할 쉬운 말과 비유로 설명하는 리포트를 만들어라. 소제목은 정확히 3개('1. ...', '2. ...', '3. ...' 번호 포함, 흥미를 끄는 문장형).
소제목마다 그 개념을 보여 주는 움직이는 SVG 도식 1개를 직접 그린다: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450">, 배경 #f7f7f5, 위쪽에 굵은 한국어 제목 text, 상자(rect rx)·원·화살표(line/path)로 관계를 그리고 <animate>/<animateMotion>/<animateTransform>(repeatCount="indefinite")으로 흐름을 따라 점이 움직이거나 강조가 깜박이게 한다. 글자는 짧게(한 줄 12자 이내), 색은 #6663fd·#222·#999 위주. <script>·이벤트 속성·외부 링크·이미지·foreignObject 금지.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"title":"제목","intro":"도입 2~3문장","blocks":[{"heading":"1. 소제목","bullets":[{"text":"쉬운 설명 문장(**핵심어** 굵게)","refs":[대본 줄 인덱스]}],"svg":"<svg ...>...</svg>"}]}
한국어. refs는 실제 존재하는 대본 줄 인덱스 1~2개."""),
    # 릴리스 「팟캐스트」(크레딧으로 확인): 음성 없이 해설자 1명이 말하는 문단들. 음성은 우리가 Edge로 추가(podcast.py)
    "podcast": dict(name="팟캐스트", cat="이해 점검하기", desc="해설자가 들려주는 대화형 정리", kind="podcast",
                    prompt="""이 내용을 팟캐스트 해설로 다시 써라. 해설자는 한 명(한국 이름과 역할, 예: 김민준 · AI 기술 해설가). 듣는 사람에게 말하듯 존댓말 구어체.
구성: 인사와 오늘의 주제 → 오늘 다룰 내용 목록(list, 3~5개, '주제: 한 줄 설명') → 본문 문단 8~12개(예시·비유 포함) → 요약과 마무리 인사.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"title":"에피소드 제목","host":{"name":"이름","role":"역할"},"paras":[{"text":"문단(**핵심어** 굵게)","list":["목록이 필요할 때만"],"refs":[대본 줄 인덱스]}]}
한국어. 대본에 없는 사실을 지어내지 않는다."""),
    "mindmap": dict(name="마인드맵", cat="시각자료", desc="핵심 구조를 한눈에 가지로", kind="mindmap", prompt=""),
    "infographic": dict(name="인포그래픽", cat="시각자료", desc="핵심을 한 장의 도식 포스터로", kind="infographic",
                        prompt="""이 내용을 한 장짜리 인포그래픽(세로 포스터)용 데이터로 만들어라. 그림이 아니라 JSON만 만든다.
layout은 내용에 가장 맞는 하나: steps(순서·절차) | compare(둘 이상의 비교·장단점) | stats(핵심 수치·사실) | timeline(시간 흐름) | cycle(되풀이되는 순환).
JSON 객체 하나만 출력(설명·코드펜스 금지): {"title":"제목 25자 이내","subtitle":"부제 40자 이내","layout":"steps","blocks":[{"icon":"아이콘","heading":"소제목 15자 이내","text":"1~2문장","stat":"큰 숫자·키워드(없으면 빈 문자열, 예 85%, 3배)","ref":대본 줄 인덱스}],"takeaway":"하단 한 줄 결론"}
blocks는 4~6개(compare는 2~4개). icon은 다음 중에서만: """ + ICONS + """. 한국어. stats 레이아웃은 모든 block에 stat 필수. 대본에 없는 수치를 지어내지 않는다. ref는 실제 존재하는 대본 줄 인덱스 정수 하나."""),
    "cartoon": dict(name="카툰", cat="시각자료", desc="4~8칸 만화로 이야기처럼", kind="cartoon", prompt=""),  # 생성은 cartoon.py
    "flash": dict(name="플래시카드", cat="이해 점검하기", desc="앞면 질문, 뒷면 답으로 복습", kind="flash",
                  prompt="""이 내용으로 복습용 플래시카드 10~14장을 만들어라. 앞면은 짧은 질문, 뒷면은 1~2문장 답.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"title":"제목","cards":[{"q":"질문","a":"답","refs":[대본 줄 인덱스]}]}
한국어. refs는 근거 대본 줄 인덱스 1~2개(실제 존재하는 번호만)."""),
    "quiz": dict(name="퀴즈", cat="이해 점검하기", desc="4지선다로 이해도 확인", kind="quiz",
                 prompt="""이 내용을 얼마나 이해했는지 확인하는 객관식 4지선다 퀴즈 8문항을 만들어라. 정답 위치(0~3)는 골고루 섞고, 오답은 그럴듯하되 명확히 틀려야 한다.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"title":"제목","questions":[{"q":"문제","choices":["보기1","보기2","보기3","보기4"],"answer":정답 인덱스 0~3,"explain":"해설 1~2문장","refs":[대본 줄 인덱스]}]}
한국어. refs는 근거 대본 줄 인덱스 1~2개(실제 존재하는 번호만)."""),
}


def load_custom() -> list:
    try: return json.loads(CUSTOM.read_text(encoding="utf-8"))
    except (OSError, ValueError): return []


def save_custom(items: list) -> None:
    CUSTOM.parent.mkdir(parents=True, exist_ok=True)
    CUSTOM.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")


def listing() -> dict:
    """화면용 목록. 나만의 템플릿 key는 'c_xxxx'."""
    return {"builtin": [{"key": k, "name": v["name"], "cat": v["cat"], "desc": v["desc"], "kind": v["kind"]} for k, v in BUILTIN.items()],
            "custom": load_custom()}


def get(key: str) -> dict | None:
    if key in BUILTIN: return BUILTIN[key]
    c = next((x for x in load_custom() if x["key"] == key), None)
    return {**c, "kind": "md", "prompt": c["prompt"]} if c else None


def new_custom(name: str, prompt: str) -> dict:
    item = {"key": "c_" + uuid.uuid4().hex[:8], "name": name.strip(), "prompt": prompt.strip()}
    save_custom([*load_custom(), item])
    return item


def path(media: Path, nid: str, key: str) -> Path:
    return media / nid / f"ext_{key}.json"


TABLE_HINT = """
표가 필요한 block은 bullets 대신(또는 함께) "table":{"cols":["열1","열2"],"rows":[["칸","칸"]]} 를 넣는다(열 2~5개, 행 2~10개, 칸은 짧게)."""


def _table(t) -> dict | None:
    """표: 열 2~6개, 행마다 열 수를 맞춘다. 형식이 틀리면 None."""
    if not isinstance(t, dict) or not isinstance(t.get("cols"), list) or not isinstance(t.get("rows"), list): return None
    cols = [str(c) for c in t["cols"]][:6]
    if len(cols) < 2: return None
    rows = [[str(c) for c in (r + [""] * len(cols))[:len(cols)]] for r in t["rows"] if isinstance(r, list)][:20]
    return {"cols": cols, "rows": rows} if rows else None


def script_blocks(note: dict) -> dict:
    """「스크립트」: AI 없이 대본 전체를 약 3분(글은 12문단) 단위 문단으로 묶는다. 문단마다 시작 줄을 refs로."""
    tr = note["transcript"]; art = note.get("kind") in ("article", "pdf")
    blocks, cur, start = [], [], 0
    for i, s in enumerate(tr):
        if cur and ((i - start >= 12) if art else (s["start"] - tr[start]["start"] >= 180)):
            blocks.append((start, cur)); cur, start = [], i
        cur.append(s["text"].strip())
    if cur: blocks.append((start, cur))
    head = (lambda i: f"{i + 1}번째 문단부터") if art else (lambda i: ai._mmss(tr[i]["start"]))
    return {"kind": "md", "title": f"스크립트: {note.get('title', '')}".strip(),
            "blocks": [{"heading": head(i), "bullets": [{"text": " ".join(c), "refs": [i]}]} for i, c in blocks]}


def _comments(note: dict) -> dict:
    """「댓글분석」: 유튜브 공개 댓글(좋아요 순 최대 150개)을 읽어 여론·주요 의견·질문을 정리."""
    from app import comments
    if note.get("kind") != "video" or "youtu" not in (note.get("url") or ""):
        raise ValueError("댓글분석은 유튜브 영상 노트에서만 할 수 있어요")
    cs = comments.fetch(note["url"])
    if not cs: raise ValueError("이 영상에는 읽을 수 있는 댓글이 없어요")
    rep = note.get("report") or {}
    prompt = ("너는 유튜브 댓글 여론을 분석하는 편집자다. 영상 요지와 댓글 목록(좋아요 수 포함)을 보고 시청자 반응을 정리하라.\n"
              "blocks는 '전체 분위기'(긍정·부정·중립 비율을 대략 %로, 근거 포함), '많이 공감받은 의견'(댓글 표현을 살린 요약 3~5개, 끝에 (좋아요 n)), "
              "'비판·반론', '시청자 질문', '제작자에게 주는 시사점' 순서. 댓글에 없는 내용을 지어내지 않는다. refs는 모두 [].\n" + MD_FORMAT +
              f"\n\n영상 제목: {rep.get('title') or note.get('title')}\n영상 요지: {rep.get('overview', '')}\n\n댓글({len(cs)}개):\n" +
              "\n".join(f"- (좋아요 {c['likes']}) {c['text'][:300]}" for c in cs))

    def parse(r):
        bl = [{"heading": b["heading"], "bullets": [{"text": x["text"], "refs": []} for x in b["bullets"] if x.get("text")]} for b in r["blocks"]]
        bl = [b for b in bl if b["bullets"]]
        if not bl: raise ValueError("내용 없음")
        return {"kind": "md", "title": str(r.get("title") or "댓글분석"), "blocks": bl, "count": len(cs)}
    return ai._ask(prompt, 180, parse)


def clean_svg(s: str) -> str:
    """AI가 그린 SVG에서 실행·외부 요소를 뺀다(화면에서는 <img>로만 그려 스크립트가 원래 돌지 않지만 이중 안전)."""
    s = str(s).strip()
    m = re.search(r"<svg\b.*?</svg>", s, re.S | re.I)
    if not m: return ""
    s = m.group(0)
    s = re.sub(r"<(script|foreignObject|iframe|image|use)\b.*?(</\1>|/>)", "", s, flags=re.S | re.I)
    s = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*')", "", s, flags=re.I)
    s = re.sub(r"\s(xlink:)?href\s*=\s*(\"(?!#)[^\"]*\"|'(?!#)[^']*')", "", s, flags=re.I)
    if "xmlns=" not in s[:200]: s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    return s[:60000]


def _src(x) -> list:
    """웹 출처: http(s) URL만, 최대 3개."""
    out = []
    for u in x.get("src") or []:
        url = str(u.get("url", "") if isinstance(u, dict) else u)
        if re.match(r"https?://[^\s]+$", url): out.append({"url": url, "title": str(u.get("title") or "") if isinstance(u, dict) else ""})
    return out[:3]


def generate(note: dict, key: str, opts: dict | None = None) -> dict:
    """템플릿 지시문 + 대본 → 결과 JSON(kind 포함). refs는 대본 범위 안의 정수만 남긴다.
    opts: style(인포그래픽 스타일 키), extra(사용자 추가 지시). 배경지식·반대 시각·심화조사는 웹 검색(실패하면 웹 없이, noweb 표시)."""
    opts = opts or {}
    t = get(key)
    tr = note["transcript"]
    n = len(tr)
    web = key in WEB_KEYS
    if key == "script": return script_blocks(note)
    if key == "comments": return _comments(note)
    body = t["prompt"] if t["kind"] != "md" or key in BUILTIN else \
        f"다음은 사용자가 만든 나만의 템플릿 지시문이다. 이 지시를 충실히 따라 결과를 만들어라.\n지시문: {t['prompt']}"
    style = opts.get("style") if opts.get("style") in INFO_STYLES else "onepager"
    if t["kind"] == "infographic":
        body += f"\n스타일: {INFO_STYLES[style]} 인포그래픽에 어울리는 어조와 분량으로 쓴다."
    if (opts.get("extra") or "").strip():
        body += "\n사용자 추가 요청(위 형식 규칙 안에서 반영): " + str(opts["extra"]).strip()[:500]
    fmt = "" if t["kind"] != "md" else "\n" + (WEB_FORMAT if web else MD_FORMAT) + (TABLE_HINT if t.get("table") else "")

    def build(fmt):
        head = ai._kind(note, "너는 영상 대본을 바탕으로 요청된 형식의 학습 자료를 만드는 편집자다. 대본은 한 줄이 `[인덱스 mm:ss] 텍스트` 형식이다(해외 영상이면 번역해서 쓴다).\n" + body + fmt + "\n\n대본:\n")
        return head + "\n".join(f"[{i} {ai._mmss(s['start'])}] {s['text']}" for i, s in enumerate(tr))

    def refs(x): return [i for i in x.get("refs", []) if isinstance(i, int) and 0 <= i < n]

    def parse(r):
        out = {"kind": t["kind"], "title": str(r.get("title") or t["name"])}
        if t["kind"] == "flash":
            out["cards"] = [{"q": c["q"], "a": c["a"], "refs": refs(c)} for c in r["cards"] if c.get("q") and c.get("a")]
            if len(out["cards"]) < 3: raise ValueError("카드 부족")
        elif t["kind"] == "infographic":
            bl = [{"icon": str(b.get("icon", "")), "heading": str(b["heading"]), "text": str(b["text"]), "stat": str(b.get("stat") or ""),
                   "ref": b["ref"] if isinstance(b.get("ref"), int) and 0 <= b["ref"] < n else None} for b in r["blocks"] if b.get("heading") and b.get("text")]
            if len(bl) < 2: raise ValueError("블록 부족")
            out.update(subtitle=str(r.get("subtitle") or ""), layout=r["layout"] if r.get("layout") in LAYOUTS else "steps", blocks=bl[:6], takeaway=str(r.get("takeaway") or ""), style=style, extra=str(opts.get("extra") or "")[:500])
        elif t["kind"] == "podcast":
            h = r.get("host") or {}
            ps = [{"text": str(p["text"]), "list": [str(x) for x in p.get("list") or []][:6], "refs": refs(p)} for p in r["paras"] if p.get("text")]
            if len(ps) < 4: raise ValueError("문단 부족")
            out.update(host={"name": str(h.get("name") or "진행자")[:10], "role": str(h.get("role") or "해설가")[:20]}, paras=ps[:20])
        elif t["kind"] == "anim":
            bl = [{"heading": str(b["heading"]), "bullets": [{"text": x["text"], "refs": refs(x)} for x in b.get("bullets") or [] if x.get("text")], "svg": clean_svg(b.get("svg") or "")} for b in r["blocks"] if b.get("heading")]
            if len(bl) < 2 or not any(b["svg"] for b in bl): raise ValueError("도식 부족")
            out.update(intro=str(r.get("intro") or ""), blocks=bl[:4])
        elif t["kind"] == "quiz":
            qs = [{"q": c["q"], "choices": c["choices"][:4], "answer": c["answer"], "explain": c.get("explain", ""), "refs": refs(c)}
                  for c in r["questions"] if c.get("q") and isinstance(c.get("choices"), list) and len(c["choices"]) >= 4 and c.get("answer") in (0, 1, 2, 3)]
            if len(qs) < 4: raise ValueError("문항 부족")
            out["questions"] = qs
        else:
            out["blocks"] = [{"heading": b["heading"], **({"illust": str(b["illust"])} if b.get("illust") else {}), **({"table": _table(b["table"])} if _table(b.get("table")) else {}),
                              "bullets": [{"text": x["text"], "refs": refs(x), **({"src": _src(x)} if _src(x) else {})} for x in b.get("bullets") or [] if x.get("text")]} for b in r["blocks"]]
            out["blocks"] = [b for b in out["blocks"] if b["bullets"] or b.get("table")]
            if not out["blocks"]: raise ValueError("내용 없음")
        return out
    if not web:
        return ai._ask(build(fmt), 120, parse)
    try:  # 웹 검색은 claude 도구로만(읽기 전용). 오프라인·한도면 웹 없이 다시
        return ai._ask(build(fmt), 420, parse, ("--tools", "WebSearch,WebFetch", "--allowedTools", "WebSearch,WebFetch"), fallback=False)
    except Exception as e:
        print(f"[templates] 웹 검색 실패, 웹 없이 생성: {e}")
        return {**ai._ask(build("\n" + MD_FORMAT), 120, parse), "noweb": True}
