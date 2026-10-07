## What changed

<!-- One paragraph or bullet list: the observable behaviour before vs. after. If the UI changed, include screenshots (before and after). -->

## Why

<!-- The motivation: bug fix, new feature, performance, correctness. Link the related issue, if any. -->

## Test plan

- [ ] `npm ci` runs without errors
- [ ] `npm run check:tsc` passes: `tsc --noEmit` with **no new errors** compared with `tsc-baseline.txt` (the baseline can only shrink)
- [ ] `tsc-baseline.txt` did not grow (CI compares it with the base branch; only removals are allowed)
- [ ] `npm run lint` passes (0 errors; pre-existing warnings do not block, but do not add new ones)
- [ ] `npm run build` passes
- [ ] `npm test` (`vitest run`) passes, including this PR's new test (seen failing before the code)
- [ ] `git diff --check` passes
- [ ] `package.json` has no `version` change (only dependencies the PR really needs; the lockfile changes only for that)
- [ ] All user-visible text goes through the i18n system (`src/i18n/`): `pt-BR` and `en-US` are required; the other six languages are desirable (they fall back to `en-US`), and this PR describes its coverage below
- [ ] No real data (statements, names, e-mails, personal amounts) in tests, fixtures or comments
- [ ] Manual test: <!-- describe what you ran and what you observed -->

## Commit attribution

- [ ] I verified the name and e-mail on every commit in this PR and corrected any unintended identity before requesting merge. See the [commit attribution guidance](https://github.com/lucianodiisouza/recta-selfhosted-frontend/blob/main/CONTRIBUTING.md#commit-attribution).

## Release impact

<!-- Check exactly one. This drives which release your change ships in
     (see CONTRIBUTING.md, "Versioning and deprecation policy"). -->

- [ ] **Patch**: bug fix, no new surface
- [ ] **Minor**: additive (screen, dialog, new option), existing behaviour preserved
- [ ] **Major (breaking)**: removes or incompatibly changes a flow, a route or a format stored in the browser. Call it out in "What changed" above

## CHANGELOG (merge gate)

- [ ] I added a `CHANGELOG.md` entry under `[Unreleased]`, in the right section (Added / Changed / Fixed). **Required** for any user-visible change: screen, text, flow, changed behaviour or observable bug fix. (Exempt only: internal refactors, dead-code removal and test-only churn.)
- [ ] Any changed **default** (a field's initial value, a button's behaviour, a key stored in the browser) is called out explicitly in "What changed" above.

Reviewers treat a missing entry as blocking; adding it up front saves a review round.

## How to revert

<!-- How to undo this PR: does `git revert` of the merge/squash commit work? Say what is left after the revert
     (for example, data stored in the browser) and whether the frontend/backend pair must be reverted in a
     particular order. -->

## Notes for reviewers

<!-- Anything tricky, a design decision you made, or areas you would like extra scrutiny on.
     If you added UI text, list the i18n coverage here (which languages have the new keys). -->
