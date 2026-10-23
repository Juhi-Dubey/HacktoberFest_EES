# Contributing to CodeArena

Welcome, Hack Day participant! Here's how to go from zero to a merged pull request.

## 1. Pick an issue

- Browse the [Issues](../../issues). Every issue has a difficulty label: `easy` (10 points), `medium` (20 points) or `hard` (30 points).
- New to open source? Start with an issue labelled `good first issue`.
- Comment **"claim"** on the issue so others know you're on it. A team can hold **at most 2** issues at once.
- If you don't open a PR within **2 hours**, the issue goes back up for grabs.
- Some issues say "blocked by #N". Wait until that one is merged.

## 2. Make your change

```bash
# fork the repo on GitHub first, then:
git clone https://github.com/<your-username>/HacktoberFest_EES.git
cd HacktoberFest_EES
git checkout -b fix-dark-mode     # one branch per issue
npm install
npm run dev
```

Keep the change focused on the issue. A small PR that does one thing well beats a big one that does five things halfway.

## 3. Open a pull request

- Title: what you changed, e.g. `Fix dark mode so it covers the whole page`
- In the description, write `Closes #<issue number>`, explain what you changed, and add a screenshot or GIF if the change is visible.
- Make sure `npm run build` still works.

Judges reward PRs that are **clear, working, and well explained**, not just big ones.

## Adding a new problem

Each problem lives in its own folder under `problems/`:

```
problems/two-sum/
  meta.json        title, difficulty, tags, time limit
  statement.md     the problem statement in Markdown
  tests/1.in       input for test 1
  tests/1.out      expected output for test 1
  tests/2.in ...
```

`meta.json` looks like this:

```json
{
  "title": "Two Sum",
  "difficulty": "Easy",
  "tags": ["arrays"],
  "order": 6,
  "timeLimitMs": 2000
}
```

- Use a lowercase folder name with dashes (`two-sum`, not `Two Sum`).
- Add at least 5 tests, including tricky edge cases.
- Write your own solution and make sure it gets Accepted before you open the PR.

## Ground rules

- **Never run submitted code on the server.** No `eval`, `exec` or `child_process` in `server/`. User code only runs in the browser.
- Be kind. Everyone here is learning, and that includes the organisers.
