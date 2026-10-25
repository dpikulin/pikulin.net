# Pikulin Dice v1

Page: `/dice` (Cloudflare Pages serves `dice.html`). API: `/api/dice`.

## Storage

The API uses the R2 binding `DICE_ROLLS`, or the existing `RECIPE_DRAFTS` binding if present. It only reads/writes `dice/v1/rolls/`. Recipe draft endpoints only access `drafts/`; no recipe content is exposed by the dice API.

If neither binding is configured, add an R2 bucket binding to the **pikulin-net** Pages project under **Settings → Bindings**:

- Variable name: `DICE_ROLLS`
- Bucket: a new bucket named `pikulin-dice-rolls`

Redeploy after binding changes. Do not switch buckets after use without copying the `dice/v1/rolls/` objects, or old codes will stop resolving. Keep the bucket private; access is through the dice API. Do not configure automatic expiry for these records.

No email service, new secret, database schema, or external dependency is needed.

## Behavior

- 1–100 dice per expression, 2–1000 sides each; integer modifiers up to 1,000,000.
- Normal mode supports mixed dice and +/− terms. Advantage/disadvantage supports one positive d20 and modifiers.
- Server Web Crypto with rejection sampling. Client-supplied totals are ignored.
- One conditional object write stores the immutable result and the history entry. No edit/delete API.
- Codes contain the server timestamp and 48 random bits. Verification retrieves the record; it never generates a roll.
- Public history lists 25 records per page, newest first. Per-name counts explicitly refer to loaded history, not lifetime totals or verified identity.
- Everyone can see player names, labels, expressions and results. Names are self-reported. No IP addresses are saved.
- A failed network response may still have saved a roll. The UI tells users to check history before retrying; requests are not automatically retried.
- This is an open, trust-based family tool. Origin checks and input limits are provided, but there is no authentication or distributed rate limiting. If traffic grows, add a Cloudflare rate limiting rule for POST `/api/dice`.

## Checks

`node --test tests/dice.test.mjs`

After deployment: open `/api/dice`, submit a clearly labeled deployment test roll, verify it by code, open the share link in a separate browser, and confirm the same record is in the log. Without storage, the API returns 503 and does not generate a roll.
