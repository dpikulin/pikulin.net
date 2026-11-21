const SHOP_STORAGE_KEY = 'pikulin-shopping-list-v1';
const AISLES = ['Produce', 'Dairy & eggs', 'Meat & fish', 'Pantry & baking', 'Herbs & spices', 'Other'];
const SHOP = {
  recipes: [],
  selected: new Set(),
  checked: new Set(),
  removed: new Set(),
  overrides: {},
  extras: [],
  ingredientCache: new Map(),
  loadErrors: new Map(),
  requestVersion: 0,
};
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', initShopping);

async function initShopping() {
  restoreShopping();
  $('recipeFilter').addEventListener('input', renderPicker);
  $('clearRecipes').addEventListener('click', () => {
    SHOP.selected.clear();
    saveShopping();
    renderPicker();
    refreshShopping();
  });
  $('manualItemForm').addEventListener('submit', addExtraItem);
  $('resetShoppingList').addEventListener('click', resetShopping);
  $('copyShoppingList').addEventListener('click', copyShopping);
  $('shareShoppingList').addEventListener('click', shareShopping);
  $('printShoppingList').addEventListener('click', () => window.print());

  try {
    const response = await fetch('/recipes/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the recipe index.');
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('The recipe index is invalid.');
    SHOP.recipes = result.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    const known = new Set(SHOP.recipes.map(item => item.slug));
    SHOP.selected = new Set([...SHOP.selected].filter(slug => known.has(slug)));
    const requested = new URLSearchParams(location.search).get('add');
    if (requested && known.has(requested)) SHOP.selected.add(requested);
    saveShopping();
    renderPicker();
    await refreshShopping();
  } catch (error) {
    showShoppingNotice(error.message || 'Could not load the recipes.', true);
    $('recipePicker').textContent = 'The recipe list is unavailable.';
  }
}

function restoreShopping() {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOP_STORAGE_KEY) || '{}');
    SHOP.selected = new Set(Array.isArray(raw.selected) ? raw.selected.filter(s => typeof s === 'string') : []);
    SHOP.checked = new Set(Array.isArray(raw.checked) ? raw.checked.filter(s => typeof s === 'string') : []);
    SHOP.removed = new Set(Array.isArray(raw.removed) ? raw.removed.filter(s => typeof s === 'string') : []);
    SHOP.overrides = raw.overrides && typeof raw.overrides === 'object' && !Array.isArray(raw.overrides) ? raw.overrides : {};
    SHOP.extras = Array.isArray(raw.extras) ? raw.extras.filter(x => x && typeof x.id === 'string' && typeof x.text === 'string') : [];
  } catch { /* Browser storage may be disabled. The list still works for this visit. */ }
}

function saveShopping() {
  try {
    localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify({
      selected: [...SHOP.selected], checked: [...SHOP.checked],
      removed: [...SHOP.removed], overrides: SHOP.overrides, extras: SHOP.extras,
    }));
  } catch { /* Local storage is optional. */ }
}

function renderPicker() {
  const query = $('recipeFilter').value.trim().toLowerCase();
  const shown = SHOP.recipes.filter(recipe =>
    [recipe.title, recipe.category, ...(recipe.tags || [])].join(' ').toLowerCase().includes(query)
  );
  $('selectedCount').textContent = `${SHOP.selected.size} selected`;
  $('recipePicker').innerHTML = shown.length ? shown.map(recipe => `
    <label class="shopping-recipe-choice">
      <input type="checkbox" data-slug="${escapeAttr(recipe.slug)}" ${SHOP.selected.has(recipe.slug) ? 'checked' : ''}>
      <span>${escapeHtml(recipe.title)}
        <small>${recipe.tested === true ? 'Made & tested' : 'In development'} · ${escapeHtml(recipe.category || 'Other')}</small>
      </span>
    </label>
  `).join('') : '<p class="shopping-help">No recipes match that search.</p>';
  $('recipePicker').querySelectorAll('input[data-slug]').forEach(box => {
    box.addEventListener('change', () => {
      if (box.checked) SHOP.selected.add(box.dataset.slug);
      else SHOP.selected.delete(box.dataset.slug);
      saveShopping();
      renderPicker();
      refreshShopping();
    });
  });
}

