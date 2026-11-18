# Календарь звонков (продолжение)

[![hexlet-check](https://github.com/hakerlolreturn-netizen/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/hakerlolreturn-netizen/ai-for-developers-project-387/actions)

Интегрируйте работу агентов в GitHub проект

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

Приложение «Календарь звонков» перенесено из проекта [ai-for-developers-project-386](https://github.com/hakerlolreturn-netizen/ai-for-developers-project-386). Исходная [спецификация](https://github.com/hakerlolreturn-netizen/ai-for-developers-project-386/issues/15) и [карта с решениями](https://github.com/hakerlolreturn-netizen/ai-for-developers-project-386/issues/5) лежат в issues того репозитория. Словарь предметной области — в `GLOSSARY.md`, архитектурные решения — в `docs/adr/`.

## Открыть приложение

Развёрнутая версия на Render: https://ai-for-developers-project-386-7qil.onrender.com

Бесплатный инстанс Render засыпает без трафика, поэтому первый запрос после простоя открывается дольше обычного. Данные хранятся в памяти процесса и сбрасываются при каждом перезапуске.

Если адрес недоступен, запустите приложение локально (нужны Node.js 24+ или Docker):

```bash
git clone https://github.com/hakerlolreturn-netizen/ai-for-developers-project-387.git
cd ai-for-developers-project-387
npm ci
npm run dev    # фронтенд http://localhost:5173, бекенд http://localhost:3000
```

или в Docker:

```bash
docker build -t calendar .
docker run -e PORT=8080 -p 8080:8080 calendar   # http://localhost:8080
```

## Стек

- Backend: Node.js, Fastify, TypeScript
- Frontend: Vite, React, Mantine
- Контракт API: TypeSpec → OpenAPI
- Тесты: Vitest, Playwright; линтер: oxlint, Prettier
- CI: GitHub Actions; релизы: release-please

## Использование

```bash
npm run dev     # бекенд и фронтенд в режиме разработки
npm test        # тесты
npm run lint    # линтер и проверка форматирования
npm run check   # все проверки, как в CI (перед первым запуском: npx playwright install chromium)
```

## Docker

Образ запускает бекенд, который отдаёт API под `/api` и собранный фронтенд. Порт задаёт переменная `PORT` (по умолчанию 3000).

### Render MCP

Проектная конфигурация MCP для Claude Code лежит в `.mcp.json`; ключ берётся из переменной окружения и в репозиторий не попадает.

1. В Render: Account Settings → API Keys → Create API Key.
2. Экспортируйте ключ в окружение перед запуском агента: `export RENDER_API_KEY=<ключ>`.
3. Запустите `claude` в корне репозитория и подтвердите проектный сервер `render`; проверка: `/mcp`.
4. Попросите агента выбрать workspace (`list_workspaces`, `select_workspace`) и создать или проверить сервис.

## Агент в GitHub

В задании предлагается OpenCode, здесь вместо него Claude Code: [Claude GitHub App](https://github.com/apps/claude) и [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action). Сценарии те же: комментарий с командой в issue или PR запускает агента в GitHub Actions, и он отвечает комментарием от имени `claude[bot]`. Отличия от OpenCode:

- вместо ключа провайдера используется токен подписки Claude из `claude setup-token`, он хранится в секрете `CLAUDE_CODE_OAUTH_TOKEN`;
- агент вызывается одной фразой `@claude` (`trigger_phrase` по умолчанию) вместо набора `mentions` (`/opencode`, `/oc`);
- параметра `share` нет, потому что Claude Code не публикует сессии. Снаружи видны только комментарии агента и лог прогона в Actions.

### Воркфлоу

| Файл                                     | События                                                                       | Модель              | Назначение                                                                                                                                   | Результат                                                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/claude.yml`           | `issue_comment`, `pull_request_review_comment`, только `types: [created]`     | `claude-sonnet-5-5` | Ответы на вопросы по issue и PR, запуск скиллов, правки в PR                                                                                 | Комментарий `claude[bot]` в issue или PR, прогон во вкладке Actions → `claude`                                                                               |
| `.github/workflows/claude-triage.yml`    | `issues`, только `types: [opened]`                                            | `claude-sonnet-5-5` | Автотриаж нового обращения по скиллу `triage`: разбор с учётом существующего приложения, вопросы, метки категории и состояния. Код не меняет | Комментарий `claude[bot]` и метки в issue, прогон во вкладке Actions → `claude-triage`                                                                       |
| `.github/workflows/claude-review.yml`    | `pull_request`: `opened`, `synchronize`, `reopened`, `ready_for_review`       | `claude-sonnet-5-5` | Независимое авторевью по критериям из `REVIEW.md` и сверка со спецификацией из связанных issue. Код не меняет                                | Замечания к строкам diff и итоговый комментарий `claude[bot]` с проверенным SHA, прогон в Actions → `claude-review`                                          |
| `.github/workflows/browser-check.yml`    | `pull_request`: те же типы                                                    | без модели          | Playwright-сценарии из точного head SHA PR с записью trace                                                                                   | Артефакт `browser-check-<sha>` в прогоне Actions → `browser-check`: `sha.txt`, `result.txt`, trace и HTML-отчёт                                              |
| `.github/workflows/lighthouse-audit.yml` | `schedule` ежедневно в 06:17 (`timezone: Europe/Moscow`), `workflow_dispatch` | `claude-sonnet-5-5` | Аудит Lighthouse развёрнутого приложения (`APP_URL`, страницы `/` и `/book`) и разбор находок агентом                                        | Оценки в Summary прогона, артефакт `lighthouse-<run id>`, комментарий в issue «Журнал аудита Lighthouse», отдельные issue с меткой `audit` по новым находкам |

Как вызвать:

- `@claude explain this issue` для вопроса или задачи в свободной форме;
- `@claude /to-spec по обсуждению этого issue`, `@claude /to-tickets #<spec>`, `@claude /implement-spec #<spec>` для скиллов. Текст после `@claude` передаётся агенту как команда.

Агент работает с копией репозитория на раннере и читает `AGENTS.md` (через `CLAUDE.md`) и настройки трекера в `docs/agents/`. Скиллы `triage`, `to-spec`, `to-tickets`, `implement-spec` и их зависимости `tdd`, `code-review` лежат в `.agents/skills/`, а Claude Code находит их через симлинки в `.claude/skills/`. Вопросы и решения агента остаются комментариями в issue, поэтому следующий вызов прочитает их перед работой.

Описание PR заполняется по шаблону `.github/pull_request_template.md`: связи с обращением, спецификацией, тикетами и согласованием, проверки с командами, прогонами и SHA, риск и способ отката. Перед мержем человек сверяет SHA в артефакте `browser-check` и в итоговом комментарии авторевью с текущим head PR и открывает trace.

### Доступ и ограничения

- Автотриаж получает инструкцию из `prompt` воркфлоу и запускается, только если автор issue имеет роль `OWNER`, `MEMBER` или `COLLABORATOR`, не является ботом, а у issue нет метки `ready-for-agent`. Эту метку ставит `to-tickets` при создании тикетов, поэтому подготовленные тикеты повторно не разбираются. Метки состояния описаны в `docs/agents/triage-labels.md`. Переводить обращение в `ready-for-agent` или `ready-for-human` решает человек.
- Интерактивное задание запускается, только если в комментарии есть `@claude`, автор комментария имеет роль `OWNER`, `MEMBER` или `COLLABORATOR` и не является ботом. Кроме того, action сам проверяет у автора право записи и игнорирует ботов (`allowed_bots` не задан).
- Права задания: `contents: read` и `id-token: write`. Через OIDC action получает токен Claude App, и комментарии, коммиты и `gh` агент выполняет с правами приложения. `actions/checkout` настроен с `persist-credentials: false`.
- Авторевью и браузерная проверка запускаются на `pull_request` только для веток этого репозитория и не для draft. Новый push отменяет незавершённый прогон (`cancel-in-progress: true`), поэтому результат всегда относится к последнему head.
- В авторевью задан `allowed_bots: claude`: без него action пропускает PR и push от `claude[bot]`, то есть PR от `implement-spec`. Другие боты не допускаются. Claude App выдаёт токен, только если файл воркфлоу совпадает с версией в `main`. Поэтому в PR, который меняет `claude-review.yml`, авторевью пропускается с предупреждением о workflow validation, и такой PR проверяет человек. С `allowed_bots` action работает без auto mode, поэтому ревьюеру явно разрешены только чтение PR и issue, `gh api` и комментарии.
- Браузерная проверка не получает секрет модели: у неё только `contents: read`, checkout идёт из `pull_request.head.sha`, а фактический `git rev-parse HEAD` сверяется с ним и сохраняется в артефакт.
- В PR, автор которых не имеет права записи (в том числе `claude[bot]`), action запрещает агенту из `claude.yml` запускать код (`npm`, тесты). Агент правит и пушит, тесты проверяет CI на новом коммите.
- `pull_request_target` не используется. Комментарии к PR из fork выполняют воркфлоу из основной ветки, а запускать его могут только доверенные участники.
- `timeout-minutes: 30` и `--max-turns 50` (у автотриажа `15` и `30`, у авторевью `20` и `30`, у браузерной проверки тайм-аут `20`, у аудита `30` и `30`) задают верхнюю границу одного прогона. Это стартовые значения, они не подбирались по замерам. `concurrency` по номеру issue или PR ставит повторные вызовы в очередь.
- Остановить текущий прогон можно кнопкой Cancel workflow в Actions, отключить будущие — через Disable workflow. Если нужно, токен отзывается в настройках аккаунта Claude.

### Аудит Lighthouse

- Адрес приложения задаётся переменной репозитория `APP_URL` (Settings → Secrets and variables → Actions → Variables). Сейчас это развёртывание на Render из раздела «Открыть приложение».
- Шаги без модели будят инстанс Render, снимают Lighthouse-отчёты по `/` и `/book` в каталог `.lighthouse/` (в `.gitignore`, в коммиты не попадает), собирают `findings.json` и пишут таблицу оценок в Summary прогона. Каталог целиком сохраняется артефактом `lighthouse-<run id>`. Срок хранения артефакта ограничен, поэтому оценки и находки дублируются в Summary и в журнале аудита.
- Находка — аудит категорий performance, accessibility, best-practices или seo с ненулевым весом и score < 0.5. Одинаковые находки на разных страницах объединяются.
- Агент получает инструкцию в `prompt`, комментария пользователя у прогона нет. Для каждой находки он ищет issue с меткой `audit` и строкой `audit-key: lighthouse/<audit id>`. Если такой issue уже открыт, агент новый не создаёт (комментирует его, только если появились новые сведения). Закрытые с `wontfix` находки он не поднимает снова. Новый issue получает метки `audit`, `needs-triage`, `enhancement` и остаётся входящим обращением: брать ли его в работу, решает человек.
- Итог каждого прогона агент публикует комментарием в issue «Журнал аудита Lighthouse»: ссылка на прогон, оценки, найденные и уже известные находки или прямая фраза об их отсутствии.
- Права: `contents: read` и `id-token: write`. Issue и комментарии создаются от имени Claude App, кода и PR этот сценарий не создаёт.
- `concurrency: lighthouse-audit` без отмены: одновременно идёт один аудит, следующий ждёт. GitHub может задержать или пропустить запуск по расписанию, а в публичном репозитории отключает расписание после 60 дней без активности. Сценарий проверяется ручным запуском: Actions → `lighthouse-audit` → Run workflow из `main`.

Подключение:

1. Установить [Claude GitHub App](https://github.com/apps/claude) на репозиторий.
2. Выполнить `claude setup-token` и сохранить токен в Settings → Secrets and variables → Actions под именем `CLAUDE_CODE_OAUTH_TOKEN`.

### Личные наблюдения о работе агента

Так как работал не с OpenCode, а с Claude Code, то уточнил у него, как мне сделать аналогичный флоу. Он объяснил и помог в настройке. С выполнением задач и объяснением тоже справляется хорошо, каких-то негативных моментов или доп требований, которые нужно было бы описать агенту для его корректной работы для текущий задач не выявил.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
