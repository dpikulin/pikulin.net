# Pikulin Kitchen recipe data

Pikulin.net stores recipes as one public JSON file per recipe plus `recipes/index.json`, which is the searchable manifest used by the public recipe page.

## Recipe file shape

```json
{
  "slug": "buffalo-chicken-dip",
  "title": "Buffalo Chicken Dip",
  "description": "Short public description.",
  "category": "Appetizers & Dips",
  "tags": ["party", "hot dip"],
  "tested": false,
  "prepTime": "15 min",
  "cookTime": "25 min",
  "totalTime": "40 min",
  "yield": "Serves 8",
  "ingredients": ["Ingredient one", "Ingredient two"],
  "steps": ["First step", "Second step"],
  "notes": "Public kitchen notes.",
  "created": "ISO timestamp",
  "updated": "ISO timestamp"
}
```

`tested` is a boolean indicating that the current recipe was made and verified by the family. New recipes default to `false`; legacy recipes with no status are considered unverified. The public recipe box shows only `tested: true` recipes by default, with a user-controlled toggle to include recipes still in development or awaiting verification. The status is stored in both the individual recipe and the searchable manifest on the next editor save.

The repository is public. Do not put private information, passwords, tokens, or truly private notes in recipe JSON.

## Manifest shape

`recipes/index.json` contains summaries with the same identification and timing fields plus a `searchText` field. Search text should include title, description, category, tags, and ingredients so ingredient searches work without loading every recipe file. The manifest also includes the `tested` flag so the public recipe listing can filter without fetching each recipe.

## Adding recipes from ChatGPT

When a cooking discussion results in a finalized recipe, the normal Pikulin.net workflow is:

1. Convert the final recipe to the schema above.
2. Use a stable kebab-case slug.
3. Create or update `recipes/<slug>.json`.
4. Create or update the matching item in `recipes/index.json`.
5. Preserve the original `created` timestamp when revising an existing recipe and update `updated`.
6. Commit both changes together when possible.

The browser-based editor at `/recipe-admin.html` performs these same repository updates through the authenticated Cloudflare Pages Function at `/api/recipes`.

## Shopping list

The public recipe box links to `/shopping-list.html`. Shoppers may select multiple recipes (including untested recipes), and each selection loads its full JSON `ingredients` list. Identical ingredient lines are grouped with an explicit multiplier rather than silently dropping repeated quantities. Differently written ingredient lines are kept separate for manual review; the application does not attempt unreliable unit conversion or synonym matching.

The shopping list supports manual items, per-item edits, removals, checkoffs, print, copy, and native share when available. Local list state is persisted in browser `localStorage` only, without authentication, cross-device synchronization, or server-side storage. Copy and share export unchecked items so the list can be transferred to another device.

Use `shopping-list.html?add=<recipe-slug>` to add a recipe to the current device's saved selection. The recipe editor remains the source of truth for recipe content; shopping-list edits never change original recipe JSON.

## Photo import (private editor)

`/recipe-admin.html` has a **Photo to recipe** panel available after the normal editor password is accepted. It can receive 1–8 images of the **same recipe** in one submission, such as the front and back of a handwritten card or several consecutive cookbook pages. The device resizes / converts decodable images to JPEG before sending them to the authenticated `POST /api/recipe-photo-import` Cloudflare Pages Function.

The function uses the OpenAI Responses API (vision + strict JSON schema) to transcribe the photos into the recipe editor's existing fields and return warnings for questionable readings. This does **not** send content into a ChatGPT conversation. The import does **not** commit a recipe, does not mark it as tested, and does not save the uploaded images in GitHub or the recipe data. The user reviews and adjusts the new draft, then presses the existing **Save recipe to Pikulin.net** button to publish it.

### Enable in Cloudflare Pages

In the site's Cloudflare Pages project, add the following **secret environment variable**, in both Production and Preview where needed:

- `OPENAI_API_KEY`: an OpenAI Platform API key with Responses API model access. Never commit this key or put it in browser JavaScript. OpenAI Platform billing is separate from ChatGPT subscription billing.

Optional variable: `RECIPE_IMPORT_MODEL` (default `gpt-4.1`, a vision-capable model). The site's existing `RECIPE_ADMIN_PASSWORD` is required and used by the import endpoint, so no second password is needed. Redeploy Pages after saving the secret if Cloudflare requires it.

Photos are transient; they are transmitted to the OpenAI API only for the requested extraction using `store: false`. API retention/privacy rules and token-based usage charges still apply. The editor exposes uncertainty warnings and never silently invents ambiguous quantities.

For **multiple different recipes**, repeat the upload/import/review/save flow once per recipe. This avoids unintentionally merging distinct cards into a single recipe. The interface supports iPhone photo picking; HEIC/HEIF pictures must be decodable by the browser for conversion to JPEG. If conversion fails, export them as JPEG first.

## Shopping-list measurement display and kitchen produce standards

`shopping-units.js` provides client-side metric, US customary, and both-unit display options for `shopping-list.html`. The selected mode is saved with the current browser's list in `localStorage` and applies to on-screen, copied, shared, and printed items. Existing recipe JSON is never modified. Recognized leading mass and volume measures are converted using standard unit constants; cups of flour, chopped onions, etc. are only converted to **mL of volume**, not invented gram weights. Unknown/ambiguous measurements remain unchanged. Identical measured ingredient lines from selected recipes aggregate their quantities; other identical lines retain explicit multipliers.

For a counted whole piece of produce, the displayed list keeps the shopping count and appends an **approximate** gram/oz estimate. Defaults (medium unless a supported size is explicit): white/yellow/red/onion 148 g; banana 118 g edible/peeled; apple 182 g; lemon 58 g; lime 67 g; orange 131 g; avocado 201 g (edible); cucumber 201 g; bell pepper 119 g; celery stalk 40 g; carrot 61 g; tomato 123 g; potato 173 g; garlic clove 3 g. Banana small 101 g and large 136 g; apple small 149 g and large 223 g. Onion small 100 g and large 250 g are rough planning assumptions, not precise measurements. No estimate replaces an explicit recipe weight. Update the `PRODUCE` table in `shopping-units.js` to revise kitchen conventions. These weights are intended for grocery planning and should not override ingredient weights needed for precise baking.

Caution: Some recipes already contain both units in the original ingredient line, and these are intentionally preserved verbatim in combined mode. Editing a shopping-list item overrides automatic formatting for that particular item until a fresh list is started.
