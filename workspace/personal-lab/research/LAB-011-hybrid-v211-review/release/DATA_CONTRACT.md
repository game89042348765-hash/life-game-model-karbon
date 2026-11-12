# Договорённости о данных — редакция 2.1 (Hybrid)

## Файлы и происхождение

Формат обмена — UTF-8 JSONL: одна полноценная JSON-запись на строку. Многострочные пояснения внутри поля кодируют стандартным JSON, не произвольным текстом между строками. CSV используется для реестра и итоговых плоских таблиц. Читаемые Markdown-отчёты дополняют данные, но не заменяют их.

Каждый исполнитель получает TASK.json с task_id, stage, owner_id, input_snapshot, input_hashes, protocol_version, taxonomy_version, rubric_version, scope, exclusions, deliverables и acceptance. Если входы ещё не переданы, задача находится в planned и не считается исполняемой.

ID содержат закреплённый префикс исполнителя/задачи: S-S01-001, F-S01-001, E-N01-001, R-V01-001. Категории C01–C32 и задачи J01–J12 общие. Источник/находка/элемент/оценка не используют один и тот же ID. В рамках выпуска ID уникален; одинаковый ID с разным содержимым — конфликт, который останавливает объединение. Исправления проходят через новую версию пакета и решение оркестратора, без скрытой перезаписи.

В снимке datasets/release-NNNN лежат sources.jsonl, findings.jsonl, elements.jsonl, ratings.jsonl, merge_map.jsonl, relations.jsonl, decisions.jsonl. На ранних стадиях отсутствующие ещё таблицы могут быть пустыми. Поисковые журналы и исходные файлы остаются в принятых пакетах; в паспорт снимка включают ссылки и хеши этих пакетов.

## sources.jsonl — страницы и материалы

Обязательные поля:

- id: постоянный ID источника.
- url, title: реальный адрес и название. DOI дополняют разрешаемым URL. У бумажного/недоступного материала указывают доступную запись каталога и явно отмечают, что содержимое не прочитано.
- owner: автор или владелец; неизвестное обозначают строкой unknown.
- origin_group: общий источник происхождения. Переводы, зеркала и пересказы одного первоисточника получают одну группу, даже если домены разные.
- source_type: official_documentation / source_code / research / practice_manual / first_person_report / review / other.
- language: язык оригинала.
- retrieved_at: фактическое время доступа ISO 8601 с часовым поясом, либо null при отсутствии доступа.
- accessed: true только если исполнитель действительно просмотрел материал; false для поисковой зацепки.

Рекомендуемые поля: published_at, product_version, author, archive_url, access_limitations, notes. Неизвестные даты и версии остаются null. HTML-копии и длинные чужие тексты не обязательны; достаточно точного указателя и краткого подтверждающего фрагмента/пересказа.

## findings.jsonl — исходные находки

Обязательные поля:

- id, task_id, name, description.
- kind: mechanism / technique / interaction_pattern / quality_capability / method_system / product / example.
- category_ids: непустой список ID категорий.
- source_ids: связанные источники; для непроверенной зацепки список может быть пустым.
- verification: verified / lead / inaccessible.
- claims: список объектов с type, source_id, locator, text, basis.

Тип claim: existence / benefit / risk / failure / origin. basis: quote / paraphrase / direct_observation. locator — раздел/якорь/страница/время видео/файл и строка/шаг воспроизведения. Если locator нельзя указать, происхождение факта требует уточнения.

verification=verified требует хотя бы одного existence-claim по accessed-источнику. Это заявление исполнителя, которое затем проверяют. Валидатор способен проверить заполнение и связи, но не истинность страницы. Claim о пользе нельзя заменять фактом существования функции. Цитаты сохраняют краткими; для длинного рассуждения используют собственный пересказ с точной ссылкой.

Рекомендуемые поля: original_name, search_log_ref, context, limitations, related_findings. Непроверенные предложения модели записывают в leads.jsonl или отдельную очередь гипотез, не смешивая с проверенным каталогом.

