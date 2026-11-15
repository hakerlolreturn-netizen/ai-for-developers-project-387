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

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