async function refreshShopping() {
  const version = ++SHOP.requestVersion;
  const selected = [...SHOP.selected];
  const missing = selected.filter(slug => !SHOP.ingredientCache.has(slug));
  $('listLoading').classList.toggle('hidden', missing.length === 0);
  await Promise.all(missing.map(async slug => {
    try {
      const response = await fetch(`/recipes/${encodeURIComponent(slug)}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Recipe unavailable (${response.status})`);
      const recipe = await response.json();
      if (!Array.isArray(recipe.ingredients)) throw new Error('Ingredients are missing.');
      SHOP.ingredientCache.set(slug, recipe.ingredients.filter(i => typeof i === 'string' && i.trim()));
      SHOP.loadErrors.delete(slug);
    } catch (error) {
      SHOP.loadErrors.set(slug, error.message || 'Recipe unavailable');
    }
  }));
  if (version !== SHOP.requestVersion) return;
  $('listLoading').classList.add('hidden');
  renderItems();
}

function buildItems() {
  const combined = new Map();
  for (const recipe of SHOP.recipes) {
    if (!SHOP.selected.has(recipe.slug)) continue;
    for (const original of SHOP.ingredientCache.get(recipe.slug) || []) {
      const key = 'r:' + original.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!combined.has(key)) combined.set(key, { key, text: original.trim(), sources: [] });
      const item = combined.get(key);
      if (!item.sources.includes(recipe.title)) item.sources.push(recipe.title);
    }
  }
  const items = [...combined.values()].map(item => ({
    ...item,
    text: typeof SHOP.overrides[item.key] === 'string' ? SHOP.overrides[item.key] : item.text,
    manual: false,
  }));
  for (const extra of SHOP.extras) {
    items.push({ key: 'x:' + extra.id, text: extra.text, sources: [], manual: true });
  }
  return items.filter(item => !SHOP.removed.has(item.key) && item.text.trim());
}

function aisleOf(text) {
  const t = text.toLowerCase();
  if (/\b(salt|pepper|paprika|oregano|thyme|rosemary|bay leaf|cumin|chile flakes|chili powder|cinnamon|nutmeg|dill|basil|parsley|sage|seasoning|garlic powder|onion powder)\b/.test(t)) return 'Herbs & spices';
  if (/\b(milk|cream|butter|egg|yogurt|cheese|parmesan|cheddar|mozzarella|ricotta|cream cheese|sour cream)\b/.test(t)) return 'Dairy & eggs';
  if (/\b(broth|stock|bouillon)\b/.test(t)) return 'Pantry & baking';
  if (/\b(potato|potatoes|garlic|onion|shallot|carrot|celery|tomato|corn|avocado|lemon|lime|orange|apple|banana|lettuce|spinach|jalapeño|pepperoncini|cabbage|peach|scallion|zucchini|pepper(?:s)?|fresh ginger)\b/.test(t) && !/ground pepper/.test(t)) return 'Produce';
  if (/\b(beef|chicken|pork|turkey|steak|fish|salmon|cod|mahi|tenderloin|bacon|ham)\b/.test(t)) return 'Meat & fish';
  if (/\b(towel|napkin|foil|bag|soap|cleaner|plate)\b/.test(t)) return 'Other';
  return 'Pantry & baking';
}

function groupedItems() {
  const groups = new Map(AISLES.map(name => [name, []]));
  for (const item of buildItems()) groups.get(aisleOf(item.text)).push(item);
  for (const group of groups.values()) {
    group.sort((a, b) => a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: 'base' }));
  }
  return groups;
}

