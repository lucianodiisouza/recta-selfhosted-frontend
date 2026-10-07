# Changelog

All notable changes to this project are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/). Sections are `Added`, `Changed`, `Deprecated`, `Removed`,
`Fixed` and `Security`.

## [Unreleased]

### Added

- Pull request template in `.github/pull_request_template.md`: test plan, commit attribution, release impact, CHANGELOG gate and how to revert.
- `CONTRIBUTING.md` with setup, the gates to pass before pushing, commit attribution and contribution rules.
- `CHANGELOG.md` (this file).
- Tests with [Vitest](https://vitest.dev/): `npm test` runs `src/**/*.test.ts`, starting with tests for `sanitize`.
- `npm run check:tsc`: runs `tsc --noEmit` and fails only on an error that is not in `tsc-baseline.txt` (the 92 errors that already existed).
- Continuous integration on GitHub Actions: `check:tsc`, `lint`, `build` and `vitest` on every pull request and on `main`, on Node 20.19 and 22. On pull requests it also fails when `tsc-baseline.txt` grew compared with the base branch.
- "Detect recurring" on the Recurring page: lists the monthly expenses found in the history (stable amounts and variable bills), lets you adjust amount, day and description and creates the chosen recurrences in one request. The button is hidden when the server has no detection route.
- "Follow the last value" on recurrences: a toggle in the recurrence form, a badge in the list and, when editing the most recent occurrence, a note that the value carries to the next months and a confirmation when the server updated the recurrence. The toggle is offered only when the server reports the field.
- Component tests with `jsdom` and Testing Library (dev dependencies), documented in `CONTRIBUTING.md`.

### Changed

- Editing a transaction sends the amount only when it changed, so a recurrence that follows the last value is not rewritten by an edit that only touches a note or the paid mark.

### Fixed

- A language file that lacks a key now falls back to the en-US text instead of rendering empty (or `undefined` in code that formats the text). Today es-ES and fr-FR lack 87 keys, ru-RU 119 and ja-JP, zh-CN and ar-SA 150. This fixes a crash: `monthlyRecapTitle` and `monthlyRecapQuizCorrect` were `undefined` in ru-RU, ja-JP, zh-CN and ar-SA and the monthly recap calls `.includes`, `.replace` and `.trim` on them.
- Places that wrote `t.key || '<Portuguese text>'` showed fixed Portuguese in the languages that lack the key (136 such uses in the code; 37 to 42 of them reach a given partial language); they now show the English text. Arabic is still laid out left to right, as before: the app has no right-to-left handling.

<!-- Reference entries to their PR like this (see CONTRIBUTING.md): `... ([#123]).` and, at the bottom of this file,
     `[#123]: https://github.com/lucianodiisouza/recta-selfhosted-frontend/pull/123`. -->
