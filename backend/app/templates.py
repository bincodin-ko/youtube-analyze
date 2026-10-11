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

ICONS = "lightbulb target rocket users clock chart trending-up shield heart star book brain search settings wallet zap flag check-circle alert-triangle message-circle globe layers puzzle repeat award coins smile"
LAYOUTS = ("steps", "compare", "stats", "timeline", "cycle")

# key -> 이름·분류·카드 설명·kind·지시문
BUILTIN = {
    "lecture": dict(name="강의노트", cat="추천", desc="수업 필기처럼 개념·예시·정리 순서로", kind="md",
                    prompt="이 내용을 학생의 강의노트로 정리하라. blocks는 '핵심 개념', '세부 설명과 예시', '용어 정리', '한 줄 복습' 순서로 구성한다."),
    "quote": dict(name="중요 인용구", cat="추천", desc="기억할 만한 말을 그대로 뽑아서", kind="md",
                  prompt="대본에서 기억할 만한 인용구 6~10개를 골라라. 각 block은 주제 하나이며 bullet.text는 대본 표현을 거의 그대로 살린 따옴표 문장 뒤에 한 줄 맥락 설명을 덧붙인다."),
    "action": dict(name="액션아이템 도출", cat="추천", desc="바로 해볼 일을 우선순위로", kind="md",
                   prompt="이 내용에서 시청자가 실제로 실행할 수 있는 액션아이템을 도출하라. blocks는 '지금 바로(오늘)', '이번 주', '장기 과제' 순이며 각 bullet은 '동사로 시작하는 구체적 행동 + 왜 하는지'로 쓴다."),
    "blog": dict(name="블로그 글", cat="추천", desc="그대로 올릴 수 있는 글 형태로", kind="md",
                 prompt="이 내용을 블로그 게시글로 다시 써라. title은 클릭하고 싶은 제목. blocks는 '도입', 본문 소제목 2~4개, '마무리' 순서이고 bullet은 문단처럼 자연스럽게 이어지는 서술 문장으로 쓴다."),
    "background": dict(name="관련 배경지식", cat="더 깊이 이해하기", desc="이 내용을 이해하는 데 필요한 맥락", kind="md",
                       prompt="이 내용을 이해하는 데 필요한 배경지식을 설명하라(역사·개념·관련 분야·선행 지식). 대본에 없는 일반 지식은 refs를 []로 두되 확실한 사실만 쓰고 불확실하면 '일반적으로'라고 표시한다."),
    "counter": dict(name="반대 시각 조사", cat="더 깊이 이해하기", desc="다른 의견과 반론, 한계점", kind="md",
                    prompt="이 내용의 주장에 대한 반대 시각·반론·한계·예외 사례를 정리하라. 각 block은 '화자의 주장'(refs 필수)과 그에 대한 '반대 시각'을 한 쌍으로 묶는다. 근거 없는 수치를 지어내지 말고 불확실하면 그렇게 밝힌다."),
    "minutes": dict(name="회의록", cat="노트 형식", desc="안건·논의·결정·할 일 형식", kind="md",
                    prompt="이 내용을 회의록 형식으로 정리하라. blocks는 '개요', '주요 논의', '결정 사항', '후속 할 일' 순서."),
    "recipe": dict(name="레시피", cat="노트 형식", desc="재료와 순서가 있는 요리법·절차", kind="md",
                   prompt="이 내용을 레시피(따라 하는 절차) 형식으로 정리하라. blocks는 '준비물(재료·도구)', '단계별 순서'(bullet 하나가 한 단계), '주의할 점'. 요리가 아니면 작업 절차로 해석한다."),
    "study": dict(name="공부카드", cat="노트 형식", desc="시험 대비 요점 카드 모음", kind="md",
                  prompt="시험 대비용 공부카드 8~12개로 정리하라. 각 block의 heading은 개념 이름, bullets는 정의 1개와 외울 포인트 1~2개."),
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


def generate(note: dict, key: str) -> dict:
    """템플릿 지시문 + 대본 → 결과 JSON(kind 포함). refs는 대본 범위 안의 정수만 남긴다."""
    t = get(key)
    tr = note["transcript"]
    n = len(tr)
    body = t["prompt"] if t["kind"] != "md" or key in BUILTIN else \
        f"다음은 사용자가 만든 나만의 템플릿 지시문이다. 이 지시를 충실히 따라 결과를 만들어라.\n지시문: {t['prompt']}"
    fmt = "" if t["kind"] != "md" else "\n" + MD_FORMAT
    head = ai._kind(note, "너는 영상 대본을 바탕으로 요청된 형식의 학습 자료를 만드는 편집자다. 대본은 한 줄이 `[인덱스 mm:ss] 텍스트` 형식이다(해외 영상이면 번역해서 쓴다).\n" + body + fmt + "\n\n대본:\n")
    prompt = head + "\n".join(f"[{i} {ai._mmss(s['start'])}] {s['text']}" for i, s in enumerate(tr))

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
            out.update(subtitle=str(r.get("subtitle") or ""), layout=r["layout"] if r.get("layout") in LAYOUTS else "steps", blocks=bl[:6], takeaway=str(r.get("takeaway") or ""))
        elif t["kind"] == "quiz":
            qs = [{"q": c["q"], "choices": c["choices"][:4], "answer": c["answer"], "explain": c.get("explain", ""), "refs": refs(c)}
                  for c in r["questions"] if c.get("q") and isinstance(c.get("choices"), list) and len(c["choices"]) >= 4 and c.get("answer") in (0, 1, 2, 3)]
            if len(qs) < 4: raise ValueError("문항 부족")
            out["questions"] = qs
        else:
            out["blocks"] = [{"heading": b["heading"], "bullets": [{"text": x["text"], "refs": refs(x)} for x in b["bullets"] if x.get("text")]} for b in r["blocks"]]
            out["blocks"] = [b for b in out["blocks"] if b["bullets"]]
            if not out["blocks"]: raise ValueError("내용 없음")
        return out
    return ai._ask(prompt, 120, parse)
