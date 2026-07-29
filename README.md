# instant-elements

> **Describe it, and it gets built — visible in a gallery, refined by prompt, and every change recorded.**

A UI harness for coding agents. Components accumulate in a registry as you build, so the next request starts by **finding what already exists** instead of making another near-duplicate. Semantic tokens keep the whole thing visually coherent.

```
"a stat card for the dashboard header"
        ↓  the agent looks for something reusable first
        ↓  if nothing fits: three files + a registry entry
   you look at it in the gallery
        ↓  copy the modify prompt → the agent edits it
   it gets recorded (who · when · what · which commit)
        ↓
   assemble pages from what you've built → point at what to fix
        ↓
   chain pages into a click-through demo
```

## Why

Design systems drift for a boring reason: when finding the existing button is harder than writing a new one, people write a new one. Six months later there are nine buttons and no one knows which is canonical.

instant-elements makes reuse the path of least resistance — the agent searches the registry before writing anything — and makes each component's history legible: what was asked for, what changed, and which commit to go back to.

## Requirements

- Node.js **20.11+**
- React 18/19 and Tailwind CSS v4 in your project
- git (optional — history authorship and restore points come from it)

## Getting started

```bash
npm install -D instant-elements

npx ie init            # config, directories, cn helper
npx ie skills install  # skills into .claude/skills and .agents/skills
```

Wire the tokens into your Tailwind entry CSS:

```css
@import "tailwindcss";
@import "instant-elements/theme.css";
@source "./elements";   /* so utilities get generated for your components */
```

Scope the base layer on your root element:

```html
<html data-instant data-theme="light">
```

Now describe what you need to your agent:

> "A stat card for the dashboard header — a number with its change from last month."

And look at the result:

```bash
npx ie gallery         # http://127.0.0.1:9221
```

There is a working consumer project in [`examples/vite-react`](./examples/vite-react).

## Commands

| Command | What it does |
| --- | --- |
| `ie init` | Scaffolds config, directories, the `cn` helper, an empty index |
| `ie skills install` | Installs skill stubs for Claude Code and Codex |
| `ie element new <name>` | Three files + entry + creation history + index, in one step |
| `ie element list` | Finds reuse candidates (`--query`, `--category`, `--json`) |
| `ie element get <name>` | Entry, history, and contract check |
| `ie element log <name>` | Records an edit or a reuse recommendation (`--sha` marks a restore point) |
| `ie element schema` | Extracts props from your TS types into the entry (`--check` for CI) |
| `ie element validate` | Hard-rule gate (`--animation-strict`) |
| `ie element restore <name>` | Rolls a component back to a past commit (`--to <sha>`) |
| `ie page create/get/set` | Page assembly with optimistic concurrency |
| `ie page catalog` | Components that can actually render inside a page |
| `ie flow create/add/link/check` | Chain pages into a click-through demo |
| `ie gallery` | Runs the gallery |
| `ie index` | Regenerates `index.json` deterministically |
| `ie guide <skill>` | Prints the canonical procedure for a skill |
| `ie config` / `ie doctor` | Resolved paths / environment check |

## Configuration

```ts
// instant.config.ts
import type { InstantElementsConfig } from "instant-elements/config";

const config: InstantElementsConfig = {
  elementsDir: "src/elements",       // where generated components live
  importAlias: "@/elements",         // how your app imports them
  registryDir: ".instant/registry",  // entries, index, history
  pagesDir: ".instant/pages",
  flowsDir: ".instant/flows",
  tokens: { css: "instant-elements/theme.css" },
  gallery: { port: 9221 },
};

export default config;
```

Every path comes from here. The CLI, the gallery, and the skills all read `ie config --json` rather than hardcoding anything — which is what lets the same skill instructions work in any project layout.

**To use your own design tokens**, copy `styles/colors.css`, change the values, and point `tokens.css` at your copy. Keep the token *names* — the gallery and your existing components depend on them.

## How it works

**Three files per component.** The component, a demo that renders itself with no props (this is what the gallery card draws), and a barrel. No Storybook required — the gallery detail page is the workbench.

**The registry is the source of truth.** One JSON entry per component holds the intent (the original request, preserved verbatim), a plain-language summary, keywords, and the props schema. `index.json` is a deterministic rollup: the same entries always produce byte-identical output, so regenerating never creates a diff.

**History is append-only.** Creation, edits, and reuse recommendations each append one line. Recommendations matter — without them you cannot measure whether the harness is actually preventing duplicates, which is the entire point of it.

**Skills route to one canonical guide.** What gets installed is a thin stub; the procedure is read fresh from the package on every invocation, so `npm update` is how you update your team's instructions. Drop a `.instant/skills/<name>/GUIDE.md` in your project to add your own rules on top.

**The gallery depends on nothing you wrote.** It reads the registry and lazily imports your demos, but its own chrome is self-contained — otherwise a broken component would break the tool you use to look at broken components.

**Pages are data, not code.** Agents assemble them; reviewers click on what needs fixing; the collected feedback becomes one prompt that already carries the page structure, node paths, and save procedure. Saves are version-guarded — hand back the version you read as `--base`, or the save is rejected rather than silently overwriting someone else's edit.

**Animation support is declared, never inferred.** A component states which of its parts can host an effect and what those parts can do; an effect states what it needs. Guessing from DOM selectors breaks silently the moment markup changes or something renders through a portal.

## License

MIT © kh1012
