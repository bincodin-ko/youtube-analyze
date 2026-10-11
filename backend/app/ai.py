"""요약 리포트·장면 고르기. 1순위 claude -p(구독 로그인), 실패 시 Ollama."""
import json, os, re, shutil, subprocess, urllib.request

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
LAST_USAGE = {}    # 마지막 claude 호출의 비용·토큰(사용량 확인용)
LAST_REASONS = {}  # pick_scenes: child id -> 고른 이유(검증용)

SUM_PROMPT = """너는 영상 대본을 읽기 좋은 한국어 리포트로 정리하는 편집자다. 대본은 한 줄이 `[인덱스 mm:ss] 텍스트` 형식이다(해외 영상이면 번역해서 쓴다).
JSON 객체 하나만 출력하라(설명·코드펜스 금지):
{"title":"한국어 리포트 제목","overview":"총평 2~3문장, 핵심 키워드는 **굵게**",
 "key_points":["핵심 요약 3~5줄"],
 "sections":[{"title":"소제목","children":[{"title":"하위 소제목","bullets":[{"text":"한 문장","refs":[대본 줄 인덱스]}]}]}]}
규칙: 영상 흐름 순서. sections 3~6개, 각 section에 children 2~4개, child마다 bullets 3~6개. bullet은 완결된 한 문장이며 대본의 사례·수치·고유명사·인용을 구체적으로 살린다(뭉뚱그리지 말 것). refs는 그 문장의 근거가 되는 대본 줄 인덱스 1~3개(실제 존재하는 번호만). 소제목에 번호는 붙이지 않는다.

대본:
"""
# 길이·난이도별 추가 지시(기본은 없음)
STYLES = {
    "short": "추가 규칙(짧게): 핵심만. sections 2~3개, 각 section에 children 1~2개, child마다 bullets 2~3개. key_points는 3줄.",
    "long": "추가 규칙(길게): 기본 리포트보다 최소 1.5배 분량으로 아주 자세히 쓴다. 하한을 반드시 지킨다: sections 5개 이상, 각 section에 children 3개 이상, child마다 bullets 6개 이상(전체 bullet 90개 이상). 모든 bullet은 두 문장으로 쓰고(80자 이상), 첫 문장은 주장·사실, 둘째 문장은 대본의 구체 사례·수치·고유명사·인용·배경 설명으로 채운다. overview는 4문장, key_points는 6줄.",
    "easy": "추가 규칙(쉽게): 중학생도 이해하도록 전문용어는 쉬운 말로 풀어 쓰고, 문장은 짧고 친근한 말투로, 필요하면 비유를 든다. 구조는 기본과 같다.",
}
TERMS_PROMPT = """아래 리포트를 처음 듣는 사람이 어려워할 용어·약어·전문개념 5~15개를 골라 쉬운 설명을 붙여라.
term은 리포트 본문에 글자 그대로 나오는 표현이어야 한다(조사 제외). easy는 중학생도 알 한국어 1~2문장.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"terms":[{"term":"용어","easy":"쉬운 설명"}]}

리포트:
"""
PICK_PROMPT = """아래는 리포트의 문단(child)과 각 문단의 후보 장면 이미지 파일명이다. 각 후보 이미지를 Read 도구로 직접 열어 보고, 문단 내용에 가장 잘 맞는 장면 하나를 골라라. 같은 파일을 두 문단에 쓰지 말 것. 어울리는 장면이 전혀 없으면 file을 null로.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"picks":[{"id":"1.1","file":"파일명","reason":"이미지에서 본 것 한 줄"}]}

"""

def _mmss(t): return f"{int(t)//60:02d}:{int(t)%60:02d}"

