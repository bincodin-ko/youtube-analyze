"""해외 영상 대본 한국어 번역(B4). 문단 인덱스를 그대로 유지하고 data/media/<id>/transcript_ko.json 에 저장."""
import json, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from app import ai

CHUNK = 25  # 한 번에 보내는 문단 수(작게 쪼개 병렬·점진 표시)
PROMPT = """아래 JSON 객체는 영상 대본 문단들이다(키=번호, 값=문단). 각 문단을 자연스러운 한국어로 번역하라. 문단을 합치거나 쪼개지 말고 키마다 하나씩 번역한다. 고유명사는 원문 발음대로 쓰되 필요하면 원문 병기.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"t":{"0":"번역0","1":"번역1",...}}  — 입력과 키가 정확히 같아야 한다.

"""


def path(media, nid): return media / nid / "transcript_ko.json"


JOBS: dict = {}  # nid → {"total":묶음 수, "done":끝난 묶음 수, "texts":[문단별 번역|None], "err":str|None, "finished":bool}


def _chunk(part):
    def parse(r, n=len(part)):
        t = r["t"]
        if not all(isinstance(t.get(str(i)), str) for i in range(n)): raise ValueError("번역 개수 불일치")
        return [t[str(i)] for i in range(n)]
    try:
        return ai._ask(PROMPT + json.dumps(dict(enumerate(part)), ensure_ascii=False), 600, parse, fallback=False)
    except RuntimeError as e:  # 모델이 문단을 합쳐 개수가 틀리면 반으로 쪼개 다시(한도 오류 등은 그대로 올림)
        if "불일치" not in str(e) or len(part) < 2: raise
        h = len(part) // 2
        return _chunk(part[:h]) + _chunk(part[h:])


def translate(tr: list, on_done=None, workers=4) -> list:
    """묶음을 workers개씩 병렬 번역. 묶음이 끝날 때마다 on_done(시작 인덱스, 번역들). 한도 오류면 동시 2개로 재시도."""
    starts = list(range(0, len(tr), CHUNK))
    out = [None] * len(tr)
    todo = list(starts)
    for w in (workers, 2):
        failed, err = [], None
        with ThreadPoolExecutor(w) as ex:
            futs = {ex.submit(_chunk, [s["text"] for s in tr[i:i + CHUNK]]): i for i in todo}
            for f in as_completed(futs):
                i = futs[f]
                try: t = f.result()
                except Exception as e: failed.append(i); err = e; continue
                out[i:i + len(t)] = t
                if on_done: on_done(i, t)
        todo = failed
        if not todo: return out
    raise RuntimeError(f"번역 실패: {err}")


def start(media, nid, tr) -> dict:
    """백그라운드 번역 시작(이미 돌고 있으면 그대로). 끝난 묶음은 바로 JOBS에 반영, 다 끝나면 파일로 저장."""
    j = JOBS.get(nid)
    if j and not j["finished"]: return j
    j = JOBS[nid] = {"total": -(-len(tr) // CHUNK), "done": 0, "texts": [None] * len(tr), "err": None, "finished": False}
    def on_done(i, t):
        j["texts"][i:i + len(t)] = t; j["done"] += 1
    def run():
        try:
            texts = translate(tr, on_done)
            f = path(media, nid); f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(json.dumps(texts, ensure_ascii=False), encoding="utf-8")
        except Exception as e: j["err"] = str(e)
        j["finished"] = True
    threading.Thread(target=run, daemon=True).start()
    return j
