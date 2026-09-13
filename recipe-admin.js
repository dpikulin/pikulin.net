let ADMIN_PASSWORD = '';
let RECIPE_INDEX = [];
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  $('loginForm').addEventListener('submit', authenticate);
  $('recipeForm').addEventListener('submit', saveRecipe);
  $('newRecipe').addEventListener('click', resetForm);
  $('existingRecipe').addEventListener('change', loadExistingRecipe);
});

async function authenticate(event) {
  event.preventDefault();
  const password = $('adminPassword').value;
  showLoginNotice('Checking access…');
  try {
    const response = await apiRequest('check', password, {});
    if (!response.ok) throw new Error((await safeJson(response))?.error || 'Access denied.');
    ADMIN_PASSWORD = password;
    $('adminPassword').value = '';
    $('loginPanel').classList.add('hidden');
    $('editorPanel').classList.remove('hidden');
    await refreshRecipeIndex();
  } catch (error) {
    showLoginNotice(error.message || 'Could not authenticate.', true);
  }
}

async function refreshRecipeIndex() {
  try {
    const response = await fetch('/recipes/index.json', { cache: 'no-store' });
    RECIPE_INDEX = response.ok ? await response.json() : [];
    if (!Array.isArray(RECIPE_INDEX)) RECIPE_INDEX = [];
  } catch {
    RECIPE_INDEX = [];
  }
  $('existingRecipe').innerHTML = '<option value="">New recipe</option>' + RECIPE_INDEX
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(recipe => `<option value="${escapeAttr(recipe.slug)}">${escapeHtml(recipe.title)}</option>`)
    .join('');
}

async function loadExistingRecipe() {
  const slug = $('existingRecipe').value;
  if (!slug) return resetForm(false);
  setSaveStatus('Loading recipe…');
  try {
    const response = await fetch(`/recipes/${encodeURIComponent(slug)}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load that recipe.');
    const recipe = await response.json();
    $('recipeSlug').value = recipe.slug || slug;
    $('recipeTitle').value = recipe.title || '';
    $('recipeDescription').value = recipe.description || '';
    $('recipeCategory').value = recipe.category || '';
    $('recipeTags').value = (recipe.tags || []).join(', ');
    $('recipeImage').value = recipe.image || '';
    $('recipePrep').value = recipe.prepTime || '';
    $('recipeCook').value = recipe.cookTime || '';
    $('recipeTotal').value = recipe.totalTime || '';
    $('recipeYield').value = recipe.yield || '';
    $('recipeIngredients').value = (recipe.ingredients || []).join('\n');
    $('recipeSteps').value = (recipe.steps || []).join('\n');
    $('recipeNotes').value = recipe.notes || '';
    setSaveStatus(`Editing ${recipe.title}`);
  } catch (error) {
    setSaveStatus(error.message || 'Could not load recipe.', true);
  }
}

async function saveRecipe(event) {
  event.preventDefault();
  if (!ADMIN_PASSWORD) return;
  const recipe = {
    slug: $('recipeSlug').value.trim(),
    title: $('recipeTitle').value.trim(),
    description: $('recipeDescription').value.trim(),
    category: $('recipeCategory').value.trim(),
    tags: splitCsv($('recipeTags').value),
    image: $('recipeImage').value.trim(),
    prepTime: $('recipePrep').value.trim(),
    cookTime: $('recipeCook').value.trim(),
    totalTime: $('recipeTotal').value.trim(),
    yield: $('recipeYield').value.trim(),
    ingredients: splitLines($('recipeIngredients').value),
    steps: splitLines($('recipeSteps').value),
    notes: $('recipeNotes').value.trim(),
  };

  $('saveRecipe').disabled = true;
  setSaveStatus('Saving to GitHub…');
  try {
    const response = await apiRequest('save', ADMIN_PASSWORD, recipe);
    const payload = await safeJson(response);
    if (!response.ok) throw new Error(payload?.error || `Save failed (${response.status}).`);
    $('recipeSlug').value = payload.slug;
    setSaveStatus('Saved. Cloudflare will publish the new commit automatically.', false, true);
    await refreshRecipeIndex();
    $('existingRecipe').value = payload.slug;
  } catch (error) {
    setSaveStatus(error.message || 'Could not save recipe.', true);
  } finally {
    $('saveRecipe').disabled = false;
  }
}

function resetForm(resetPicker = true) {
  $('recipeForm').reset();
  $('recipeSlug').value = '';
  if (resetPicker) $('existingRecipe').value = '';
  setSaveStatus('New recipe ready.');
}

function apiRequest(action, password, body) {
  return fetch(`/api/recipes?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${password}`,
    },
    body: JSON.stringify(body || {}),
  });
}

function showLoginNotice(message, error = false) {
  $('loginNotice').textContent = message;
  $('loginNotice').className = error ? 'notice error-notice' : 'notice';
}
function setSaveStatus(message, error = false, success = false) {
  $('saveStatus').textContent = message;
  $('saveStatus').className = `save-status${error ? ' error' : success ? ' success' : ''}`;
}
function splitLines(value) { return value.split('\n').map(v => v.trim()).filter(Boolean); }
function splitCsv(value) { return value.split(',').map(v => v.trim()).filter(Boolean); }
async function safeJson(response) { try { return await response.json(); } catch { return null; } }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function escapeAttr(value = '') { return escapeHtml(value); }
