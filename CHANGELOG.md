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
- Import bank statements from the Transactions page: pick the destination account and an OFX or CSV file, review the preview (new rows versus duplicates, plus the lines that could not be read and a warning for credit card invoices) and confirm. The dialog cannot be closed while the import is being written, says how far it got if the server stopped half way, and the button hides when the server has no importer. Texts are available in all eight languages.
- Component tests with jsdom and Testing Library (new devDependencies) for the import dialog.
- Credit Cards page: an "Invoice (OFX)" button opens a preview of a card invoice exported by the bank. It shows the invoice month (taken from the file and the card's due day, or chosen by the user), the statement period and totals, how the invoice's payment compares with what is recorded for the previous invoice, and the lines that could not be read. It is read-only: nothing is saved. It needs the backend preview endpoint and hides itself for the session when the server answers that it has none. Texts in all eight languages (the six besides pt-BR and en-US were machine translated).
- Credit Cards page, invoice (OFX) dialog: after the preview the user decides what to do with each new line (import, skip, or link to the existing transaction when it looks like one typed by hand; those come set to skip), picks a category per merchant (preset from what the household last used) and confirms. The result lists what was created, linked and left out and why, and says where an import stopped. Importing the same file again creates nothing twice. A second import of the same card while one is running is refused with a message (the selection is kept), and an import that stopped half way can be sent again with one click. Needs the backend confirm endpoint; the eight languages again, the machine-translated six needing a native review.

### Changed

- The credit card form asks for a single closing day instead of the "best day" offset. Typing the due day fills the closing day with due day - 7 (due 9 closes on 2, due 3 on 26) until the user types their own; the card page shows the effective closing day as the best day to buy, and installments use it too.
- Creating an account from the app (`addAccount`) now sends `closingDay` to the API, and no longer sends `bestDayOffset`.

### Fixed

- Installments on a card without a stored closing day are placed in the right invoice, using the closing day derived from the due day.

<!-- Reference entries to their PR like this (see CONTRIBUTING.md): `... ([#123]).` and, at the bottom of this file,
     `[#123]: https://github.com/lucianodiisouza/recta-selfhosted-frontend/pull/123`. -->
