# Проверки Personal 1.2.0

11 ноября 2026. **110/110 групп прошли:**92 модель/UI,10 новых живых сценариев,2 живых смены места/напоминания,6PWA. Изолированные профили Chromium, вымышленные данные, локальный сервер; внешние запросы тестового браузера блокировались. Тестовый API внедряется только в HTTP-ответ тестового harness и отсутствует в поставляемом коде.

Воспроизведение из корня: локальный сервер 8041, затем `python personal/tests/browser.py`, `python personal/tests/update-live.py`, `python personal/tests/locations-live.py`, `python personal/tests/offline.py`. Последний сам запускает отдельный порт. Нужны Python Playwright и Chromium. Скрипты не подключаются к личному профилю и не читают реальные ключи. Отчёты/вымышленные JSON/снимки сохраняются в игнорируемый personal/verification и не публикуются как личные данные.

Обычная неделя 11–17 ноября:177 монет/177XP,16 смысловых завершений плюс 6 нулевых habitStep,2 пропуска. Недельный сценарий с нормой 2 и ежедневным календарём:82/82,11 подходов,4 успешных дня,7 календарных выполнений (одно позже),4 исторических пропуска. Даты реально сдвигаются в тестовом браузере и приложение перезагружается, это не только вычисление задним числом.

Мобильные размеры 320/375/390/430 и широкие 768/900/1100 проверены по затронутым сценариям. Три темы,14 локальных WOFF2, помощник, DST/ночные интервалы, две вкладки, основная/резервная ошибка записи, повреждённый JSON, экспорт/импорт, восстановление/отмена подтверждения, обновление без потери черновика и офлайн выполнены. Новый выбор будущего появления, перенос серии, вложенная цель, Quick Add и плавный баланс проверены настоящими кликами.

## browser

- Empty personal state and isolated keys — PASS.
- Exact reward reversal after editing reward — PASS.
- Double completion and double undo are refused — PASS.
- Constructor can be switched off (false result is not rollback) — PASS.
- Key star toggles both ways — PASS.
- Independent key and final explicit inDay off in editor — PASS.
- Repeat to once starts a new cycle — PASS.
- Completed calendar date cannot move, form survives — PASS.
- Goal/habit threshold and parent undo — PASS.
- Undo earlier habit tick also reverses dependent threshold — PASS.
- Habit is limited to one tick per day — PASS.
- Quest final and undo earlier step — PASS.
- Checklist distinct identical names retain IDs — PASS.
- Started quest cannot change its type — PASS.
- Completed quest target is protected — PASS.
- Bonus assignment has immutable terms — PASS.
- One-use reserve restores after undo — PASS.
- Used reward blocks whole completion undo — PASS.
- Purchase snapshot, one use and repeated use refused — PASS.
- Refund is exact and idempotent — PASS.
- Cannot undo coins already spent — PASS.
- Price word voluntary debt and exact compensation — PASS.
- Archived blocks and closed stages remove actionable items — PASS.
- Editing an archived link keeps its stage and goal — PASS.
- Stage closure moves task IDs containing underscores — PASS.
- Midnight rollover happens before completion mutation — PASS.
- Rest hides ordinary actions without a miss; calendar remains — PASS.
- Quota failure rolls back facts and ledger, retains durable data — PASS.
- Last-good copy is valid previous commit — PASS.
- Invalid import does not overwrite anything — PASS.
- Malicious HTML titles are rendered as text — PASS.
- Timer log is not repeatable — PASS.
- Focus hides another block without manufacturing a miss — PASS.
- Bonus bought without enough money is refused — PASS.
- Old Claude JSON can upgrade assignment snapshots — PASS.
- Broken preferences, references and prototype keys are rejected — PASS.
- Backup write failure refuses the whole operation — PASS.
- Goal can be abandoned and reactivated without money — PASS.
- Custom block deletion preserves linked actions and reward history — PASS.
- Habit level UI restores committed data after write failure — PASS.
- Locations: legacy personal v2 upgrades without changing facts or balances — PASS.
- Locations: manual choice without a schedule persists without artificial expiry — PASS.
- Locations: overnight weekday belongs to starting day — PASS.
- Locations: manual expiry waits for an actual weekday change — PASS.
- Locations: overlapping inactive boundaries do not interrupt manual choice — PASS.
- Locations: place and profile block filter keep universal tasks and forced actions — PASS.
- Locations: hidden section does not remove actions from the plan — PASS.
- Locations: no-miss rule uses the historical daily policy and visited places — PASS.
- Locations: default visibility filter still produces misses and calendar obligations — PASS.
- Locations: automatic tempo respects explicit daily choice — PASS.
- Styles: profile overrides and then restores general style — PASS.
- Locations: deleted place cleans live links but keeps historical name and money — PASS.
- Locations: invalid clock, IDs and profile parts cannot replace data — PASS.
- Hints: manual steps change only onboarding and keep money unchanged — PASS.
- Calendar: weekly, selected days, daily and future anchor — PASS.
- Calendar: end of month and leap-year anchors — PASS.
- Calendar: nominal identity survives moving one appearance — PASS.
- Calendar: two appearances moved onto same date stay distinct — PASS.
- Calendar: series move preserves past and paid future occurrence — PASS.
- Calendar: individual future exception survives series split — PASS.
- Calendar: edit ongoing monthly series keeps 31st anchor — PASS.
- Calendar: each missed repeat can complete later without duplicate reward — PASS.
- Calendar: overdue once move also retains original missed identity — PASS.
- Habits: partial approaches unpaid, one daily award and successful-day goal — PASS.
- Habits: target and reward fixed by first approach, edit norm tomorrow — PASS.
- Habits: undo above threshold retains legitimately earned goal — PASS.
- Inline goal: cancelling parent leaves no orphan goal — PASS.
- Inline goal: atomic with task and retained on quota failure — PASS.
- Quick goal: inherits stage and offers prelinked first action — PASS.
- Quick goal: without stage remains Inbox draft, conversion preserves identity of intent — PASS.
- Ritual: 119 texts and repeated viewing earns nothing — PASS.
- Backups: start-of-day stays stable while last-good advances — PASS.
- Backups: dated preview and cancelled restore do not replace progress — PASS.
- Import: invalid money ratio and malformed repeats/norms rejected unchanged — PASS.
- Calendar: legacy day reference deduplicates and Quick Done handles two appearances — PASS.
- Ritual: partial habit effort acknowledged without a completed-day award — PASS.
- Calendar: editing a missed once date keeps occurrence identity and reward guard — PASS.
- Goal draft: if-then and location survive Inbox placement — PASS.
- UI: create strategy → stage → goal → key task → day → reload — PASS.
- UI: bonus catalog creation preserves parent task draft — PASS.
- Seven actual dates: schedules, rest, pause, remove, rollover and reviews — PASS.
- Two tabs: stale draft retained/refused and no duplicate payout — PASS.
- UI: real JSON download and file import roundtrip — PASS.
- Corrupt primary is preserved, raw download and recovery import work — PASS.
- Demo and test date remain separate from personal data — PASS.
- Mobile/desktop screens and editors: 320/375/390/768/1100px — PASS.
- UI locations: create profile → quick add → hidden/forced → complete → filter → reload — PASS.
- UI editor inherits block location without relinking existing tasks — PASS.
- UI hints: show target, pulse, complete/reload, reset, compact panel in three styles — PASS.
- Styles: all templates, local fonts, reload, 320/390/900px and location settings — PASS.
- Locations: fall-back DST repeated hour produces the real next change — PASS.
- No uncaught JavaScript exceptions — PASS.

