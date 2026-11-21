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
  $('photoFiles').addEventListener('change', previewPhotoSelection);
  $('clearPhotoSelection').addEventListener('click', clearPhotoSelection);
  $('photoImportForm').addEventListener('submit', importRecipePhotos);
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
  $('recipeTested').checked = false;
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
    .map(recipe => `<option value="${escapeAttr(recipe.slug)}">${recipe.tested === true ? "✓ " : "○ "}${escapeHtml(recipe.title)}</option>`)
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
    const indexed = RECIPE_INDEX.find(item => item.slug === slug);
    $('recipeTested').checked = recipe.tested === true || (recipe.tested == null && indexed?.tested === true);
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
    tested: $('recipeTested').checked,
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


const PHOTO_IMPORT_MAX = 8;
let PHOTO_PREVIEW_URLS = [];

function previewPhotoSelection() {
  clearPhotoPreviews();
  const files = [...$('photoFiles').files];
  $('photoImportWarnings').classList.add('hidden');
  if (files.length > PHOTO_IMPORT_MAX) {
    setPhotoNotice(`Please choose up to ${PHOTO_IMPORT_MAX} photos of one recipe at a time.`, true);
    return;
  }
  setPhotoNotice(files.length
    ? `${files.length} photo${files.length === 1 ? '' : 's'} selected. Check their order before importing.`
    : '');
  for (const [index, file] of files.entries()) {
    const figure = document.createElement('figure');
    figure.className = 'photo-preview';
    const img = document.createElement('img');
    img.alt = `Photo ${index + 1}: ${file.name}`;
    const url = URL.createObjectURL(file);
    PHOTO_PREVIEW_URLS.push(url);
    img.src = url;
    const caption = document.createElement('figcaption');
    caption.textContent = `${index + 1}. ${file.name}`;
    figure.append(img, caption);
    $('photoPreviews').appendChild(figure);
  }
}

function clearPhotoPreviews() {
  PHOTO_PREVIEW_URLS.forEach(url => URL.revokeObjectURL(url));
  PHOTO_PREVIEW_URLS = [];
  $('photoPreviews').replaceChildren();
}

function clearPhotoSelection() {
  $('photoFiles').value = '';
  $('photoHint').value = '';
  clearPhotoPreviews();
  setPhotoNotice('');
  $('photoImportWarnings').classList.add('hidden');
}

function setPhotoNotice(message, error = false, success = false) {
  $('photoImportNotice').textContent = message;
  $('photoImportNotice').className = `save-status${error ? ' error' : success ? ' success' : ''}`;
}

async function importRecipePhotos(event) {
  event.preventDefault();
  if (!ADMIN_PASSWORD) return;
  const files = [...$('photoFiles').files];
  if (!files.length || files.length > PHOTO_IMPORT_MAX) {
    setPhotoNotice(`Select 1 to ${PHOTO_IMPORT_MAX} photos of a single recipe.`, true);
    return;
  }
  if ($('recipeTitle').value.trim() || $('recipeSlug').value) {
    if (!window.confirm('Replace the unsaved fields currently in the editor with the recipe read from these photos?')) return;
  }
  const button = $('photoImportButton');
  button.disabled = true;
  $('clearPhotoSelection').disabled = true;
  $('photoImportWarnings').classList.add('hidden');
  try {
    const images = [];
    let totalCharacters = 0;
    for (let i = 0; i < files.length; i++) {
      setPhotoNotice(`Preparing photo ${i + 1} of ${files.length}…`);
      const data = await convertPhotoToJpeg(files[i]);
      totalCharacters += data.length;
      if (totalCharacters > 15_000_000) throw new Error('These photos are too large as a group. Try uploading fewer at once.');
      images.push({ data });
    }
    setPhotoNotice(`Reading ${images.length} photos and building the recipe draft…`);
    const response = await fetch('/api/recipe-photo-import', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${ADMIN_PASSWORD}`,
      },
      body: JSON.stringify({ images, hint: $('photoHint').value.trim() }),
    });
    const result = await safeJson(response);
    if (!response.ok) throw new Error(result?.error || `Photo import failed (${response.status}).`);
    if (!result?.recipe) throw new Error('No recipe was returned.');
    loadPhotoRecipe(result.recipe);
    showPhotoWarnings(result.warnings || []);
    setPhotoNotice('Recipe draft ready in the editor below. Review the measurements, then save when satisfied.', false, true);
    $('recipeForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    clearPhotoPreviews();
    $('photoFiles').value = '';
  } catch (error) {
    setPhotoNotice(error.message || 'Could not read those photos.', true);
  } finally {
    button.disabled = false;
    $('clearPhotoSelection').disabled = false;
  }
}

async function convertPhotoToJpeg(file) {
  if (!file.type.startsWith('image/') && !/\.(?:heic|heif|jpg|jpeg|png|webp)$/i.test(file.name)) {
    throw new Error(`${file.name} is not an image. Select photos, not PDFs or documents.`);
  }
  if (file.size > 30_000_000) throw new Error(`${file.name} is too large to process on this device.`);
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(`Could not read ${file.name}. On some devices, HEIC photos must first be exported as JPEG.`));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error(`${file.name} could not be decoded.`);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is not available in this browser.');
    let maxEdge = 2600;
    let data = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      data = canvas.toDataURL('image/jpeg', attempt < 2 ? 0.88 : 0.8);
      if (data.length <= 3_500_000) return data;
      maxEdge = Math.floor(maxEdge * 0.78);
    }
    throw new Error(`${file.name} could not be compressed enough. Try a smaller photo.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadPhotoRecipe(recipe) {
  // The imported draft replaces the form, but never publishes or overwrites a saved recipe.
  if (ACTIVE_DRAFT) clearDraftPreview();
  $('recipeForm').reset();
  $('recipeSlug').value = '';
  $('existingRecipe').value = '';
  $('recipeTitle').value = recipe.title || '';
  $('recipeDescription').value = recipe.description || '';
  $('recipeCategory').value = recipe.category || 'Other';
  $('recipeTags').value = Array.isArray(recipe.tags) ? recipe.tags.join(', ') : '';
  $('recipeTested').checked = false;
  $('recipeImage').value = '';
  $('recipePrep').value = recipe.prepTime || '';
  $('recipeCook').value = recipe.cookTime || '';
  $('recipeTotal').value = recipe.totalTime || '';
  $('recipeYield').value = recipe.yield || '';
  $('recipeIngredients').value = Array.isArray(recipe.ingredients) ? recipe.ingredients.join('\n') : '';
  $('recipeSteps').value = Array.isArray(recipe.steps) ? recipe.steps.join('\n') : '';
  $('recipeNotes').value = recipe.notes || '';
  setSaveStatus('Photo import loaded. Verify the ingredients and directions before publishing.');
}

function showPhotoWarnings(warnings) {
  const list = $('photoImportWarnings');
  list.replaceChildren();
  if (!warnings.length) {
    list.classList.add('hidden');
    return;
  }
  const title = document.createElement('h3');
  title.textContent = 'Check these readings before saving';
  const ul = document.createElement('ul');
  for (const warning of warnings) {
    const li = document.createElement('li');
    li.textContent = String(warning).slice(0, 350);
    ul.appendChild(li);
  }
  list.append(title, ul);
  list.classList.remove('hidden');
}
