# Contributing to FocusFlow

Thanks for taking a look! This project is intentionally small, so the bar for
changes is simple: keep it dependency-free and keep the logic testable.

## Getting started

```bash
git clone https://github.com/Panz-08/FirstProject.git
cd FirstProject
npm start   # serves the site at http://localhost:4173
npm test    # runs the node:test suite
```

There is no install step and no bundler. Node.js 22 or newer is required for
the test runner.

## What makes a good pull request

- **One concern per pull request.** Small, focused changes are easier to review.
- **Tests for logic changes.** Anything in `assets/js/timer.js`, `tasks.js`,
  `storage.js`, or `format.js` should come with a test in `tests/`.
- **No new dependencies.** The zero-dependency constraint is a feature, not an
  accident.
- **Accessibility in mind.** Keep focus states visible, labels meaningful, and
  new motion friendly to `prefers-reduced-motion`.

## Code style

- Modern ES modules, no transpiler.
- Two-space indentation, semicolons, single quotes.
- Keep DOM access in `main.js`; pure logic belongs in the other modules.
- Prefer small functions with JSDoc types over clever one-liners.

## Commit messages

This repository loosely follows [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add custom session lengths
fix: keep the ring in sync after a skip
docs: clarify the local storage keys
test: cover midnight stats rollover
```

## Reporting a bug

Open an issue with:

1. What you expected to happen.
2. What actually happened.
3. Browser and operating system.
4. Steps to reproduce, if you have them.

Please do not paste personal task text or other private data into an issue.

## License

By contributing you agree that your changes are released under the
[MIT License](LICENSE).
