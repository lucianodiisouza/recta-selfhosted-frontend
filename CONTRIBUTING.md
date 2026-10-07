# Contributing to Recta (frontend)

Thanks for wanting to contribute. This guide covers how to set up the project, which checks must pass
before you push, and the rules reviewers apply. The README explains what the project is; this file explains
how to change it.

## Dev setup

```bash
git clone https://github.com/lucianodiisouza/recta-selfhosted-frontend
cd recta-selfhosted-frontend
npm ci
cp .env.example .env    # fill in the API URL and the Firebase configuration
npm run dev
```

Requirements: Node.js 20.19 or newer, or 22.12 or newer (a Vite 7 requirement; CI tests 20.19 and 22) and a running backend
([recta-selfhosted-backend](https://github.com/lucianodiisouza/recta-selfhosted-backend)).

### The commit hook (husky)

`npm ci` installs the `.husky/pre-commit` hook. When a commit includes `.ts`, `.tsx` or `.js` files, it:

1. runs `eslint --fix` on the staged files (a failure aborts the commit);
2. runs `scripts/bump-version.js`, which **asks** for a version bump type and, depending on the answer,
   edits `package.json`.

In pull requests do **not** change the version: answer **`4` (Skip version bump)** and, before pushing,
check that `package.json` did not get a modified `version` line (`git show --stat` of each commit). Whoever
cuts the release decides the version. Without a terminal (CI, scripts) the hook asks nothing and the
version stays untouched.

## Commit attribution

GitHub associates commits with accounts through the author e-mail stored in each commit. Before pushing a
branch, inspect every commit that the pull request will add:

```bash
git log --format='%h %an <%ae>' "$(git merge-base HEAD origin/main)"..HEAD
```

Use an e-mail verified by your GitHub account, or its GitHub-provided `noreply` address. Set it for this
checkout when your global Git identity belongs to a different project or employer:

```bash
git config --local user.name "Your Name"
git config --local user.email "your-verified-address@example.com"
```

Correct attribution mistakes on the pull-request branch before it is merged. The project does not rewrite
shared `main` history or published release tags solely to change attribution, because doing so invalidates
commit hashes and breaks existing clones and forks.

## Required gates before push/merge

All of these must pass; CI (`.github/workflows/ci.yml`) runs the same steps on every pull request.

```bash
npm ci
npm run check:tsc      # tsc --noEmit with no new errors versus tsc-baseline.txt
npm run lint           # 0 errors
npm run build
npm test               # vitest run
git diff --check
```

### Typecheck: "no new errors"

The repository has older type errors, listed in `tsc-baseline.txt` (one per line, without line numbers).
`npm run build` is `vite build` and does **not** type-check, so those errors never blocked anything.
`npm run check:tsc` runs `tsc --noEmit` and fails **only** when an error appears that is not on the list.

- Your PR introduced an error: fix it. Do not add it to the list.
- Your PR fixed old errors: run `npm run check:tsc -- --update` and include the smaller
  `tsc-baseline.txt` in the PR. The command refuses to write if any error is new; the list can only shrink.
- The list cannot be edited by hand to hide an error: on pull requests CI compares `tsc-baseline.txt`
  with the copy on the base branch (`node scripts/check-tsc-baseline.mjs --against <file>`) and fails if any
  entry was added. Only removals pass.
- `npx tsc --noEmit` prints the errors with line and column so you can navigate to them.

### Tests

`npm test` runs `src/**/*.test.{ts,tsx}` with Vitest. Tests run in a Node environment; a component test opts
into a DOM with a `// @vitest-environment jsdom` comment on its first line and uses Testing Library
(`jsdom` and `@testing-library/react` are devDependencies; `jsdom` is kept on the 26 line so tests run on
Node 20, which the README supports). Mock the context hooks (`useAuth`, `useI18n`) instead of mounting the
providers, as `src/pages/Login.test.tsx` does. `npx vitest run src/utils/file.test.ts` runs a single
file; `npx vitest` starts watch mode.

## Contribution rules

1. **One PR = one feature (or fix) that can be reverted on its own.** If `git revert` of the PR leaves a
   project that no longer compiles or passes its tests, the PR is too large or too coupled. Prefer small
   PRs in sequence over one PR that mixes topics.
2. **No dead code and no half-built features.** Do not leave unused functions, unreachable branches,
   ownerless `TODO`s or commented-out code. Deferred work goes in an issue.
3. **Comments explain why, never what.** Do not comment what the next line already says. Comment the
   constraint, the edge case or the bug that justifies the code.
4. **Write tests before claiming done.** Write the test, watch it fail, then make it pass. This matters
   most for amount and date calculations, file parsers and form rules. A bug-fix test must fail without the
   fix. Tests live next to the code (`src/**/*.test.ts`), use synthetic values and **never** real data
   (statements, names, e-mails).
5. **Do not refactor outside the scope.** Touch only what the PR requires. Refactoring is another PR.
6. **All user-visible text goes through the i18n system (`src/i18n/`).** New keys are required in `pt-BR`
   and `en-US`; the other six languages are desirable (missing keys fall back to `en-US`). Describe the
   coverage in the PR. Do not hard-code text in components.
7. **Additive contract with the backend.** Treat a response without the new field, or a missing route
   (404), as "feature unavailable" and hide the entry point in the UI, so that backend and frontend can be
   reverted in any order.
8. **Commits in English, Conventional Commits style** (`feat(scope): ...`, `fix(scope): ...`,
   `chore: ...`, `docs: ...`, `test: ...`, `refactor: ...`). Messages explain the why when it is not obvious.
9. **The CHANGELOG is a merge gate** (next section).

## The CHANGELOG is a merge gate

Every **user-visible** change must add an entry to `CHANGELOG.md` under `## [Unreleased]` in the same PR.
That includes: a new screen, dialog or option, changed text, any changed behaviour or initial value, and
any observable bug fix. Internal refactors, dead-code removal and test-only churn are exempt.

Reviewers treat a missing entry as **blocking**; the PR template has a checkbox for it. Write one
past-tense sentence and place it under the right heading (`### Added`, `### Changed`, `### Fixed`, ...).
After opening the PR, append its number to the entry as a reference-style link and define the link at the
bottom of `CHANGELOG.md`:

```markdown
- Added the "Adjust balance" dialog ([#123]).

[#123]: https://github.com/lucianodiisouza/recta-selfhosted-frontend/pull/123
```

## Versioning and deprecation policy

This project follows [Semantic Versioning](https://semver.org/):

- **Patch** (`x.y.Z`): fixes that do not change flows or the format of data stored in the browser.
- **Minor** (`x.Y.0`): additive changes (screen, dialog, option). Existing behaviour is preserved.
- **Major** (`X.0.0`): breaking changes, including a removed flow or a change in the format of data stored
  in the browser without a migration.

Put your CHANGELOG entry under the heading that matches its semver impact: a fix filed under `Added` (or
vice versa) can make the maintainer pick the wrong version. Do not change the `version` field of
`package.json` in a PR (see "The commit hook"). The root `version` recorded in `package-lock.json` follows
`package.json`; if npm rewrites it (it did once, when the lock had fallen behind), commit that on its own as
`chore(deps): sync lockfile root version`. If your change is breaking, say so in the PR description and
check "Major" in the template.

Deprecated items go under `### Deprecated` in the CHANGELOG and are removed no sooner than the following
major release.
