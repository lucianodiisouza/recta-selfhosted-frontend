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

### Fixed

- On the credit card page, "Load more" now adds the next transactions to the invoice being shown. Before, the button spun and the list never grew.

<!-- Reference entries to their PR like this (see CONTRIBUTING.md): `... ([#123]).` and, at the bottom of this file,
     `[#123]: https://github.com/lucianodiisouza/recta-selfhosted-frontend/pull/123`. -->