def _json(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m: raise ValueError("JSON 없음: " + text[:200])
    return json.loads(m.group(0))

def _claude(prompt, timeout, extra=(), cwd=None):
    exe = shutil.which("claude")
    if not exe: raise RuntimeError("claude CLI를 PATH에서 찾지 못함")
    cmd = [exe, "-p", "--output-format", "json", "--model", "sonnet", "--no-session-persistence",
           "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands", *extra]
    p = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8", timeout=timeout, cwd=cwd)
    try: out = json.loads(p.stdout)
    except Exception: raise RuntimeError(f"claude 실패(코드 {p.returncode}): {(p.stderr or p.stdout)[:300]}")
    if p.returncode or out.get("is_error"): raise RuntimeError(f"claude 오류/한도: {str(out.get('result'))[:300]}")
    LAST_USAGE.update(cost_usd=out.get("total_cost_usd"), usage=out.get("usage"), seconds=out.get("duration_ms", 0) / 1000)
    return out["result"]

def _ollama(prompt, timeout):
    model = os.environ.get("VN_OLLAMA_MODEL", "gemma4:12b")
    body = json.dumps({"model": model, "stream": False, "format": "json", "options": {"num_ctx": 32768},
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(OLLAMA_URL, body, {"Content-Type": "application/json"}), timeout=timeout) as r:
            return json.load(r)["message"]["content"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Ollama 모델 '{model}' 사용 불가({e.code}): `ollama pull {model}` 로 설치하거나 VN_OLLAMA_MODEL 설정") from e
    except OSError as e:
        raise RuntimeError(f"Ollama(127.0.0.1:11434)에 연결 못 함: {e}") from e

def _ask(prompt, timeout, parse, extra=(), cwd=None, fallback=True):
    """claude 2회 시도(파싱 실패 시 재시도) → 실패하면 Ollama."""
    err = None
    for _ in range(2):
        try: return parse(_json(_claude(prompt, timeout, extra, cwd)))
        except (RuntimeError, ValueError, KeyError, subprocess.TimeoutExpired) as e:
            err = e
            if isinstance(e, RuntimeError): break  # 한도·미설치는 재시도 무의미
    if not fallback: raise RuntimeError(f"claude 실패: {err}")
    try: return parse(_json(_ollama(prompt, timeout)))
    except (ValueError, KeyError) as e: raise RuntimeError(f"claude 실패({err}) 후 Ollama 응답도 형식 오류: {e}") from e
    except RuntimeError as e: raise RuntimeError(f"claude 실패({err}) → 대체 실패: {e}") from e

def fix_starts(rep: dict, tr: list) -> None:
    """child.start = bullets refs 중 가장 이른 대본 시각, 이후 섹션·하위가 시간순(비감소)이 되게 보정."""
    prev = 0.0
    for sec in rep["sections"]:
        for ch in sec["children"]:
            refs = [i for b in ch["bullets"] for i in b["refs"]]
            ch["start"] = prev = max(prev, tr[min(refs)]["start"]) if refs else prev
        sec["start"] = sec["children"][0]["start"]

NL = chr(10)

def _kind(note, prompt):
    """웹기사 노트(kind=="article")면 '영상' 대신 '글/기사'로 프롬프트를 바꾼다(start는 문단 번호)."""
    k = note.get("kind") or "video"
    if k in ("article", "pdf"):  # 글·문서: start가 문단(쪽) 번호
        w = "기사" if k == "article" else "문서"
        return prompt.replace("유튜브 ", "").replace("영상 대본", f"{w} 본문").replace("영상 흐름", "글 흐름").replace("영상", f"글/{w}").replace("mm:ss", "문단 번호")
    if k == "audio":
        return prompt.replace("유튜브 ", "").replace("영상", "음성 녹음")
    if k == "localvideo":
        return prompt.replace("유튜브 ", "")
    return prompt

def summarize(note: dict, style: str = "") -> dict:
    tr = note["transcript"]
    head = SUM_PROMPT.replace(NL + "대본:", STYLES.get(style, "") + NL + NL + "대본:")
    prompt = _kind(note, head) + NL.join(f"[{i} {_mmss(s['start'])}] {s['text']}" for i, s in enumerate(tr))
    def parse(r):
        n = 0
        for si, sec in enumerate(r["sections"], 1):
            sec["id"] = str(si)
            for ci, ch in enumerate(sec["children"], 1):
                ch["id"] = f"{si}.{ci}"
                for b in ch["bullets"]:
                    b["refs"] = [i for i in b.get("refs", []) if isinstance(i, int) and 0 <= i < len(tr)]
                ch["bullets"] = [b for b in ch["bullets"] if b["refs"]]
                ch["scene"] = None
                n += len(ch["bullets"])
            sec["children"] = [c for c in sec["children"] if c["bullets"]]
        r["sections"] = [s for s in r["sections"] if s["children"]]
        fix_starts(r, tr)
        if not n or not r["sections"]: raise ValueError("유효한 bullet 없음")
        return {k: r[k] for k in ("title", "overview", "key_points", "sections")}
    return _ask(prompt, 600, parse)

def pick_scenes(note: dict) -> dict:
    rep, scenes, d = note["report"], sorted(note["scenes"], key=lambda s: s["time"]), note["media_dir"]
    kids = [c for s in rep["sections"] for c in s["children"]]
    kids.sort(key=lambda c: c["start"])
    cand = {}
    for i, c in enumerate(kids):
        end = kids[i + 1]["start"] if i + 1 < len(kids) else float("inf")
        cand[c["id"]] = [s for s in scenes if (c["start"] if i else 0) <= s["time"] < end]
    byfile = {s["file"]: s for s in scenes}
    pick, used = {}, set()
    multi = [c for c in kids if len(cand[c["id"]]) > 1]
    LAST_REASONS.clear()
    if multi:
        prompt = PICK_PROMPT + "\n".join(
            f"- id {c['id']} 「{c['title']}」: " + " / ".join(b["text"] for b in c["bullets"][:3])
            + "\n  후보: " + ", ".join(s["file"] for s in cand[c["id"]]) for c in multi)
        def parse(r):
            return {p["id"]: p for p in r["picks"]}
        try:
            got = _ask(prompt, 300, parse, ("--tools", "Read", "--allowedTools", "Read", "--add-dir", d), cwd=d, fallback=False)
        except RuntimeError:
            got = {}  # ponytail: 비전 없는 대체 = 시간 범위 가운데 후보
        for c in multi:
            g = got.get(c["id"])
            if g and g.get("file") in {s["file"] for s in cand[c["id"]]}:
                pick[c["id"]] = g["file"]; LAST_REASONS[c["id"]] = g.get("reason", "")
    for c in kids:  # 중복 제거·빈칸 채움 (기계적 간격 아님: 후보 범위 안에서만)
        cs = cand[c["id"]]
        f = pick.get(c["id"])
        if f is None and len(cs) == 1: f = cs[0]["file"]
        if f in used or f is None:
            free = [s for s in cs if s["file"] not in used]
            f = free[len(free) // 2]["file"] if free and (f in used or len(cs) > 1) else None
            if f: LAST_REASONS.setdefault(c["id"], "대체: 범위 가운데 후보")
        if f: used.add(f)
        c["scene"] = dict(byfile[f]) if f else None
    return rep


def regroup_scenes(rep: dict, base: dict) -> dict:
    """기본 리포트의 장면을 새 리포트의 문단 시간 범위로 다시 배정(새 비전 호출 없음)."""
    pool = sorted((c["scene"] for s in base["sections"] for c in s["children"] if c.get("scene")), key=lambda x: x["time"])
    kids = sorted((c for s in rep["sections"] for c in s["children"]), key=lambda c: c["start"])
    used = set()
    for i, c in enumerate(kids):
        end = kids[i + 1]["start"] if i + 1 < len(kids) else float("inf")
        c["scene"] = None
        for sc in pool:
            if (c["start"] if i else 0) <= sc["time"] < end and sc["file"] not in used:
                c["scene"] = dict(sc); used.add(sc["file"]); break
    return rep

def report_text(rep: dict) -> str:
    return "\n".join([rep["overview"], *rep["key_points"], *(b["text"] for s in rep["sections"] for c in s["children"] for b in c["bullets"])])

def terms(note: dict) -> list:
    """리포트에서 처음 듣기 어려운 용어 5~15개와 쉬운 설명. 리포트에 실제로 나오는 용어만 남긴다."""
    text = report_text(note["report"])
    def parse(r):
        out = [t for t in r["terms"] if isinstance(t.get("term"), str) and t.get("easy") and t["term"] in text]
        if len(out) < 3: raise ValueError("용어 부족")
        return out[:15]
    return _ask(_kind(note, TERMS_PROMPT) + text, 180, parse)
