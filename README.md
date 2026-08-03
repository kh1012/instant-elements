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

npx instant-elements init            # config, directories, cn helper
npx instant-elements skills install  # skills into .claude/skills and .agents/skills
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
npx instant-elements gallery         # http://127.0.0.1:9221
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
| `ie element status <name>` | Moves the lifecycle status (`--set draft\|stable\|deprecated`) and logs the transition |
| `ie element schema` | Extracts props from your TS types into the entry (`--check` for CI) |
| `ie element validate` | Hard-rule gate (`--animation-strict`) |
| `ie element restore <name>` | Rolls a component back to a past commit (`--to <sha>`) |
| `ie add <url>` | Pulls a marketplace component in as **your own** — source files *and* a registry entry |
| `ie login` | Logs in with GitHub (Device Flow) so `ie publish` can identify you |
| `ie publish <name>` | Publishes a component to the marketplace as `<githubLogin>/<name>` |
| `ie page create/get/set` | Page assembly with optimistic concurrency |
| `ie page check <slug>` | Structural check — unique ids, `items`, known components |
| `ie page catalog` | Components that can render in a page, with their props schema |
| `ie flow create/add/link` | Chain pages into a click-through demo |
| `ie flow check <flow>` | Flow integrity **plus** the structure of every screen it uses |
| `ie gallery status [name]` | Confirms the gallery on that port is *yours* before trusting a link |
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

**Installed components become yours, not dependencies.** `ie add` copies the source into your project and writes a registry entry — it does not add a package. A component in `node_modules` can't be edited by your agent, doesn't show up in your gallery, and accumulates no history; the only way to change it is to fork. So the thing you install is a starting point you own, and the entry is what makes it a first-class citizen: it shows up in reuse searches, passes the same validation gate, and records where it came from.

**Skills route to one canonical guide.** What gets installed is a thin stub; the procedure is read fresh from the package on every invocation, so `npm update` is how you update your team's instructions. Drop a `.instant/skills/<name>/GUIDE.md` in your project to add your own rules on top.

**Pinning is per-browser, on purpose.** Frequently used components can be starred to a "pinned" section at the top of the library. That set lives in `localStorage`, not the registry — pins are *your current working set*, and committing them would put one person's shortlist above everyone else's list.

**The gallery depends on nothing you wrote.** It reads the registry and lazily imports your demos, but its own chrome is self-contained — otherwise a broken component would break the tool you use to look at broken components.

**A link is only "verified" after `ie gallery status`.** The gallery is a SPA, so the server returns 200 for any path — and if another project's gallery holds that port, asking it about your component can return a confident yes about *theirs*. Common names like `button` make this likely rather than rare. So identity is checked first, the entry second.

**Three prompts, one axis.** Each component's detail page offers three ways to hand it to an agent, differing in what comes out the other end:

| | What it asks for | What changes |
| --- | --- | --- |
| **Integrate** | use this component in another screen | the consuming screen |
| **Modify** | change this component itself | the component |
| **Split** | break it into pieces and reassemble | new piece entries; the original becomes a composite |

Split is the one worth explaining. When a component has grown to hold too many responsibilities, splitting it creates real entries for the pieces and rewrites the original as an assembly of them — so the original's `composedOf` and history record that it stopped being a single thing. Without that hierarchy the gallery still shows one component and the relationship disappears. The prompt also says when *not* to: a piece used only by its parent, with no reuse in sight, just adds files.

**Pages are data, not code.** Agents assemble them; reviewers click on what needs fixing; the collected feedback becomes one prompt that already carries the page structure, node paths, and save procedure.

Two things are enforced rather than merely documented, because both fail *quietly*:

- **Structure.** `ie page set` refuses to save a page with missing or duplicate node ids, children placed anywhere but `items`, or component names that aren't in the registry. Each of those saves fine and then renders wrong — you'd find out by looking.
- **Concurrency.** Hand back the version you read as `--base`, or the save is rejected rather than silently overwriting someone else's edit.

`ie flow check` runs the page check on every screen the flow uses. A flow is only as correct as the pages it points at — and duplicate ids are invisible from the flow's side, since the id it targets does exist, just twice.

**Animation support is declared, never inferred.** A component states which of its parts can host an effect and what those parts can do; an effect states what it needs. Guessing from DOM selectors breaks silently the moment markup changes or something renders through a portal.

## License

MIT © kh1012
