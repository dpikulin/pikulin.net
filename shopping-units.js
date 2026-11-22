/* Conservative shopping-list conversions: mass/volume units and explicit whole produce counts.
   This deliberately does NOT infer grams from cups of flour, chopped vegetables, etc. */
const SHOP_UNITS = (() => {
  const MODES = ['metric', 'imperial', 'both'];
  const FRACTIONS = { '¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3',
    '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
  const WORD_NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4,
    five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const NUMBER = '(?:\\d+(?:\\.\\d+)?(?:\\s+\\d+\\s*\\/\\s*\\d+)?|\\d+\\s*\\/\\s*\\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|a|an|one|two|three|four|five|six|seven|eight|nine|ten)(?:\\s*[¼½¾⅓⅔⅛⅜⅝⅞])?';
  const PREFIX = '(?:(?:about|approximately|approx\\.?|roughly|around)\\s+|[~≈]\\s*)?';
  const MASS_UNIT = '(?:kilograms?|kg|grams?|g|pounds?|lbs?\\.?|ounces?|oz\\.?)';
  const VOLUME_UNIT = '(?:fluid\\s+ounces?|fl\\.?\\s*oz\\.?|millilit(?:er|re)s?|ml|lit(?:er|re)s?|litres?|l|tablespoons?|tbsp\\.?|teaspoons?|tsp\\.?|cups?|pints?|pt\\.?|quarts?|qt\\.?|gallons?|gal\\.?)';
  const MEASURE = new RegExp('^(\\s*' + PREFIX + ')(' + NUMBER + ')\\s*(' + MASS_UNIT + '|' + VOLUME_UNIT + ')(?=\\s|$|[.,;(])\\s*(.*)$', 'i');

  // Kitchen planning defaults; counts assume medium unless small/large is explicitly named.
  // Onion 148g is the Pikulin Kitchen default. Banana weights are *peeled/edible*.
  const PRODUCE = [
    { name: 'white onion', plural: 'white onions', find: 'white onions?', weights: {small: 100, medium: 148, large: 250} },
    { name: 'yellow onion', plural: 'yellow onions', find: 'yellow onions?', weights: {small: 100, medium: 148, large: 250} },
    { name: 'red onion', plural: 'red onions', find: 'red onions?', weights: {small: 100, medium: 148, large: 250} },
    { name: 'onion', plural: 'onions', find: 'onions?', weights: {small: 100, medium: 148, large: 250} },
    { name: 'banana', plural: 'bananas', find: 'bananas?', weights: {small: 101, medium: 118, large: 136} },
    { name: 'apple', plural: 'apples', find: 'apples?', weights: {small: 149, medium: 182, large: 223} },
    { name: 'lemon', plural: 'lemons', find: 'lemons?', weights: {medium: 58} },
    { name: 'carrot', plural: 'carrots', find: 'carrots?', weights: {medium: 61} },
    { name: 'tomato', plural: 'tomatoes', find: 'tomato(?:es)?', weights: {small: 91, medium: 123, large: 182} },
    { name: 'potato', plural: 'potatoes', find: 'potato(?:es)?', weights: {medium: 173} },
    { name: 'garlic clove', plural: 'garlic cloves', find: '(?:garlic cloves?|cloves? of garlic)', weights: {medium: 3} },
  ];
  const PRODUCE_RE = new RegExp('^(\\s*' + PREFIX + ')(' + NUMBER + ')\\s+(?:(small|medium|large)\\s+)?(' +
    PRODUCE.map(entry => entry.find).join('|') + ')(?=$|[\\s,;(])\\s*(.*)$', 'i');
  const REF_NOTE = '(?:' + MASS_UNIT + '|' + VOLUME_UNIT + ')';
  const EXISTING_UNIT = new RegExp('\\(\\s*(?:about\\s+|approx\\.?\\s+|~\\s*)?(' + NUMBER + ')\\s*' + REF_NOTE + '(?:\\s+[^)]*)?\\)', 'i');
  const WEIGHT_FACTORS = {g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000,
    oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
    lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237};
  const VOLUME_FACTORS = {ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
    l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
    tsp: 4.92892159375, teaspoon: 4.92892159375, teaspoons: 4.92892159375,
    tbsp: 14.78676478125, tablespoon: 14.78676478125, tablespoons: 14.78676478125,
    cup: 236.5882365, cups: 236.5882365,
    'fl oz': 29.5735295625, 'fluid ounce': 29.5735295625, 'fluid ounces': 29.5735295625,
    pt: 473.176473, pint: 473.176473, pints: 473.176473,
    qt: 946.352946, quart: 946.352946, quarts: 946.352946,
    gal: 3785.411784, gallon: 3785.411784, gallons: 3785.411784};

  function numberOf(raw) {
    let s = String(raw).toLowerCase().trim();
    for (const [symbol, fraction] of Object.entries(FRACTIONS)) s = s.replaceAll(symbol, ' ' + fraction);
    s = s.trim();
    if (s in WORD_NUMBERS) return WORD_NUMBERS[s];
    const bits = s.split(/\s+/);
    let total = 0;
    for (const part of bits) {
      if (/^\d+\/\d+$/.test(part)) {
        const [a, b] = part.split('/').map(Number);
        if (!b) return NaN;
        total += a / b;
      } else if (/^\d+(?:\.\d+)?$/.test(part)) {
        total += Number(part);
      } else return NaN;
    }
    return total;
  }
  function roundValue(n, digits) {
    return Number(n.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
  }
  function formatCount(n) {
    if (Number.isInteger(n)) return String(n);
    const w = Math.floor(n), fraction = n - w;
    const fractions = [[0.125, '⅛'], [0.25, '¼'], [0.3333333, '⅓'], [0.375, '⅜'],
      [0.5, '½'], [0.625, '⅝'], [0.6666667, '⅔'], [0.75, '¾'], [0.875, '⅞']];
    const closest = fractions.find(([value]) => Math.abs(fraction - value) < 0.005);
    return closest ? (w ? w + ' ' : '') + closest[1] : roundValue(n, 2);
  }
  function metricWeight(g) { return roundValue(g, g < 10 ? 1 : 0) + ' g'; }
  function imperialWeight(g) {
    if (g >= 453) return roundValue(g / 453.59237, 2) + ' lb';
    return roundValue(g / 28.349523125, g < 10 ? 2 : 1) + ' oz';
  }
  function metricVolume(ml) {
    if (ml >= 1000) return roundValue(ml / 1000, 2) + ' L';
    return roundValue(ml, ml < 10 ? 1 : 0) + ' mL';
  }
  function imperialVolume(ml) {
    const cups = ml / VOLUME_FACTORS.cup;
    const tbsp = ml / VOLUME_FACTORS.tbsp;
    const tsp = ml / VOLUME_FACTORS.tsp;
    if (cups >= 0.25 && Math.abs(cups * 8 - Math.round(cups * 8)) < 0.045) {
      return formatCount(Math.round(cups * 8) / 8) + ' cup' + (Math.abs(cups - 1) < 0.01 ? '' : 's');
    }
    if (tbsp >= 0.5 && tbsp <= 4 && Math.abs(tbsp * 2 - Math.round(tbsp * 2)) < 0.045) {
      return formatCount(Math.round(tbsp * 2) / 2) + ' tbsp';
    }
    if (tsp < 4 && Math.abs(tsp * 2 - Math.round(tsp * 2)) < 0.045) {
      return formatCount(Math.round(tsp * 2) / 2) + ' tsp';
    }
    return roundValue(ml / VOLUME_FACTORS['fl oz'], ml < 20 ? 2 : 1) + ' fl oz';
  }
  function normalizeUnit(unit) {
    return unit.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  }
  function hasOriginalEquivalent(remainder) {
    return EXISTING_UNIT.test(remainder);
  }
  function formatProduce(raw, repeat, mode) {
    const match = raw.match(PRODUCE_RE);
    if (!match) return null;
    const qty = numberOf(match[2]) * repeat;
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const size = match[3]?.toLowerCase() || 'medium';
    const species = PRODUCE.find(entry => new RegExp('^' + entry.find + '$', 'i').test(match[4]));
    if (!species || !species.weights[size]) return null;
    // A supplied weight is more authoritative than any generic standard.
    if (hasOriginalEquivalent(match[5]) || /(?:\d[\d,.]*\s*(?:g|kg|oz|lb|lbs)\b)/i.test(match[5])) return null;
    const noun = qty === 1 ? species.name : species.plural;
    const name = formatCount(qty) + ' ' + (match[3] ? size + ' ' : '') + noun;
    const g = qty * species.weights[size];
    const estimate = mode === 'metric' ? metricWeight(g) :
      mode === 'imperial' ? imperialWeight(g) : metricWeight(g) + ' / ' + imperialWeight(g);
    return (match[1] || '') + name + ' (≈' + estimate + ')' + (match[5] ? ' ' + match[5] : '');
  }
  function formatMeasured(raw, repeat, mode) {
    const match = raw.match(MEASURE);
    if (!match) return null;
    const quantity = numberOf(match[2]) * repeat;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    const unit = normalizeUnit(match[3]);
    const isMass = Object.hasOwn(WEIGHT_FACTORS, unit);
    const factor = isMass ? WEIGHT_FACTORS[unit] : VOLUME_FACTORS[unit];
    if (!factor) return null;
    const value = quantity * factor;
    const metric = isMass ? metricWeight(value) : metricVolume(value);
    const imperial = isMass ? imperialWeight(value) : imperialVolume(value);
    const rest = match[4] || '';
    const prefix = match[1] || '';
    if (mode === 'both' && repeat === 1 && hasOriginalEquivalent(rest)) return raw;
    const measure = mode === 'metric' ? metric : mode === 'imperial' ? imperial :
      (isMass
        ? (Object.hasOwn(WEIGHT_FACTORS, unit) && ['g','gram','grams','kg','kilogram','kilograms'].includes(unit)
          ? metric + ' (' + imperial + ')' : imperial + ' (' + metric + ')')
        : (['ml','milliliter','milliliters','millilitre','millilitres','l','liter','liters','litre','litres'].includes(unit)
          ? metric + ' (' + imperial + ')' : imperial + ' (' + metric + ')'));
    // Parenthetical matching-unit equivalents would otherwise appear twice.
    const cleanRest = rest.replace(/(\s*\(\s*(?:~\s*|about\s+|approx\.?\s+)?\d+(?:\.\d+)?\s*(?:g|kg|oz|lb|lbs)\s*\))/gi, '');
    return prefix + measure + (cleanRest ? ' ' + cleanRest : '');
  }
  function formatIngredient(original, repeat = 1, requestedMode = 'both') {
    const mode = MODES.includes(requestedMode) ? requestedMode : 'both';
    const raw = String(original || '').trim();
    if (!raw) return '';
    const count = Math.max(1, Math.floor(Number(repeat) || 1));
    return formatProduce(raw, count, mode) ||
      formatMeasured(raw, count, mode) ||
      (count > 1 ? count + ' × (' + raw + ')' : raw);
  }
  return { formatIngredient, produce: PRODUCE.map(({ name, weights }) => ({ name, weights })),
    modes: MODES };
})();
