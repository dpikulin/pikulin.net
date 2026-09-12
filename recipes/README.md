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

The repository is public. Do not put private information, passwords, tokens, or truly private notes in recipe JSON.

## Manifest shape

`recipes/index.json` contains summaries with the same identification and timing fields plus a `searchText` field. Search text should include title, description, category, tags, and ingredients so ingredient searches work without loading every recipe file.

## Adding recipes from ChatGPT

When a cooking discussion results in a finalized recipe, the normal Pikulin.net workflow is:

1. Convert the final recipe to the schema above.
2. Use a stable kebab-case slug.
3. Create or update `recipes/<slug>.json`.
4. Create or update the matching item in `recipes/index.json`.
5. Preserve the original `created` timestamp when revising an existing recipe and update `updated`.
6. Commit both changes together when possible.

The browser-based editor at `/recipe-admin.html` performs these same repository updates through the authenticated Cloudflare Pages Function at `/api/recipes`.
