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

## Private email intake

Incoming messages to `recipes@pikulin.net` are handled by the separate Worker in `workers/recipe-email`. The Worker accepts mail only from an explicit sender allowlist and stores it in a private R2 bucket. The protected recipe editor reads that bucket through `/api/recipe-drafts`. No emailed content is committed to the public repository until it is reviewed and saved.

### One-time Cloudflare setup

1. In **R2 Object Storage**, create a bucket named `pikulin-recipe-drafts`.
2. In **Workers & Pages → pikulin-net → Settings → Bindings**, add an R2 bucket binding:
   - Variable name: `RECIPE_DRAFTS`
   - Bucket: `pikulin-recipe-drafts`
3. Redeploy the Pages project so `/api/recipe-drafts` receives the binding.
4. From `workers/recipe-email`, run `npm install` and `npm run deploy`, or create a Worker named `pikulin-recipe-email` from that source.
5. In the Worker's settings, confirm its R2 binding is named `RECIPE_DRAFTS` and points to `pikulin-recipe-drafts`.
6. Add `ALLOWED_RECIPE_SENDERS` to the Worker as a secret or variable. Use a comma-separated list of the personal addresses allowed to submit recipes.
7. In **Compute → Email Service → Email Routing**, onboard `pikulin.net` if needed, then create the custom address `recipes@pikulin.net` with the action **Send to a Worker** and choose `pikulin-recipe-email`.
8. Send a test email from an allowlisted address. It should appear under **Pending recipe drafts** after signing into `/recipe-admin.html`.

The Worker rejects non-allowlisted senders and messages larger than 20 MB. Attachments remain private in R2 and are deleted with the draft after a successful publish.

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

## Deployment note

Production redeploy triggered September 12, 2026 after configuring the recipe editor secret.
Production redeploy triggered again September 12, 2026 after configuring `GITHUB_RECIPE_TOKEN`.
