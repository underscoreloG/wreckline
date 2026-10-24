# Wreckline

Top-down combat racer in the browser (working title). Build spec: `SPEC.md`, contracts in `specs/`.

## Run

```sh
npm ci            # Node 22, exact versions from package-lock.json
npm run dev       # Vite dev server on http://localhost:5181 (strictPort)
npm run verify    # typecheck + check:boundaries + test + build (with bundle size check)
```

Other scripts: `npm test` (Vitest, Node), `npm run typecheck`, `npm run build` (prints gzip sizes, fails over 2.5 MB),
`npm run check:boundaries` (module rules of SPEC.md section 3; `-- --self-test` checks the checker).

## Query params

| Param | Effect |
|---|---|
| `?harness=render\|ui\|audio\|input` | Mount that WP's dev harness instead of the game |
| `?screen=<Screen>` | With `harness=ui`: open that screen with fixture data |
| `?race=1&seed=N&laps=N&ai=N&track=id` | Skip menus, start a quick race directly |
| `?autoplay=1` | Player car driven by a medium AI (for unattended checks) |
| `?fps=1` | FPS / draw-call overlay |
| `?autopause=0` | Disable auto-pause on blur/hidden (scripted checks in a hidden browser pane) |
| `?harness=debug2d[&fake=1]` | WP00 2D debug view; also reads `seed`, `laps`, `ai` (AI opponents, default 3), `autoplay`, `track` |

The debug view exposes `window.__harness = { sim, step(n), snapshot(), setInput(partial), clearInput(), finishRace() }`.
It steps in real time only while the page is visible and focused (unless `autopause=0`); the first `step(n)` call switches it to scripted mode for good.
