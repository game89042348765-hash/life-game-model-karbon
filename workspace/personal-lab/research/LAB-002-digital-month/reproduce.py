#!/usr/bin/env python3
"""Focused independent UI reproductions for LAB-002; never uses pilot profiles.

Run from the repository root while its local HTTP server is running:
  python3 personal-lab/research/LAB-002-digital-month/reproduce.py
All browser/runtime outputs go to the ignored verification/reproduction directory.
Only UI actions create or change application data. evaluate() below reads DOM or
localStorage after UI actions; it never calls application functions or writes data.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


TITLE = "Читать 10 минут вечером"
DOM_READ = """() => ({
  title:document.title, time:new Date().toISOString(),
  viewport:{width:innerWidth,height:innerHeight},
  text:document.body.innerText,
  controls:[...document.querySelectorAll('button,input,textarea,select')]
    .filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height)
    .map(e=>({tag:e.tagName,type:e.type,label:e.getAttribute('aria-label')||
      e.innerText||e.getAttribute('placeholder')||e.name||'',
      value:e.value,rect:e.getBoundingClientRect().toJSON()}))
})"""
STATE_READ = """() => Object.fromEntries(Object.keys(localStorage)
 .filter(k=>k.startsWith('lifegame-personal-lab-')).map(k=>{
 let v=localStorage.getItem(k);try{v=JSON.parse(v)}catch{}return [k,v]}))"""


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


class Case:
    def __init__(self, browser, root, name, url):
        self.name, self.url = name, url
        self.path = root / name
        self.path.mkdir()
        self.steps, self.blocked, self.errors, self.dialogs = [], [], [], []
        self.context = browser.new_context(
            viewport={"width": 390, "height": 844}, locale="ru-RU",
            timezone_id="Europe/Moscow", service_workers="block",
        )
        allowed = urlsplit(url)

        def route_request(route):
            target = urlsplit(route.request.url)
            if (target.scheme, target.netloc) == (allowed.scheme, allowed.netloc):
                route.continue_()
            else:
                self.blocked.append(route.request.url)
                route.abort()

        self.context.route("**/*", route_request)
        self.context.tracing.start(screenshots=True, snapshots=True, sources=False)
        self.page = self.context.new_page()
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))

        def dialog_seen(dialog):
            self.dialogs.append({"type": dialog.type, "message": dialog.message})
            dialog.dismiss()

        self.page.on("dialog", dialog_seen)
        self.page.clock.install(time=datetime.fromisoformat("2026-11-16T21:00:00+03:00"))

    def action(self, description, action):
        action()
        self.steps.append({"step": len(self.steps) + 1, "action": description})
        self.page.wait_for_timeout(100)

    def click(self, label, exact=True):
        self.action("click: " + label,
                    lambda: self.page.get_by_role("button", name=label, exact=exact).click())

    def capture(self, name):
        self.page.screenshot(path=str(self.path / (name + ".png")), full_page=False)
        write_json(self.path / (name + ".json"), self.page.evaluate(DOM_READ))

    def state(self, name):
        state = self.page.evaluate(STATE_READ)
        write_json(self.path / (name + "-observer-state.json"), state)
        return state.get("lifegame-personal-lab-my-v1", {})

    def setup_habit(self):
        self.action("open local app", lambda: self.page.goto(self.url))
        self.click("Начать свою жизнь в LifeGame", exact=False)
        self.action("check: Начать с LifeGame Lite", lambda:
                    self.page.get_by_role("checkbox", name="Начать с LifeGame Lite", exact=False).check())
        self.click("Начать")
        self.click("Привычки")
        self.click("+ Новое")
        self.capture("01-new-habit-top")
        self.action("fill Название: " + TITLE,
                    lambda: self.page.locator('input[name="title"]').fill(TITLE))
        self.action("scroll form to visible Создать", lambda:
                    self.page.get_by_role("button", name="Создать", exact=True).scroll_into_view_if_needed())
        self.capture("02-new-habit-bottom")
        self.click("Создать")

    def day(self, date):
        self.action("set browser clock to " + date, lambda:
                    self.page.clock.set_system_time(datetime.fromisoformat(date)))
        self.action("reload on next virtual date", lambda: self.page.reload())
        self.click("День")

    def close(self, result):
        write_json(self.path / "result.json", {
            "case": self.name, "result": result, "steps": self.steps,
            "blocked_external_requests": self.blocked, "page_errors": self.errors,
            "native_dialogs": self.dialogs,
            "evidence": sorted(p.name for p in self.path.iterdir()),
        })
        self.context.tracing.stop(path=str(self.path / "trace.zip"))
        self.context.close()


def out_of_plan(browser, root, url):
    c = Case(browser, root, "R1-planned-habit-labelled-outside-plan", url)
    try:
        c.setup_habit()
        c.day("2026-11-17T21:00:00+03:00")
        c.capture("03-planned-before-mark")
        before = c.state("03-before")
        c.click("Отметить выполненным")
        c.page.wait_for_timeout(1400)  # Let the visual coin animation finish.
        c.capture("04-immediate-day-result")
        text = c.page.locator("body").inner_text()
        c.action("scroll day down 430px to read the full outside-plan row", lambda:
                 c.page.mouse.wheel(0, 430))
        c.page.wait_for_timeout(350)
        c.capture("05-outside-plan-row")
        after = c.state("05-after")
        c.click("Главная")
        c.click("История")
        c.capture("06-history")
        c.click("Выполнения")
        c.capture("07-history-completions")
        active = [f for f in after.get("facts", []) if not f.get("cancelled")]
        c.close({
            "planned_before": (before.get("habits", [{}])[0].get("inDay") is True and
                               before.get("habits", [{}])[0].get("sched", {}).get("type") == "daily"),
            "outside_plan_label_after_scheduled_ui_mark": "выполнено вне плана" in text.casefold(),
            "facts_before": len(before.get("facts", [])),
            "active_facts_after": [{k: f.get(k) for k in ("kind", "date", "coins", "xp", "title")}
                                   for f in active],
            "ledger_entries_after": len(after.get("ledger", [])),
            "earned_coins_after": sum(l.get("coins", 0) for l in after.get("ledger", [])),
            "interpretation": "Scheduled habitStep is rendered outside plan. Two fact rows do not imply two rewards.",
        })
    except Exception as e:
        c.capture("FAILED")
        c.close({"reproduction_error": repr(e)})
        raise


def partial_reading(browser, root, url):
    c = Case(browser, root, "R2-partial-reading-default-one-approach", url)
    try:
        c.setup_habit()
        c.day("2026-11-18T22:00:00+03:00")
        c.capture("03-day-before-partial-attempt")
        c.click("Ещё")
        c.capture("04-more-menu")
        c.click("Открыть карточку")
        c.capture("05-habit-detail")
        detail = c.page.locator("body").inner_text()
        detail_controls = c.page.locator(".overlay").last.locator("input,textarea,select").count()
        # Match the participant's honest decision: do not turn 5 minutes into a
        # full completion. No mutation is needed to verify the observed options.
        c.click("Закрыть")
        state = c.state("06-after-partial-attempt")
        c.close({
            "habit_norm": state.get("habits", [{}])[0].get("dailyTarget"),
            "habit_schedule": state.get("habits", [{}])[0].get("sched"),
            "detail_offers_whole_completion": "Выполнено сегодня" in detail,
            "detail_has_numeric_or_text_entry": detail_controls > 0,
            "facts_after_no_completion": len(state.get("facts", [])),
            "ledger_after_no_completion": len(state.get("ledger", [])),
            "interpretation": "Default counts one approach, not minutes from the title. No partial entry in the inspected menu/detail; this is an expectation/UX mismatch, not proven data loss.",
        })
    except Exception as e:
        c.capture("FAILED")
        c.close({"reproduction_error": repr(e)})
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8041/personal-lab/")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    root = repo / "personal-lab/verification/month-pilot-001/reproduction" / stamp
    root.mkdir(parents=True)
    manifest = {"started_utc": stamp, "url": args.url,
                "command": "python3 personal-lab/research/LAB-002-digital-month/reproduce.py",
                "browser": "/usr/bin/chromium", "contexts": "fresh nonpersistent, one per case",
                "source_sha256": {f: hashlib.sha256((repo / f).read_bytes()).hexdigest() for f in
                                  ("personal-lab/app.js", "personal-lab/planning.js", "personal-lab/persistence.js", "personal-lab/style.css")}}
    write_json(root / "manifest.json", manifest)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                    args=["--no-sandbox"])
        try:
            out_of_plan(browser, root, args.url)
            partial_reading(browser, root, args.url)
        finally:
            browser.close()
    print(root)


if __name__ == "__main__":
    main()
