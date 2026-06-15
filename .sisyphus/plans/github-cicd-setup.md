# Plan: GitHub Push + CI/CD Setup

## TL;DR
> Stage and commit the directory flattening changes, create a GitHub repo named `opencode-token-optimizer`, add a CI/CD publish workflow, and push.

---

## Work Objectives

### Core Objective
Push the `opencode-token-optimizer` plugin to GitHub with automated npm publishing via GitHub Actions.

### Concrete Deliverables
- GitHub repo `opencode-token-optimizer` created
- All source files committed (including `.sisyphus/`)
- `.github/workflows/publish.yml` — automated npm publish on version tags
- `package.json` updated with `files` and `publishConfig`
- Pushed to `main` on GitHub

### Definition of Done
- [ ] `git push` succeeds and repo is viewable on GitHub
- [ ] `.github/workflows/publish.yml` exists on the remote

---

## TODOs

- [ ] 1. Prepare `.gitignore` and `package.json`

  **What to do**:
  - Add `.DS_Store` to `.gitignore` (append to existing file)
  - Add to `package.json`:
    - `"files": ["dist/"]`
    - `"publishConfig": { "access": "public" }`

  **Files**: `.gitignore`, `package.json`

  **Acceptance**: `cat .gitignore` shows `.DS_Store` on line 3; `cat package.json` shows `files` and `publishConfig`.

- [ ] 2. Stage and commit all changes

  **What to do**:
  - `git add -A` (stages deletions from flattening + new root-level files + .sisyphus/)
  - `git commit -m "chore: flatten nested directory structure"`

  **Files**: (all tracked changes)

  **Acceptance**: `git status` shows clean working tree.

- [ ] 3. Create GitHub repo and push

  **What to do**:
  - `gh repo create opencode-token-optimizer --public --push --source=. --remote=origin`
  - If `gh` is not authenticated, print instructions for `gh auth login` first

  **Acceptance**: `git remote -v` shows `origin` pointing to `github.com/<user>/opencode-token-optimizer`; `git log --oneline origin/main -1` matches local latest.

- [ ] 4. Create GitHub Actions publish workflow

  **What to do**:
  - Create `.github/workflows/publish.yml` with:
    ```yaml
    name: Publish to npm
    on:
      push:
        tags:
          - 'v*'
    jobs:
      publish:
        runs-on: ubuntu-latest
        permissions:
          contents: read
        steps:
          - uses: actions/checkout@v4
          - uses: oven-sh/setup-bun@v2
            with:
              bun-version: latest
          - run: bun install && bun run build
          - run: npm publish
            env:
              NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    ```
  - Commit and push: `git add .github/ && git commit -m "ci: add npm publish workflow" && git push`

  **Acceptance**: `.github/workflows/publish.yml` exists on GitHub remote.

---

## Notes
- No npm token is available yet — the workflow won't trigger until user creates a GitHub secret named `NPM_TOKEN` and pushes a `v*` tag
- User should run `gh auth login` first if GitHub CLI isn't authenticated