## updateLive

- UI: Quick goal draft → Inbox → stage → first linked task → reload — PASS.
- UI: nested goal draft and habit norm +1/+1/reward/undo — PASS.
- UI: weekly event → move only this appearance → complete/undo → reload — PASS.
- UI: choose future appearance and move this plus following while preserving this week — PASS.
- Reminders: lead 0/15/60/1440, late >1h ignored, reload does not repeat — PASS.
- Reward feedback: committed first, smooth count, no effect on failed save/reduced motion — PASS.
- Backup UI: seven-day reminder, three-day snooze, dated preview and export tracking — PASS.
- Start-of-day copy freezes prior valid state on actual next date — PASS.
- Seven actual dates with partial norms, full daily awards, repeats and late completion — PASS.
- No JavaScript errors in updated UI paths — PASS.

## locationsLive

- Actual schedule boundaries update the screen; manual choice expires at real next change — PASS.
- Other-place reminders wait without acknowledgement and appear after switching back — PASS.

## offline

- Install service worker scoped to personal and create task — PASS.
- Offline reload, completion, persistent reward and second reload — PASS.
- All three styles and 14 local fonts are available offline — PASS.
- PWA update defers reload for open draft and preserves committed data — PASS.
- Foreground calendar reminder fires once and remains acknowledged on reload — PASS.
- No uncaught browser errors — PASS.

## Ограничения приёмки

Физические iPhone/Safari/Android, экранная клавиатура, установка на личный телефон, реальное разрешение системных уведомлений и многомесячное использование не заменяются Chromium. Фоновая гарантированная доставка не реализована. Без Web Locks действует проверка снимка, но строгая атомарность вкладок не обещается. Сравнительные тесты прежнего источника 35/35 отражают только тот срез, не являются тестами текущего обновления.
