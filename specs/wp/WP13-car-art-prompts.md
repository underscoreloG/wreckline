# WP13 - Car art prompt pack

**Wave C1 (after the fun gate), parallel with WP09 and WP11.** Goal: everything the user needs to generate one turnaround sheet and one 3D model per car with outside AIs, ready to paste, so the generation step takes minutes and needs no guessing.
Read first: `SPEC.md`, `specs/design.md` (Car art), `specs/content.md` sections 1 and 9, the concept sheet `specs/art/cars-concept-v1.webp` (look at it), and `~/.claude/skills/game-forge/references/ai-toolbox.md` (why GPT image and Tripo).
Depends on: M1 gate passed.
Owns: `specs/art/prompts/**`. Anything else needs a CCR.
Dispatch: subagent (opus). The generation itself is `user:ChatGPT+Tripo` (WP13U below), run by the user in their own accounts.

## Deliverables
- `specs/art/prompts/README.md`: the user's checklist: for each car, (1) paste the sheet prompt in ChatGPT image generation with the concept sheet attached, (2) check the sheet against the rules below, (3) feed front/side/rear views to Tripo image-to-model, (4) export GLB, (5) drop files as `art-incoming/cars/<id>/sheet.png` and `art-incoming/cars/<id>/<id>.glb` in the project root (gitignored, WP14 reads from there). Include the Tripo settings to use (multi-view input, target face count 4000, textured, GLB) and a "reject and regenerate if" list.
- `specs/art/prompts/<id>.md` for the 8 ids in content.md section 1: one sheet prompt each. Every prompt asks for: the named car from the attached concept sheet; an orthographic turnaround on a plain flat mid-grey background, same scale in every view: FRONT, SIDE (facing right), REAR, TOP (nose up), plus one 3/4 hero view; no text, no ground shadow, no motion blur; simple low-poly shapes with the concept's grunge in the texture, not in the geometry; the roof is a plain painted panel without decals (the game adds its own roof plate); the main body colors as hex values you sample from the concept image (write a tiny throwaway script that samples them, or read them by eye and say so); proportions matching the car's `length x width x height` from content.md.
- `specs/art/prompts/checks.md`: what WP14 will verify on import (facing, scale, face count, texture size), so the user can reject bad outputs early. Note from the Can It Code? videos: generators misreport (asked 3k faces, got 5k; models facing backwards), so every claim is measured on import.

## Acceptance tests
- [ ] 8 prompt files exist, each names its car, lists its size from content.md and at least 3 sampled hex colors, and contains every required element above (a script in your report greps each file for the required phrases and prints a pass table).
- [ ] README checklist covers all 5 steps and the drop paths exactly as WP14 reads them.

## Out of scope
Generating images or models (the user does), importing them (WP14), any game code.

---

# WP13U - Generate sheets and models (user step)

Dispatch: `user:ChatGPT+Tripo`. The brain hands the user `specs/art/prompts/README.md`, ledger state `waiting-user`. Done when all 8 `art-incoming/cars/<id>/` folders hold a sheet and a GLB. The brain spot-checks one sheet against the concept before the user runs all 8.
