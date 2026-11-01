# todo-scan

Плагин [mapward](https://github.com/mapward-org/mapward): пометки `TODO`, `FIXME` и `HACK` в коде
проекта — сколько всего и в каких файлах. Пример плагина для
[маркетплейса](https://github.com/mapward-org/market): один `index.ts`, без зависимостей.

## Поставить

```sh
npx @mapward/cli market add todo-scan
```

Агенту — `market_add { name: "todo-scan" }` в MCP mapward. Плагин ставится недоверенным: прочитайте
`index.ts` и подтвердите «Доверять?» в редакторе.

## Метод `scan`

| Параметр | По умолчанию | Что |
|---|---|---|
| `path` | корень проекта | папка от корня проекта (`mapward://@`) |
| `tags` | `["TODO", "FIXME", "HACK"]` | какие пометки искать |
| `limit` | `20` | сколько файлов вернуть |

Ответ: `{ total, files: [{ path, count, hits: [{ line, text }] }], items }` — файлы по убыванию
числа пометок; `items` — они же пунктами вида `list`. `node_modules`, `.git`, `dist`, `build` пропускаются.

Агенту: `call_plugin { plugin: "_plugins/todo-scan", method: "scan", args: { path: "packages/core" } }`.

## Метрика

Ответ `scan` содержит `items` — пункты вида `list` встроенного плагина `views`, поэтому метрика
собирается без своего компонента:

```json
{
  "label": "TODO",
  "component": "${{ mapward:// }}/_plugins/views/list.tsx",
  "params": {
    "source": {
      "plugin": "${{ mapward:// }}/_plugins/todo-scan",
      "method": "scan",
      "params": { "path": "packages/core", "limit": 5 }
    },
    "empty": "пометок нет"
  },
  "agent": {
    "plugin": "${{ mapward:// }}/_plugins/todo-scan",
    "method": "scan",
    "params": { "path": "packages/core", "limit": 5 }
  }
}
```

Как устроены метрики и виды — `read_docs` mapward, раздел `plugins`.
