# Dual-remote push — `origin` + `demo`

This repo pushes to **two** GitHub remotes. Any time code is pushed, it must go
to both or the Vercel preview on the demo repo falls behind.

## Remotes

| Remote   | URL                                                      | Purpose                                                         |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `origin` | `https://github.com/nhorto/takeoff-agent-app.git`        | Primary repo. Branches push as-is (e.g. `frontend/workbench-hybrid`). |
| `demo`   | `https://github.com/nhorto/takeoff-ai-ui-demo.git`       | Standalone demo repo deployed to Vercel. Always pushed to `main`. |

## Why two remotes

Vercel on the free tier only builds previews for pushes to the repo root branch
it's wired to. `frontend/workbench-hybrid` can't deploy directly from `origin`
without merging to `main`. The `demo` repo exists so the branch can live as the
`main` of a second repo and get Vercel previews without affecting the primary
project.

## The commands

From the current branch (`frontend/workbench-hybrid` at time of writing):

```sh
git push origin frontend/workbench-hybrid
git push demo frontend/workbench-hybrid:main
```

The second command is a refspec push — local branch `frontend/workbench-hybrid`
is pushed to the `main` branch on `demo`.

If the current branch changes, substitute its name on both sides of the demo push.

## When to push

- After any commit that touches `apps/web/`, `src/shared/`, or anything that
  affects the workbench UI.
- Pushes should normally be batched — don't push each commit individually unless
  the user asks to; push at the end of a coherent unit of work.
- Always push to **both** remotes in the same turn. Pushing to only one leaves
  the demo preview stale.

## Verification

After pushing, confirm both worked:

```sh
git log --oneline -1
git log origin/frontend/workbench-hybrid --oneline -1
git log demo/main --oneline -1
```

All three should point at the same commit SHA.

## Troubleshooting

- **`fatal: could not read Username for 'https://github.com': Device not configured`**
  The macOS keychain doesn't have a valid GitHub token. Run `gh auth status` to
  confirm, then `gh auth login -h github.com -p https -w` to re-auth, followed
  by `gh auth setup-git` to wire the credential helper back up.
- **Token invalid after a long gap**  Same fix as above — tokens can expire.
