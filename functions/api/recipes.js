const DEFAULT_REPO = 'dpikulin/pikulin.net';
const DEFAULT_BRANCH = 'main';

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'check';

  if (!env.RECIPE_ADMIN_PASSWORD) return json({ error: 'RECIPE_ADMIN_PASSWORD is not configured in Cloudflare Pages.' }, 503);
  if (!(await authorized(request, env.RECIPE_ADMIN_PASSWORD))) return json({ error: 'Incorrect recipe editor password.' }, 401);
  if (action === 'check') return json({ ok: true });
  if (action !== 'save') return json({ error: 'Unknown recipe action.' }, 400);
  if (!env.GITHUB_RECIPE_TOKEN) return json({ error: 'GITHUB_RECIPE_TOKEN is not configured in Cloudflare Pages.' }, 503);

  try {
    const raw = await request.json();
    const recipe = normalizeRecipe(raw);
    const repo = env.RECIPE_REPO || DEFAULT_REPO;
    const branch = env.RECIPE_BRANCH || DEFAULT_BRANCH;
    const result = await commitRecipe({ token: env.GITHUB_RECIPE_TOKEN, repo, branch, recipe });
    return json({ ok: true, slug: recipe.slug, commit: result.commitSha });
  } catch (error) {
    return json({ error: error.message || 'Recipe save failed.' }, error.status || 500);
  }
}

async function authorized(request, expectedPassword) {
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!supplied) return false;
  const [a, b] = await Promise.all([sha256(supplied), sha256(expectedPassword)]);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

function normalizeRecipe(raw) {
  if (!raw || typeof raw !== 'object') throw badRequest('Recipe payload is missing.');
  const title = cleanText(raw.title, 120);
  const category = cleanText(raw.category, 80);
  const ingredients = cleanList(raw.ingredients, 100, 300);
  const steps = cleanList(raw.steps, 80, 1200);
  if (!title) throw badRequest('Recipe title is required.');
  if (!category) throw badRequest('Recipe category is required.');
  if (!ingredients.length) throw badRequest('At least one ingredient is required.');
  if (!steps.length) throw badRequest('At least one direction is required.');

  const slug = slugify(cleanText(raw.slug, 140) || title);
  if (!slug) throw badRequest('A valid recipe slug could not be created.');

  const image = cleanText(raw.image, 1200);
  if (image && !/^https?:\/\//i.test(image)) throw badRequest('Image URL must begin with http:// or https://.');

  return {
    slug,
    title,
    description: cleanText(raw.description, 360),
    category,
    tags: cleanList(raw.tags, 30, 60),
    image,
    prepTime: cleanText(raw.prepTime, 60),
    cookTime: cleanText(raw.cookTime, 60),
    totalTime: cleanText(raw.totalTime, 60),
    yield: cleanText(raw.yield, 80),
    ingredients,
    steps,
    notes: cleanText(raw.notes, 4000, true),
  };
}

async function commitRecipe({ token, repo, branch, recipe }) {
  const headers = githubHeaders(token);
  const api = `https://api.github.com/repos/${repo}`;
  const now = new Date().toISOString();

  const ref = await ghJson(`${api}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
  const parentSha = ref.object?.sha;
  if (!parentSha) throw new Error('GitHub did not return the current branch commit.');

  const parentCommit = await ghJson(`${api}/git/commits/${parentSha}`, { headers });
  const baseTree = parentCommit.tree?.sha;
  if (!baseTree) throw new Error('GitHub did not return the current repository tree.');

  const manifest = await loadManifest(api, branch, headers);
  const existing = manifest.find(item => item.slug === recipe.slug);
  const fullRecipe = {
    ...recipe,
    created: existing?.created || now,
    updated: now,
  };
  const summary = {
    slug: fullRecipe.slug,
    title: fullRecipe.title,
    description: fullRecipe.description,
    category: fullRecipe.category,
    tags: fullRecipe.tags,
    image: fullRecipe.image,
    prepTime: fullRecipe.prepTime,
    cookTime: fullRecipe.cookTime,
    totalTime: fullRecipe.totalTime,
    yield: fullRecipe.yield,
    created: fullRecipe.created,
    updated: fullRecipe.updated,
    searchText: [fullRecipe.title, fullRecipe.description, fullRecipe.category, ...fullRecipe.tags, ...fullRecipe.ingredients].join(' '),
  };

  const nextManifest = manifest.filter(item => item.slug !== fullRecipe.slug);
  nextManifest.push(summary);
  nextManifest.sort((a, b) => a.title.localeCompare(b.title));

  const [recipeBlob, manifestBlob] = await Promise.all([
    createBlob(api, headers, `${JSON.stringify(fullRecipe, null, 2)}\n`),
    createBlob(api, headers, `${JSON.stringify(nextManifest, null, 2)}\n`),
  ]);

  const tree = await ghJson(`${api}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTree,
      tree: [
        { path: `recipes/${fullRecipe.slug}.json`, mode: '100644', type: 'blob', sha: recipeBlob.sha },
        { path: 'recipes/index.json', mode: '100644', type: 'blob', sha: manifestBlob.sha },
      ],
    }),
  });

  const commit = await ghJson(`${api}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `Recipe: ${fullRecipe.title}`,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });

  await ghJson(`${api}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { commitSha: commit.sha };
}

async function loadManifest(api, branch, headers) {
  const response = await fetch(`${api}/contents/recipes/index.json?ref=${encodeURIComponent(branch)}`, { headers });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Could not read recipe index from GitHub (${response.status}).`);
  const payload = await response.json();
  const content = decodeBase64(payload.content || '');
  const parsed = JSON.parse(content || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

async function createBlob(api, headers, content) {
  return ghJson(`${api}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
}

async function ghJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `GitHub request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status >= 400 && response.status < 500 ? 502 : response.status;
    throw error;
  }
  return payload;
}

function githubHeaders(token) {
  return {
    'accept': 'application/vnd.github+json',
    'authorization': `Bearer ${token}`,
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'pikulin-net-recipe-editor',
  };
}

function decodeBase64(value) {
  const normalized = value.replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function cleanText(value, maxLength, preserveLines = false) {
  if (value == null) return '';
  let text = String(value).replace(/\r/g, '').trim();
  if (!preserveLines) text = text.replace(/\s+/g, ' ');
  return text.slice(0, maxLength);
}
function cleanList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}
function slugify(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}
function badRequest(message) { const error = new Error(message); error.status = 400; return error; }
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
