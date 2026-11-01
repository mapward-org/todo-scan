import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { definePlugin } from "@mapward/plugin";
import { defer } from "rxjs";
import { Type } from "typebox";

/** Папки, где пометки не ищут: зависимости, сборки, служебное. */
const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".mapward"]);
/** Файлы, где ищут: исходники и тексты, без бинарных. */
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|md|css|scss|py|go|rs|java|kt|cs|rb|php|sh|ya?ml)$/i;
const TAGS = ["TODO", "FIXME", "HACK"];

type Hit = { line: number; text: string };
type FileHits = { path: string; count: number; hits: Hit[] };

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (TEXT.test(entry.name)) yield path;
  }
}

const escape = (text: string) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function scan(root: string, base: string, tags: string[], limit: number) {
  const pattern = new RegExp(`\\b(${tags.map(escape).join("|")})\\b`);
  const files: FileHits[] = [];
  let total = 0;
  for await (const path of walk(root)) {
    const text = await readFile(path, "utf8").catch(() => "");
    const hits: Hit[] = [];
    text.split("\n").forEach((line, at) => {
      if (pattern.test(line)) hits.push({ line: at + 1, text: line.trim().slice(0, 200) });
    });
    if (hits.length === 0) continue;
    total += hits.length;
    files.push({ path: relative(base, path).replaceAll("\\", "/"), count: hits.length, hits });
  }
  files.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  const shown = files.slice(0, limit);
  // `items` — пункты вида `list` из `views`: ответ сразу годится в метрику.
  const items = shown.map((file) => ({
    label: file.path,
    description: `${file.count} · ${file.hits[0]?.text ?? ""}`,
  }));
  return { total, files: shown, items };
}

export default definePlugin({
  description: "Пометки TODO, FIXME и HACK в коде проекта: сколько всего и в каких файлах",
  activation: { idle: 60_000 },
  methods: {
    scan: {
      description:
        "Найти пометки в папке проекта. Ответ: total — сколько всего, files — файлы по убыванию " +
        "числа пометок, у каждого path от корня проекта, count и hits — строки { line, text }; " +
        "items — те же файлы пунктами вида list из views. " +
        "node_modules, .git и сборки пропускаются",
      params: Type.Object({
        path: Type.Optional(
          Type.String({
            description: "Папка от корня проекта (mapward://@); по умолчанию весь проект",
          }),
        ),
        tags: Type.Optional(
          Type.Array(Type.String(), {
            description: "Какие пометки искать; по умолчанию TODO, FIXME, HACK",
          }),
        ),
        limit: Type.Optional(
          Type.Number({ description: "Сколько файлов вернуть; по умолчанию 20" }),
        ),
      }),
      run: (args, ctx) =>
        defer(() =>
          scan(
            join(ctx.map.basePath, args.path ?? ""),
            ctx.map.basePath,
            args.tags?.length ? args.tags : TAGS,
            args.limit ?? 20,
          ),
        ),
    },
  },
});
