# Changelog

All notable changes to this project are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/). Sections are `Added`, `Changed`, `Deprecated`, `Removed`,
`Fixed` and `Security`.

## [Unreleased]

### Added

- "Adjust balance" action in the account menu (not offered for credit cards): sets the account to the balance shown by the bank with one adjustment entry, dated by the user. An opening balance can be dated at the end of the previous year so it stays out of the current year's reports. Needs the backend `adjust-balance` route with the `date` field; against an older backend the dialog warns that the entry was dated today instead of the chosen day.
- jsdom and Testing Library as dev dependencies, with the first component test (the adjust-balance dialog).
- Pull request template in `.github/pull_request_template.md`: test plan, commit attribution, release impact, CHANGELOG gate and how to revert.
- `CONTRIBUTING.md` with setup, the gates to pass before pushing, commit attribution and contribution rules.
- `CHANGELOG.md` (this file).
- Tests with [Vitest](https://vitest.dev/): `npm test` runs `src/**/*.test.ts`, starting with tests for `sanitize`.
- `npm run check:tsc`: runs `tsc --noEmit` and fails only on an error that is not in `tsc-baseline.txt` (the 92 errors that already existed).
- Continuous integration on GitHub Actions: `check:tsc`, `lint`, `build` and `vitest` on every pull request and on `main`, on Node 20.19 and 22. On pull requests it also fails when `tsc-baseline.txt` grew compared with the base branch.

<!-- Reference entries to their PR like this (see CONTRIBUTING.md): `... ([#123]).` and, at the bottom of this file,
     `[#123]: https://github.com/lucianodiisouza/recta-selfhosted-frontend/pull/123`. -->
