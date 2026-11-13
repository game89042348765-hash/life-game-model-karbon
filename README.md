# LifeGame 2.0 Unified — Полный комплект для репозитория и GitHub Pages

Готовая к публикации офлайн-сборка **LifeGame 2.0 Unified** без сборщиков (`npm build` не нужен) и без внешних сетевых зависимостей: все шрифты (`Golos Text`, `Unbounded`, `Tektur`, `JetBrains Mono`, `Nunito`, `Rubik`, `Dela Gothic One`), иконки PWA, банк из 200 реплик «Игры в счастье», вечерние послания и Service Worker включены локально.

## Два способа загрузки в GitHub

### Вариант А — Новый отдельный репозиторий (рекомендуется для чистой публикации)
1. Создай пустой репозиторий на GitHub (например, `lifegame-unified`).
2. Распакуй содержимое этого архива в корень репозитория и отправь в ветку `main`:
   ```sh
   git init
   git add .
   git commit -m "Initial release: LifeGame 2.0 Unified"
   git branch -M main
   git remote add origin <URL_ТВОЕГО_РЕПОЗИТОРИЯ>
   git push -u origin main
   ```
3. В настройках GitHub открой **Settings → Pages → Build and deployment** и выбери **GitHub Actions** (готовый workflow `.github/workflows/pages.yml` уже лежит в архиве) либо **Deploy from a branch (`main` / `/root`)**.

### Вариант Б — Отдельная папка внутри существующего репозитория `life-game`
Все пути в `index.html`, `styles.css`, `manifest.webmanifest` и `sw.js` строго относительные (`./`), а ключи `localStorage` и `CACHE` изолированы (`lifegame_u2_*`), поэтому сборка не затрагивает `personal/`, `personal-lab/` и `next/`:
1. Скопируй содержимое архива в новую папку репозитория, например `unified/` (без копирования `.github/`, если в корне репозитория уже настроен свой деплой Pages).
2. После пуша приложение сразу откроется по адресу `https://<твой-аккаунт>.github.io/life-game/unified/`.

## Локальный запуск и проверка целостности

```sh
# 1. Проверить комплектность, хеши SHA-256, кэш Service Worker и сквозные автотесты:
python3 tests/verify_repo.py

# 2. Поднять локальный сервер для работы в браузере и проверки PWA:
python3 -m http.server 8042 --bind 127.0.0.1
# Открыть: http://127.0.0.1:8042/
```

В папке `dist/lifegame-unified-v2-standalone.html` также лежит однофайловая автономная версия для быстрого просмотра или пересылки одним HTML-файлом.

## Состав пакета

- `index.html`, `styles.css`, `messages.js`, `data.js`, `engine.js`, `map-views.js`, `ui.js`, `pwa.js`, `sw.js`, `manifest.webmanifest` — основное модульное PWA-приложение.
- `fonts/` — 14 локальных кириллических и латинских шрифтов `.woff2` с лицензиями и `SOURCES.json`.
- `icon.svg`, `icon-192.png`, `icon-512.png` — иконки установки на iOS / Android / Desktop.
- `dist/lifegame-unified-v2-standalone.html` — склеенная однофайловая сборка.
- `tests/verify_repo.py`, `tests/runtime_e2e.js` — автоматическая проверка манифеста SHA-256, Service Worker и всех пользовательских сценариев.
- `audit-manifest.json`, `SOURCE.json`, `CHANGE_SUMMARY.md`, `TEST_RESULTS.md` — документация и контрольные суммы релиза.
