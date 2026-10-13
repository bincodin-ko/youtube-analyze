"""notes + collections + notes_fts(검색). JSON 칼럼(transcript·report·scenes)은 TEXT."""
import json, sqlite3
from pathlib import Path

from app.paths import DATA
DB = DATA / "notes.db"
JSON_COLS = ("transcript", "report", "scenes")
COLS = ("id", "url", "video_id", "title", "channel", "thumbnail", "duration", "upload_date", "created_at",
        "status", "step", "error", "lang", "collection_id", "kind") + JSON_COLS


_FTS_VALS = ("{t}.rowid, {t}.title, "
             "(SELECT group_concat(value,' ') FROM json_tree({t}.report) WHERE type='text' AND key NOT IN ('id','file')), "
             "(SELECT group_concat(value->>'text',' ') FROM json_each({t}.transcript))")


def _con():
    DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB, timeout=10)  # 호출마다 새 연결 → 스레드 걱정 없음
    c.row_factory = sqlite3.Row
    return c


def init():
    with _con() as c:
        c.execute("CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, url TEXT, video_id TEXT, title TEXT, "
                  "channel TEXT, thumbnail TEXT, duration REAL, upload_date TEXT, created_at TEXT, status TEXT, "
                  "step TEXT, error TEXT, lang TEXT, transcript TEXT, report TEXT, scenes TEXT)")
        c.execute("CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY, name TEXT, created_at TEXT)")
        if "collection_id" not in [r[1] for r in c.execute("PRAGMA table_info(notes)")]:
            c.execute("ALTER TABLE notes ADD COLUMN collection_id INTEGER")  # 기존 노트는 NULL(컬렉션 없음)
        if "kind" not in [r[1] for r in c.execute("PRAGMA table_info(notes)")]:
            c.execute("ALTER TABLE notes ADD COLUMN kind TEXT DEFAULT 'video'")  # video | article | pdf | audio | localvideo. 기존 노트는 video
        if "deleted_at" not in [r[1] for r in c.execute("PRAGMA table_info(notes)")]:
            c.execute("ALTER TABLE notes ADD COLUMN deleted_at TEXT")  # 휴지통(릴리스처럼). NULL이면 살아 있는 노트
        # 검색: trigram FTS. 리포트·대본 JSON에서 글자 값만 뽑아 넣음(장면 파일 이름·번호 id 는 뺌). 동기화는 트리거가 맡음
        # 예전 색인(파일 이름까지 넣던 것)이면 지우고 다시 만든다. 노트 자체는 그대로
        old = c.execute("SELECT sql FROM sqlite_master WHERE name='notes_fts_insert'").fetchone()
        if old and "NOT IN" not in old[0]:
            for t in ("insert", "update", "delete"):
                c.execute(f"DROP TRIGGER IF EXISTS notes_fts_{t}")
            c.execute("DROP TABLE IF EXISTS notes_fts")
        if not c.execute("SELECT 1 FROM sqlite_master WHERE name='notes_fts'").fetchone():
            c.execute("CREATE VIRTUAL TABLE notes_fts USING fts5(title, report, transcript, tokenize='trigram')")
            c.execute(f"INSERT INTO notes_fts(rowid,title,report,transcript) SELECT {_FTS_VALS.format(t='notes')} FROM notes")
            for ev in ("INSERT", "UPDATE"):
                c.execute(f"CREATE TRIGGER notes_fts_{ev.lower()} AFTER {ev} ON notes BEGIN "
                          f"DELETE FROM notes_fts WHERE rowid=new.rowid; "
                          f"INSERT INTO notes_fts(rowid,title,report,transcript) SELECT {_FTS_VALS.format(t='new')}; END")
            c.execute("CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN DELETE FROM notes_fts WHERE rowid=old.rowid; END")
        # 처리 중이던 노트는 건드리지 않음: 다른 서버가 처리 중일 수 있고, 꺼졌던 노트는 main이 다시 큐에 넣는다


def processing_ids():
    with _con() as c:
        return [r[0] for r in c.execute("SELECT id FROM notes WHERE status='processing' ORDER BY created_at")]


def _row(r):
    d = dict(r)
    for k in JSON_COLS:
        d[k] = json.loads(d[k]) if d[k] else ([] if k != "report" else None)
    return d


def insert(note):
    update(note["id"], _insert=True, **note)