## elements.jsonl — самостоятельные элементы

Обязательные поля:

- id, name, description: ёмкое название и описание на русском, без рекламных обещаний.
- kind: mechanism / technique / interaction_pattern / quality_capability / method_system / product / example / anti_pattern. В основном рейтинге допускаются mechanism, technique, interaction_pattern и quality_capability. Записи anti_pattern сохраняются в отдельном предупреждающем треке selection_track=anti_pattern_warning. Продукты, составные системы и примеры остаются в справочнике и графе связей.
- primary_category, category_ids: основная категория входит в список дополнительных/общих категорий; метки должны быть обоснованы содержанием, а не добавлены ради покрытия.
- jobs: непустой список J01–J12.
- family_id: ID семейства после межкатегорийного объединения. Семейство не равно автоматически категории.
- raw_ids, source_ids: исходные находки и источники. Для проверенного существующего элемента обе связи непустые.
- mechanism: как работают правила, действия, состояния и обратная связь.
- benefit: возможная польза и для кого; это аналитическое суждение, пока нет отдельного подтверждения эффекта.
- evidence_effect: unknown / mixed / supports / no_effect / adverse. Описывает доступные свидетельства эффекта именно в оговорённых условиях, а не универсальную истинность.
- evidence_summary: какие утверждения источники поддерживают, чего они не показывают, где расходятся.
- contexts, conditions, costs, risks, alternatives, questions: списки строк. Пустой список risks допустим только после содержательной проверки; он не доказывает отсутствие рисков.
- existence: verified / unverified / disputed.
- review_status: pending / accepted / quarantined.
- risk_status: unassessed / reviewed / unresolved_high. reviewed означает разбор, а не безопасность для всех.
- selection_track: main / reference / hypothesis. Недоказанная новая комбинация получает hypothesis; документированный спорный приём можно сохранить в reference с объяснением.

Проверенный элемент должен восходить хотя бы к одной verified-находке с существованием и реально просмотренным источником, связанным с этой карточкой. Указанные источники/claims требуют последующей содержательной проверки. Одни поля verified/accepted не являются внешней сертификацией.

Рекомендуемые поля: original_names, examples, efficacy_claim_refs, risk_claim_refs, failure_modes, counterexamples, prerequisites, open_questions, analyst_id, analysis_context_id, analysis_version. Связи между элементами лучше хранить в relations.jsonl.

## merge_map.jsonl — учёт каждой находки

Обязательные поля: raw_id, element_ids, decision, reason.

decision: canonical / merged_variant / composite / split / quarantined / out_of_scope. Для первых трёх нужен один целевой ID, для split — минимум два, для последних двух (`quarantined` и `out_of_scope`) список `element_ids` обязан быть строго пустым (`[]`). Одна находка имеет одну активную запись судьбы в текущем снимке. Нормализация завершена, когда отображены все findings.id. Связь element.raw_ids и merge_map должна быть взаимной для всех связанных находок.

Причина объясняет, что объединено или разделено и почему. Список использованных источников после объединения сохраняет разницу между независимым подтверждением и многократным пересказом.

## ratings.jsonl — первичные оценки

Обязательные поля: id, element_id, reviewer_id, context_id, rubric_version, blind, scores, rationales.

scores содержит ровно шесть критериев: value, burden, long_term, adaptability, agency, composability. Значения — целые 0–4 или null. rationales содержит непустое объяснение для каждого из шести критериев, включая неизвестное. Смысл и якоря критериев заданы в SCORING.md.

Дополнительные поля: source_ids, limits, model_label, created_at. Неизвестную модель не угадывают. Каждый reviewer_id и context_id имеют одну действующую оценку данного элемента в снимке. Старые версии остаются в архиве пакетов. Программа не может доказать слепоту или независимость по этим строкам; это задача учёта и аудита.

