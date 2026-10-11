"""마인드맵 v2: 리포트 전체 + 코드가 계산한 [m:ss] → markmap용 마크다운(claude 스트리밍). data/media/<id>/mindmap_<상세도>.md 에 저장."""
import re
from pathlib import Path
from app import chat

LEVELS = {"short": "노드 총 20~30개: 하위 주제(###)는 섹션당 1~2개, 끝가지(-)는 하위 주제당 1~2개",
          "normal": "노드 총 40~60개: 하위 주제(###)는 섹션당 2~3개, 끝가지(-)는 하위 주제당 2~4개",
          "detailed": "노드 총 70~100개: 하위 주제(###)는 섹션당 3~4개, 끝가지(-)는 하위 주제당 3~5개"}

PROMPT = """아래 영상 리포트를 마인드맵용 마크다운으로 바꿔라. 영상을 안 본 사람이 이 지도만 보고 내용을 설명할 수 있어야 한다. 마크다운만 출력(설명·코드펜스 금지).
형식(4단계, 한국어):
`# 영상 전체의 한 줄 결론`(문장 1개, 40자 이내)
`## 섹션 제목`(리포트 섹션과 1:1, 합치거나 빼지 말 것, 20자 이내 주장형)
`### 소주제 — 한 줄 결론`(45자 이내, 왜·그래서 포함)
`- 사실 하나를 담은 짧은 문장 [m:ss]`(55자 이내, 숫자·이름·사례 중 하나 이상 반드시 포함, 숫자는 **굵게**, 사례는 `예)`로 시작)
규칙: 분량은 {level}. 리포트에 없는 내용 금지, 숫자·고유명사·사례를 지우지 말 것. 끝가지 끝의 [시각]은 입력 줄에 주어진 것을 그대로 옮기고 지어내지 말 것.
광고·강의 안내·채널 소개 같은 부록성 섹션/소주제는 제목 줄 바로 다음 줄에 `<!-- markmap: fold -->`를 넣어라.

"""

def _t(note, i):
    """대본 줄 i → 시각 표기. 영상은 m:ss, 글·문서는 문단 번호."""
    s = note["transcript"][i]["start"]
    return str(int(s)) if note.get("kind") in ("article", "pdf") else f"{int(s)//60}:{int(s)%60:02d}"

def _text(note):
    rep = note["report"]
    out = [f"제목: {rep['title']}", f"개요: {rep['overview']}", "핵심: " + " / ".join(rep["key_points"])]
    for s in rep["sections"]:
        out.append(f"## {s['title']}")
        for c in s["children"]:
            out.append(f"### {c['title']}")
            out += [f"- {b['text']} [{_t(note, b['refs'][0])}]" for b in c["bullets"]]
    return "\n".join(out)

def stream(note: dict, level: str):
    """claude 글자 조각을 그대로 yield. 끝나면 정리된 전체 마크다운을 반환(StopIteration.value)."""
    raw = ""
    for t in chat._stream_claude(PROMPT.format(level=LEVELS[level]) + _text(note)):
        raw += t; yield t
    return clean(raw, {_t(note, i) for i in range(len(note["transcript"]))})

def clean(raw: str, valid: set) -> str:
    """코드펜스 제거, 존재하지 않는 시각 표기 제거. 형식이 틀리면 ValueError."""
    raw = re.sub(r"^```\w*\n|\n```\s*$", "", raw.strip())
    raw = re.sub(r" ?\[(\d+:\d{2}|\d+)\]", lambda m: m.group(0) if m.group(1) in valid else "", raw)
    if not raw.startswith("# ") or raw.count("\n") < 3: raise ValueError("마인드맵 형식 오류: " + raw[:100])
    return raw

def path(media: Path, nid: str, level: str = "normal") -> Path: return media / nid / f"mindmap_{level}.md"
