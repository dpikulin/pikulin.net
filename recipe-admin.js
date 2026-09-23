let ADMIN_PASSWORD = '';
let RECIPE_INDEX = [];
let EMAIL_DRAFTS = [];
let ACTIVE_DRAFT = null;
let ATTACHMENT_URLS = [];
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  $('loginForm').addEventListener('submit', authenticate);
  $('recipeForm').addEventListener('submit', saveRecipe);
  $('newRecipe').addEventListener('click', resetForm);
  $('existingRecipe').addEventListener('change', loadExistingRecipe);
  $('refreshDrafts').addEventListener('click', refreshEmailDrafts);
  $('emailDraft').addEventListener('change', previewEmailDraft);
  $('loadDraft').addEventListener('click', loadEmailDraft);
  $('deleteDraft').addEventListener('click', deleteEmailDraft);
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
    await Promise.all([refreshRecipeIndex(), refreshEmailDrafts()]);
  } catch (error) {
    showLoginNotice(error.message || 'Could not authenticate.', true);
  }
}

async function refreshEmailDrafts() {
  setDraftNotice('Checking for emailed recipes…');
  try {
    const response = await draftApi('list');
    const payload = await safeJson(response);
    if (!response.ok) throw new Error(payload?.error || 'Could not load emailed recipes.');
    EMAIL_DRAFTS = Array.isArray(payload?.drafts) ? payload.drafts : [];
    $('emailDraft').innerHTML = EMAIL_DRAFTS.length
      ? '<option value="">Choose an emailed recipe</option>' + EMAIL_DRAFTS.map(draft => `<option value="${escapeAttr(draft.id)}">${escapeHtml(draft.subject)} · ${escapeHtml(formatDate(draft.received))}</option>`).join('')
      : '<option value="">No pending drafts</option>';
    clearDraftPreview();
    setDraftNotice(EMAIL_DRAFTS.length ? `${EMAIL_DRAFTS.length} pending draft${EMAIL_DRAFTS.length === 1 ? '' : 's'}.` : 'No emailed recipes are waiting.');
  } catch (error) {
    EMAIL_DRAFTS = [];
    $('emailDraft').innerHTML = '<option value="">Draft queue unavailable</option>';
    clearDraftPreview();
    setDraftNotice(error.message || 'Could not load emailed recipes.', true);
  }
}

async function previewEmailDraft() {
  const id = $('emailDraft').value;
  clearDraftPreview();
  if (!id) return;
  setDraftNotice('Loading emailed recipe…');
  try {
    const response = await draftApi('get', { id });
    const payload = await safeJson(response);
    if (!response.ok) throw new Error(payload?.error || 'Could not load that draft.');
    ACTIVE_DRAFT = payload;
    $('draftMeta').textContent = `From ${payload.from || 'unknown sender'} · ${formatDate(payload.received)}`;
    $('draftBody').textContent = payload.text || '(No text body. See attachments.)';
    await renderAttachments(payload);
    $('draftPreview').classList.remove('hidden');
    $('loadDraft').disabled = false;
    $('deleteDraft').disabled = false;
    setDraftNotice('Draft ready to review.');
  } catch (error) {
    setDraftNotice(error.message || 'Could not load that draft.', true);
  }
}

async function renderAttachments(draft) {
  const container = $('draftAttachments');
  container.innerHTML = '';
  for (const attachment of (draft.attachments || [])) {
    const response = await draftApi('attachment', { id: draft.id, index: attachment.index });
    if (!response.ok) continue;
    const url = URL.createObjectURL(await response.blob());
    ATTACHMENT_URLS.push(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename || 'recipe-attachment';
    link.textContent = `${attachment.filename} (${formatBytes(attachment.size)})`;
    container.appendChild(link);
  }
}

function loadEmailDraft() {
  if (!ACTIVE_DRAFT) return;
  const recipe = ACTIVE_DRAFT.recipe || {};
  $('recipeSlug').value = recipe.slug || '';
  $('recipeTitle').value = recipe.title || ACTIVE_DRAFT.subject || '';
  $('recipeDescription').value = recipe.description || '';
  $('recipeCategory').value = recipe.category || 'Other';
  $('recipeTags').value = (recipe.tags || ['emailed recipe']).join(', ');
  $('recipeImage').value = recipe.image || '';
  $('recipePrep').value = recipe.prepTime || '';
  $('recipeCook').value = recipe.cookTime || '';
  $('recipeTotal').value = recipe.totalTime || '';
  $('recipeYield').value = recipe.yield || '';
  $('recipeIngredients').value = (recipe.ingredients || []).join('\n');
  $('recipeSteps').value = (recipe.steps || []).join('\n');
  $('recipeNotes').value = recipe.notes || '';
  $('existingRecipe').value = '';
  setSaveStatus('Email draft loaded. Review every field before publishing.');
  $('recipeTitle').focus();
  $('recipeForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteEmailDraft() {
  if (!ACTIVE_DRAFT) return;
  const subject = ACTIVE_DRAFT.subject || 'this recipe';
  if (!window.confirm(`Delete the emailed draft “${subject}”?`)) return;
  setDraftNotice('Deleting draft…');
  try {
    const response = await draftApi('delete', { id: ACTIVE_DRAFT.id });
    const payload = await safeJson(response);
    if (!response.ok) throw new Error(payload?.error || 'Could not delete the draft.');
    await refreshEmailDrafts();
  } catch (error) {
    setDraftNotice(error.message || 'Could not delete the draft.', true);
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
    if (ACTIVE_DRAFT) {
      const publishedDraftId = ACTIVE_DRAFT.id;
      const deleteResponse = await draftApi('delete', { id: publishedDraftId });
      if (deleteResponse.ok) await refreshEmailDrafts();
    }
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

function draftApi(action, params = {}) {
  const query = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) });
  return fetch(`/api/recipe-drafts?${query}`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${ADMIN_PASSWORD}` },
  });
}

function clearDraftPreview() {
  ACTIVE_DRAFT = null;
  for (const url of ATTACHMENT_URLS) URL.revokeObjectURL(url);
  ATTACHMENT_URLS = [];
  $('draftPreview').classList.add('hidden');
  $('draftMeta').textContent = '';
  $('draftBody').textContent = '';
  $('draftAttachments').innerHTML = '';
  $('loadDraft').disabled = true;
  $('deleteDraft').disabled = true;
}

function setDraftNotice(message, error = false) {
  $('draftNotice').textContent = message;
  $('draftNotice').className = `save-status${error ? ' error' : ''}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown date' : date.toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
