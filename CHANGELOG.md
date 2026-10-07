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
- People page (menu entry "People") for expenses shared with someone who has no Recta account: what each person owes you or what you owe them, the net, and a statement per person with a running balance. People can be added, renamed, given nicknames, deactivated and deleted (a person with history is deactivated instead). The page and the menu entry hide when the server has no people routes.
- Split a transaction with people: a "Split" action on expenses in the transactions list and in the credit card invoice (equal, exact, percent and shares strategies with a live preview that the server can double-check, people created on the spot), and "Record settlement" on a person, which can create the income or expense on an account, link an existing one, or only record it, and can be undone from the statement (the linked transaction stays). The action is hidden when the server has no people routes.

### Fixed

- A language file that lacks a key now falls back to the en-US text instead of rendering empty (or `undefined` in code that formats the text). Today es-ES and fr-FR lack 87 keys, ru-RU 119 and ja-JP, zh-CN and ar-SA 150: those texts now show in English (including in right-to-left Arabic) until they are translated.

<!-- Reference entries to their PR like this (see CONTRIBUTING.md): `... ([#123]).` and, at the bottom of this file,
     `[#123]: https://github.com/lucianodiisouza/recta-selfhosted-frontend/pull/123`. -->
