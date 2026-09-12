# Pikulin Kitchen deployment notes

The public recipe browser is static and works with no secrets. The private editor writes recipes back to GitHub through a Cloudflare Pages Function, so its credentials remain server-side.

## Cloudflare Pages secrets

In Workers & Pages → `pikulin-net` → Settings → Variables and Secrets, add these to Production (and Preview if you want the editor to work in previews):

- `RECIPE_ADMIN_PASSWORD` — the password used to unlock `/recipe-admin.html`.
- `GITHUB_RECIPE_TOKEN` — a fine-grained GitHub personal access token restricted to the `dpikulin/pikulin.net` repository with **Contents: Read and write** permission.

Optional variables:

- `RECIPE_REPO=dpikulin/pikulin.net`
- `RECIPE_BRANCH=main`

The optional values already match the code defaults.

After adding or changing secrets, redeploy so Cloudflare binds them to the Pages Function.

## Security notes

- Never commit either secret to GitHub.
- The repository is public, so recipe JSON and kitchen notes are public too.
- The editor page is deliberately unlinked and marked `noindex`, but the password is the actual security boundary.
- The browser sends the editor password only to the same-origin Cloudflare Function over HTTPS. The function verifies it and uses the GitHub token server-side.

## URLs

- Public recipe box: `/recipes.html`
- Private editor: `/recipe-admin.html`
- Recipe API: `/api/recipes`

## ChatGPT recipe workflow

Finalized recipes can also be committed directly through the connected GitHub workflow. Follow `recipes/README.md`: create/update the recipe JSON and the searchable `recipes/index.json` manifest together.
