# instant-elements example — Vite + React

A minimal consumer project showing the full loop.

```bash
npm install
npx instant-elements doctor            # check the environment
npx instant-elements skills install    # install skills into .claude/skills and .agents/skills
npx instant-elements gallery           # http://127.0.0.1:9221
npm run dev              # the app itself
```

## What to look at

| File | Why it matters |
| --- | --- |
| `instant.config.ts` | Every path the CLI, gallery, and skills use comes from here. |
| `src/styles.css` | Three lines wire the tokens in — including `@source "./elements"`, without which no utilities get generated for your components. |
| `vite.config.ts` | The `@/elements` alias must match `importAlias` in the config. |
| `index.html` | `data-instant` scopes the base layer; `data-theme` picks light or dark. |
| `src/App.tsx` | Generated components imported like any other module. |

`instant-elements` is a **devDependency** — the gallery never ships in your bundle.