def update(nid, _insert=False, **f):
    f = {k: json.dumps(v, ensure_ascii=False) if k in JSON_COLS and v is not None else v
         for k, v in f.items() if k in COLS and k != "id"}
    with _con() as c:
        if _insert:
            c.execute(f"INSERT INTO notes (id,{','.join(f)}) VALUES (?{',?' * len(f)})", (nid, *f.values()))
        elif f:
            c.execute(f"UPDATE notes SET {','.join(k + '=?' for k in f)} WHERE id=?", (*f.values(), nid))


def get(id):
    with _con() as c:
        r = c.execute("SELECT * FROM notes WHERE id=?", (id,)).fetchone()
    return _row(r) if r else None


SUMMARY = "id,title,channel,thumbnail,duration,created_at,status,step,collection_id,kind"


def list_all(collection_id=None):
    w, a = ("WHERE collection_id=? AND deleted_at IS NULL", (collection_id,)) if collection_id else ("WHERE deleted_at IS NULL", ())
    # 컬렉션 안에서는 넣은 순서(재생목록 순서), 전체는 최신순
    order = "rowid" if collection_id else "created_at DESC"
    with _con() as c:
        return [dict(r) for r in c.execute(f"SELECT {SUMMARY} FROM notes {w} ORDER BY {order}", a)]


def collections():
    with _con() as c:
        return [dict(r) for r in c.execute(
            "SELECT c.id, c.name, count(n.id) AS count FROM collections c "
            "LEFT JOIN notes n ON n.collection_id=c.id AND n.deleted_at IS NULL GROUP BY c.id ORDER BY c.id")]


def add_collection(name, created_at):
    with _con() as c:
        return c.execute("INSERT INTO collections (name, created_at) VALUES (?,?)", (name, created_at)).lastrowid


def get_collection(cid):
    with _con() as c:
        r = c.execute("SELECT * FROM collections WHERE id=?", (cid,)).fetchone()
    return dict(r) if r else None


def search(q, limit=50):
    """3글자 이상은 FTS5 trigram MATCH, 2글자 이하는 trigram이 못 찾으므로 LIKE(전체 훑기)."""
    q = q.strip()
    if not q:
        return []
    if len(q) >= 3:
        where, a = "notes_fts MATCH ?", ('"' + q.replace('"', '""') + '"',)
    else:
        like = "%" + q.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
        where, a = " OR ".join(f"f.{k} LIKE ? ESCAPE '!'" for k in ("title", "report", "transcript")), (like,) * 3
    with _con() as c:
        rows = c.execute(f"SELECT n.id,n.title,n.channel,n.thumbnail,n.created_at,f.title AS t,f.report AS r,"
                         f"f.transcript AS s FROM notes_fts f JOIN notes n ON n.rowid=f.rowid WHERE ({where}) "
                         f"AND n.deleted_at IS NULL ORDER BY n.created_at DESC LIMIT {int(limit)}", a).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        where_, text = next(((w, d[k]) for w, k in (("제목", "t"), ("리포트", "r"), ("대본", "s"))
                             if d[k] and q.lower() in d[k].lower()), ("", ""))
        text = text.replace("**", "")  # 리포트의 굵게 표시 제거
        i = text.lower().find(q.lower())
        d["where"], d["snippet"] = where_, ("…" if i > 40 else "") + text[max(0, i - 40):i + len(q) + 60] + "…"
        for k in ("t", "r", "s"):
            d.pop(k)
        out.append(d)
    return out


def trash(nid, at):
    """휴지통으로(at=None이면 복원)."""
    with _con() as c:
        c.execute("UPDATE notes SET deleted_at=? WHERE id=?", (at, nid))


def trashed():
    with _con() as c:
        return [dict(r) for r in c.execute(f"SELECT {SUMMARY},deleted_at FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")]


def delete_note(nid):
    """DB 행 삭제(FTS 행은 notes_fts_delete 트리거가 같이 지움)."""
    with _con() as c:
        c.execute("DELETE FROM notes WHERE id=?", (nid,))


def rename_collection(cid, name):
    with _con() as c:
        c.execute("UPDATE collections SET name=? WHERE id=?", (name, cid))


def delete_collection(cid):
    """컬렉션만 지움. 안의 노트는 컬렉션 없음(NULL)으로 남김."""
    with _con() as c:
        c.execute("UPDATE notes SET collection_id=NULL WHERE collection_id=?", (cid,))
        c.execute("DELETE FROM collections WHERE id=?", (cid,))
