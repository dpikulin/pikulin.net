const RECIPE_STATE = {
  recipes: [],
  category: 'All',
  query: '',
};

const $ = id => document.getElementById(id);

async function initRecipes() {
  $('recipeSearch').addEventListener('input', event => {
    RECIPE_STATE.query = event.target.value.trim().toLowerCase();
    renderRecipes();
  });
  $('clearFilters').addEventListener('click', clearFilters);
  $('closeRecipe').addEventListener('click', () => $('recipeDialog').close());
  $('printRecipe').addEventListener('click', () => window.print());
  $('recipeDialog').addEventListener('click', event => {
    if (event.target === $('recipeDialog')) $('recipeDialog').close();
  });

  try {
    const response = await fetch('/recipes/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Recipe index failed (${response.status}).`);
    const payload = await response.json();
    RECIPE_STATE.recipes = Array.isArray(payload) ? payload : [];
    renderCategories();
    renderRecipes();

    const slug = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (slug && RECIPE_STATE.recipes.some(recipe => recipe.slug === slug)) openRecipe(slug);
  } catch (error) {
    $('recipeNotice').textContent = error.message || 'The recipe box could not be loaded.';
    $('recipeNotice').className = 'notice error-notice';
  }
}

function renderCategories() {
  const counts = new Map();
  RECIPE_STATE.recipes.forEach(recipe => {
    const category = recipe.category || 'Other';
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  const categories = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const rows = [['All', RECIPE_STATE.recipes.length], ...categories.map(category => [category, counts.get(category)])];
  $('categoryList').innerHTML = rows.map(([category, count]) => `
    <button class="category-button ${RECIPE_STATE.category === category ? 'active' : ''}" type="button" data-category="${escapeAttr(category)}">
      <span>${escapeHtml(category)}</span><span class="category-count">${count}</span>
    </button>`).join('');
  $('categoryList').querySelectorAll('.category-button').forEach(button => {
    button.addEventListener('click', () => {
      RECIPE_STATE.category = button.dataset.category;
      renderCategories();
      renderRecipes();
    });
  });
}

function filteredRecipes() {
  return RECIPE_STATE.recipes.filter(recipe => {
    const categoryMatch = RECIPE_STATE.category === 'All' || recipe.category === RECIPE_STATE.category;
    const search = (recipe.searchText || [recipe.title, recipe.description, recipe.category, ...(recipe.tags || [])].join(' ')).toLowerCase();
    const queryMatch = !RECIPE_STATE.query || search.includes(RECIPE_STATE.query);
    return categoryMatch && queryMatch;
  });
}

function renderRecipes() {
  const recipes = filteredRecipes();
  const hasFilter = RECIPE_STATE.category !== 'All' || Boolean(RECIPE_STATE.query);
  $('clearFilters').classList.toggle('hidden', !hasFilter);
  $('resultsEyebrow').textContent = RECIPE_STATE.category === 'All' ? 'All recipes' : RECIPE_STATE.category;
  $('resultsTitle').textContent = RECIPE_STATE.query ? `Results for “${RECIPE_STATE.query}”` : 'Recipe box';
  $('recipeCount').textContent = `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`;
  $('emptyState').classList.toggle('hidden', recipes.length > 0);
  $('recipeGrid').innerHTML = recipes.map(recipe => {
    const time = totalTime(recipe);
    const image = recipe.image ? `<img class="recipe-card-image" src="${escapeAttr(recipe.image)}" alt="${escapeAttr(recipe.title)}" loading="lazy">` : '';
    return `
      <article class="recipe-card${image ? ' has-image' : ''}" tabindex="0" role="button" data-slug="${escapeAttr(recipe.slug)}" aria-label="Open ${escapeAttr(recipe.title)}">
        ${image}
        <div class="recipe-card-body">
          <div><span class="recipe-category-chip">${escapeHtml(recipe.category || 'Other')}</span></div>
          <h3>${escapeHtml(recipe.title)}</h3>
          <p>${escapeHtml(recipe.description || 'A Pikulin kitchen keeper.')}</p>
          <div class="recipe-card-meta">
            <span>${time ? `⏱ ${escapeHtml(time)}` : 'Pikulin Kitchen'}</span>
            <span>${recipe.yield ? escapeHtml(recipe.yield) : ''}</span>
          </div>
        </div>
      </article>`;
  }).join('');

  $('recipeGrid').querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', () => openRecipe(card.dataset.slug));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRecipe(card.dataset.slug);
      }
    });
  });
}

async function openRecipe(slug) {
  const dialog = $('recipeDialog');
  $('recipeDetail').innerHTML = '<p class="muted">Opening the recipe box…</p>';
  if (!dialog.open) dialog.showModal();
  try {
    const response = await fetch(`/recipes/${encodeURIComponent(slug)}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('That recipe could not be opened.');
    const recipe = await response.json();
    renderRecipeDetail(recipe);
    history.replaceState(null, '', `#${encodeURIComponent(slug)}`);
  } catch (error) {
    $('recipeDetail').innerHTML = `<div class="notice error-notice">${escapeHtml(error.message || 'Could not load recipe.')}</div>`;
  }
}

function renderRecipeDetail(recipe) {
  const stats = [
    ['Prep', recipe.prepTime],
    ['Cook', recipe.cookTime],
    ['Total', totalTime(recipe)],
    ['Makes', recipe.yield],
  ].filter(([, value]) => value);
  const tags = (recipe.tags || []).map(tag => `<span class="recipe-tag">${escapeHtml(tag)}</span>`).join('');
  const ingredients = (recipe.ingredients || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const steps = (recipe.steps || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const image = recipe.image ? `<img class="recipe-detail-image" src="${escapeAttr(recipe.image)}" alt="${escapeAttr(recipe.title)}">` : '';
  $('recipeDetail').innerHTML = `
    ${image}
    <header class="recipe-detail-head">
      <span class="recipe-category-chip">${escapeHtml(recipe.category || 'Other')}</span>
      <h2>${escapeHtml(recipe.title || 'Recipe')}</h2>
      ${recipe.description ? `<p class="lead">${escapeHtml(recipe.description)}</p>` : ''}
      ${tags ? `<div class="recipe-tags">${tags}</div>` : ''}
    </header>
    ${stats.length ? `<div class="recipe-stat-row">${stats.map(([label, value]) => `<div class="recipe-stat"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : ''}
    <div class="recipe-detail-grid">
      <section><h3>Ingredients</h3><ul class="ingredient-list">${ingredients}</ul></section>
      <section><h3>Directions</h3><ol class="step-list">${steps}</ol></section>
    </div>
    ${recipe.notes ? `<aside class="recipe-notes"><h3>Kitchen notes</h3><p>${escapeHtml(recipe.notes).replace(/\n/g, '<br>')}</p></aside>` : ''}
  `;
}

function clearFilters() {
  RECIPE_STATE.category = 'All';
  RECIPE_STATE.query = '';
  $('recipeSearch').value = '';
  renderCategories();
  renderRecipes();
}

function totalTime(recipe) {
  if (recipe.totalTime) return recipe.totalTime;
  if (recipe.prepTime && recipe.cookTime) return `${recipe.prepTime} + ${recipe.cookTime}`;
  return recipe.prepTime || recipe.cookTime || '';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}
function escapeAttr(value = '') { return escapeHtml(value); }

document.addEventListener('DOMContentLoaded', initRecipes);
