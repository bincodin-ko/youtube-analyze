"""유튜브 댓글 읽기(댓글분석 템플릿용): yt-dlp로 공개 댓글을 받아 오기만 한다(로그인·쓰기 없음). 좋아요 많은 순 최대 N개."""
import yt_dlp


def fetch(url: str, n: int = 150) -> list[dict]:
    opts = {"skip_download": True, "quiet": True, "no_warnings": True, "getcomments": True,
            "extractor_args": {"youtube": {"max_comments": [str(n), "all", "0"], "comment_sort": ["top"]}}}
    with yt_dlp.YoutubeDL(opts) as y:
        info = y.extract_info(url, download=False)
    cs = [{"text": (c.get("text") or "").strip(), "likes": c.get("like_count") or 0} for c in info.get("comments") or []]
    cs = [c for c in cs if c["text"]]
    return sorted(cs, key=lambda c: -c["likes"])[:n]
