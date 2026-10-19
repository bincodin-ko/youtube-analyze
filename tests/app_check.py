# 시험 --app 보조: CDP로 실제 WebView2 창을 읽어 확인. 1=☆ 켜고 스타일 창·PPT 창, 2=창을 다시 연 뒤 ☆ 유지(재시작 시 설정 유지)
import sys
from playwright.sync_api import sync_playwright
phase, out = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9333")
    pg = b.contexts[0].pages[0]
    pg.wait_for_load_state(); pg.wait_for_timeout(1500)
    pg.get_by_role("button", name="확장", exact=True).first.click()
    pg.get_by_role("button", name="확장 리포트 목록").click(); pg.get_by_role("button", name="확장 리포트 추가").click()
    dlg = pg.get_by_role("dialog", name="확장 리포트 추가"); dlg.wait_for()
    if phase == "1":
        if dlg.locator("[data-sec='즐겨찾기']").count() == 0: dlg.get_by_role("button", name="퀴즈 즐겨찾기").first.click()
        assert dlg.locator("[data-sec='즐겨찾기']").count() == 1, "☆ 켠 뒤 즐겨찾기 칸 없음"
        if dlg.locator("[data-tpl='quote'][aria-pressed='true']").count(): dlg.locator("[data-tpl='quote']").first.click()
        dlg.locator("[data-tpl='infographic']").first.click(); dlg.locator("[data-tpl='ppt']").first.click()
        dlg.get_by_role("button", name="2개 추가").click()
        sp = pg.get_by_role("dialog", name="인포그래픽 스타일 선택"); sp.wait_for()
        assert sp.get_by_role("radio").count() == 6, "인포그래픽 스타일 6개 아님"
        sp.get_by_role("radio", name="손글씨 스케치/손그림").click(); pg.wait_for_timeout(500)
        assert sp.locator("[data-preview='handwriting'] [data-style='handwriting']").count() == 1, "손글씨 미리보기 없음"
        pg.screenshot(path=out + "_style.png")
        sp.get_by_role("button", name="취소").click()
        pp = pg.get_by_role("dialog", name="PPT 만들기"); pp.wait_for()
        assert pp.get_by_role("radio").count() == 9 and pp.locator("[data-count]").inner_text() == "5", "PPT 창 이상"
        pg.screenshot(path=out + "_ppt.png")
        pp.get_by_role("button", name="취소").click()
        assert pg.get_by_role("dialog").count() == 0, "취소했는데 창이 남음"
    else:
        assert dlg.get_by_role("button", name="퀴즈 즐겨찾기").first.get_attribute("aria-pressed") == "true", "앱을 다시 열었더니 ☆가 사라짐(설정 유지 안 됨)"
        dlg.get_by_role("button", name="퀴즈 즐겨찾기").first.click()  # 원래대로
        assert dlg.locator("[data-sec='추천']").count() == 1, "☆ 끈 뒤 추천 칸 없음"
        pg.screenshot(path=out + "_restart.png")

print("ok", phase)