Оценщик не повторяет рекламу как доказательство. Фактические основания ссылаются на источники, а предполагаемые преимущества помечаются как суждения. Чужой балл не служит основанием своего.

## relations.jsonl и decisions.jsonl

Связь: id, from_id, to_id, type, rationale, status; type = complements / alternative / conflicts_with / depends_on / contains / variant_of. Обязательное поле status = documented / hypothesis отделяет найденные сочетания от придуманных. Ссылки должны указывать на существующие элементы.

Решение: id, element_id (если применимо), type, reason, reviewer_ids, source_ids. Для разрешённого расхождения оценок: type=rating_resolution, resolved=true, reason и как минимум два реально существующих reviewer_ids. Решение объясняет, что проверено и почему исходные суждения можно использовать; оно не стирает разницу оценок. При неустранённом противоречии кандидат остаётся в очереди.

## Реестр и манифест

tasks.csv содержит task_id, stage, owner_id, scope, input_snapshot, protocol_version, status, attempt, submitted_path, accepted_path, issues, next_action. Допустимые статусы: planned, assigned, submitted, checked, accepted, needs_revision, rejected, cancelled. План не является выдачей; submitted не означает accepted.

RESULT_MANIFEST.json содержит task_id, attempt, stage, input_snapshot, protocol_version, taxonomy_version, rubric_version, read_ids, output_counts, limitations, files с path/bytes/sha256. Нулевые результаты сохраняют как нулевые. Невыполненные проверки указывают в limitations. При обрезанном ответе статус incomplete; следующий пакет продолжает с точного ID и не дублирует принятые строки.

JSON Schema не заменяет содержательный договор. В комплект включена локальная программа, проверяющая обязательные поля и критические связи. Она не скачивает страницы, не подтверждает семантику дублей и не доказывает валидность оценок.


## Дополнительные поля и команды редакции Hybrid v2.1

В соответствии с утверждённым решением (`HYBRID_V2_DECISION_RECORD.md`) контракт обратно совместим с редакцией 1.0 и включает следующие усиления из независимого варианта `v1_indep`:

- В `taxonomy.json` (версия `2.0`) наряду с категориями `C01–C32` и задачами `J01–J12` зафиксированы `domains_of_origin` (`D01..D12` с поисковыми запросами `search_seeds_en/ru`), `action_lifecycle_phases` (`P1..P6`), `target_user_frictions` (`F1..F8`) и `evidence_grades` (`EVID_A_META_RCT .. EVID_NONE_UNVERIFIED`).
- В `elements.jsonl` поддерживаются опциональные обогащённые поля (обязательные при наличии данных, но не требующие выдумывания психологической гипотезы для инфраструктурных карточек `quality_capability` C28–C30):
  - `mechanism_triad`: объект `{"trigger": "...", "core_rule": "...", "psychological_loop": "..." или null}` — структурная формула механизма (для инфраструктурных возможностей `psychological_loop` может быть `null`);
  - `vendor_claim`: строка (`L3` — изолированное обещание автора/маркетинга, отделённое от `benefit` и `evidence_summary`);
  - `evidence_grade`: один из 5 уровней доказательности (`EVID_A_META_RCT`, `EVID_B_THEORY_GROUNDED`, `EVID_C_FIELD_PRACTICE`, `EVID_D_ANECDOTAL_NICHE`, `EVID_NONE_UNVERIFIED`);
  - `domain_code`, `phase_code`, `target_frictions`, `paradigm_novelty` (`0..3` — для защищённого канала редких латеральных находок `rare_lateral_gem`);
  - вид `kind: "anti_pattern"` и трек `selection_track: "anti_pattern_warning"` для фиксации токсичных механик.
- В `tools/atlas.py` добавлены команды `shard` (кросс-доменная нарезка `findings.jsonl` по `Phase x Friction`), `prepare-blind` (автоматическая стерилизация карточек для слепого оценивания) и флаг `validate --tolerant` (восстановление после обрыва строки JSONL).