function renderItems() {
  const groups = groupedItems();
  const items = [...groups.values()].flat();
  const done = items.filter(item => SHOP.checked.has(item.key)).length;
  const failures = [...SHOP.loadErrors.keys()].filter(slug => SHOP.selected.has(slug));
  const message = failures.length
    ? `Could not load ${failures.length} recipe${failures.length === 1 ? '' : 's'}: ${failures.map(s => SHOP.recipes.find(r => r.slug === s)?.title || s).join(', ')}. Their ingredients are not included.`
    : '';
  showShoppingNotice(message, !!message);
  $('itemCount').textContent = `${items.length} item${items.length === 1 ? '' : 's'} · ${done} checked off · ${SHOP.selected.size} recipe${SHOP.selected.size === 1 ? '' : 's'} selected`;
  $('shoppingEmpty').classList.toggle('hidden', items.length !== 0);
  $('shoppingEmpty').textContent = SHOP.selected.size ? 'No ingredients to show. Check the recipes selected or add an extra item.' : 'Select one or more recipes on the left to build your shopping list, or add an extra item below.';
  $('copyShoppingList').disabled = items.length === 0;
  $('shareShoppingList').disabled = items.length === 0;
  $('printShoppingList').disabled = items.length === 0;
  $('shoppingSections').innerHTML = AISLES.map(aisle => {
    const group = groups.get(aisle);
    if (!group.length) return '';
    return `<section class="shopping-aisle">
      <h3>${escapeHtml(aisle)}</h3>
      <div class="shopping-items">
      ${group.map(item => `
        <div class="shopping-item ${SHOP.checked.has(item.key) ? 'done' : ''}">
          <input type="checkbox" id="check-${escapeAttr(item.key)}" data-check="${escapeAttr(item.key)}" ${SHOP.checked.has(item.key) ? 'checked' : ''}>
          <div class="shopping-item-main">
            <label for="check-${escapeAttr(item.key)}">${escapeHtml(item.text)}</label>
            ${item.sources.length ? `<span class="shopping-item-source">${escapeHtml(item.sources.join(' · '))}</span>` : '<span class="shopping-item-source">Extra item</span>'}
          </div>
          <button class="shopping-inline-button" type="button" data-edit="${escapeAttr(item.key)}" aria-label="Edit item">Edit</button>
          <button class="shopping-inline-button remove" type="button" data-remove="${escapeAttr(item.key)}" aria-label="Remove item">×</button>
        </div>`).join('')}
      </div>
    </section>`;
  }).join('');
  $('shoppingSections').querySelectorAll('input[data-check]').forEach(box => {
    box.addEventListener('change', () => {
      if (box.checked) SHOP.checked.add(box.dataset.check);
      else SHOP.checked.delete(box.dataset.check);
      saveShopping();
      renderItems();
    });
  });
  $('shoppingSections').querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.edit;
    const item = buildItems().find(entry => entry.key === key);
    if (!item) return;
    const replacement = window.prompt('Edit this shopping list item (the saved recipe will not change):', item.text);
    if (replacement === null) return;
    const next = replacement.trim().slice(0, 240);
    if (!next) return;
    if (item.manual) {
      const extra = SHOP.extras.find(x => 'x:' + x.id === key);
      if (extra) extra.text = next;
    } else {
      SHOP.overrides[key] = next;
    }
    saveShopping();
    renderItems();
  }));
  $('shoppingSections').querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.remove;
    if (key.startsWith('x:')) SHOP.extras = SHOP.extras.filter(x => 'x:' + x.id !== key);
    else SHOP.removed.add(key);
    SHOP.checked.delete(key);
    saveShopping();
    renderItems();
  }));
}

function addExtraItem(event) {
  event.preventDefault();
  const text = $('manualItem').value.trim().slice(0, 240);
  if (!text) return;
  SHOP.extras.push({ id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9), text });
  $('manualItem').value = '';
  saveShopping();
  renderItems();
}

function resetShopping() {
  if (!window.confirm('Start a fresh shopping list? This clears selected recipes, manual items, edits, and checked-off items on this device.')) return;
  SHOP.selected.clear();
  SHOP.checked.clear();
  SHOP.removed.clear();
  SHOP.overrides = {};
  SHOP.extras = [];
  $('recipeFilter').value = '';
  saveShopping();
  renderPicker();
  refreshShopping();
}

function formatShoppingText() {
  const groups = groupedItems();
  const parts = ['Pikulin Kitchen · Shopping List'];
  for (const aisle of AISLES) {
    const items = groups.get(aisle).filter(item => !SHOP.checked.has(item.key));
    if (!items.length) continue;
    parts.push('', aisle.toUpperCase(), ...items.map(item => '☐ ' + item.text));
  }
  if (parts.length === 1) parts.push('', 'Everything is checked off!');
  return parts.join('\n');
}

async function copyShopping() {
  try {
    await navigator.clipboard.writeText(formatShoppingText());
    showShoppingNotice('Unchecked items copied. Paste them into Notes, Messages, or your favorite list app.');
  } catch {
    showShoppingNotice('Copy was blocked by your browser. Try Share or Print instead.', true);
  }
}

async function shareShopping() {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Pikulin Kitchen Shopping List', text: formatShoppingText() });
    } catch (error) {
      if (error.name !== 'AbortError') showShoppingNotice('Sharing failed. You can use Copy list instead.', true);
    }
  } else {
    await copyShopping();
  }
}

function showShoppingNotice(message, error = false) {
  $('shoppingNotice').textContent = message;
  $('shoppingNotice').className = message ? (error ? 'notice error-notice' : 'notice') : 'notice hidden';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function escapeAttr(value = '') { return escapeHtml(value); }
