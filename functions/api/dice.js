// Append-only public dice records. Recipe drafts remain outside this prefix.
const PREFIX = 'dice/v1/rolls/';
const MAX_TIME = 9999999999999;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
const bad = message => Object.assign(new Error(message), { status: 400 });

export function parseExpression(input) {
  if (typeof input !== 'string' || input.length > 200) throw bad('Enter a dice expression of at most 200 characters.');
  const expression = input.replace(/\s+/g, '').toLowerCase();
  if (!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(expression)) throw bad('Use dice and + or − modifiers, like 2d6+4 or 1d6+4+4d6.');
  let diceCount = 0;
  const terms = expression.match(/[+-]?[^+-]+/g).map(token => {
    const sign = token[0] === '-' ? -1 : 1;
    const value = token.replace(/^[+-]/, '');
    if (value.includes('d')) {
      const [n, s] = value.split('d');
      const count = n === '' ? 1 : Number(n), sides = Number(s);
      if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(sides) || sides < 2 || sides > 1000) throw bad('Use 1–100 dice with 2–1000 sides.');
      diceCount += count;
      return { sign, count, sides };
    }
    const modifier = Number(value);
    if (!Number.isSafeInteger(modifier) || modifier > 1000000) throw bad('Modifiers must be whole numbers up to 1,000,000.');
    return { sign, modifier };
  });
  if (!diceCount || diceCount > 100) throw bad('Each roll must contain 1–100 dice total.');
  return { expression, terms };
}

export function die(sides) {
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(4294967296 / sides) * sides;
  const word = new Uint32Array(1);
  do { crypto.getRandomValues(word); } while (word[0] >= limit);
  return word[0] % sides + 1;
}

export function rollExpression(input, mode = 'normal', random = die) {
  const { expression, terms } = parseExpression(input);
  if (!['normal', 'advantage', 'disadvantage'].includes(mode)) throw bad('Unknown roll mode.');
  const diceTerms = terms.filter(t => t.count);
  if (mode !== 'normal' && (diceTerms.length !== 1 || diceTerms[0].count !== 1 || diceTerms[0].sides !== 20 || diceTerms[0].sign !== 1)) throw bad('Advantage and disadvantage require one d20 plus optional modifiers.');
  let total = 0;
  const results = terms.map(term => {
    if (!term.count) { total += term.sign * term.modifier; return term; }
    const rolls = Array.from({ length: mode === 'normal' ? term.count : 2 }, () => random(term.sides));
    const kept = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : null;
    const subtotal = kept ?? rolls.reduce((a, b) => a + b, 0);
    total += term.sign * subtotal;
    return { ...term, rolls, kept, subtotal };
  });
  return { expression, mode, terms: results, total };
}

export function keyFor(code) {
  if (!/^[0-9A-Z]{9}-[0-9A-F]{12}$/.test(code)) throw bad('Enter a valid verification code.');
  const time = parseInt(code.slice(0, 9), 36);
  if (time > MAX_TIME) throw bad('Invalid verification code.');
  return `${PREFIX}${String(MAX_TIME - time).padStart(13, '0')}-${code}.json`;
}

export async function onRequest({ request, env }) {
  const bucket = env.DICE_ROLLS || env.RECIPE_DRAFTS;
  if (!bucket) return json({ error: 'Dice storage needs a Cloudflare R2 binding named DICE_ROLLS. No roll has been generated.' }, 503);
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.searchParams.has('code')) {
        const code = url.searchParams.get('code').trim().toUpperCase();
        const object = await bucket.get(keyFor(code));
        return object ? json({ roll: await object.json() }) : json({ error: 'No saved roll matches that code.' }, 404);
      }
      const cursor = url.searchParams.get('cursor') || undefined;
      if (cursor && cursor.length > 2048) throw bad('Invalid history cursor.');
      const page = await bucket.list({ prefix: PREFIX, limit: 25, cursor });
      const rolls = await Promise.all(page.objects.map(async o => { const item = await bucket.get(o.key); return item ? item.json() : null; }));
      return json({ rolls: rolls.filter(Boolean), cursor: page.truncated ? page.cursor : null });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Roll from the Pikulin dice page.' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw bad('Expected JSON.');
    // Bound the streamed body as well as declared content length.
    if (Number(request.headers.get('content-length')) > 2048) throw bad('Request is too large.');
    const reader = request.body?.getReader();
    if (!reader) throw bad('Missing roll request.');
    let size = 0, chunks = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2048) { await reader.cancel(); throw bad('Request is too large.'); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let data; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw bad('Invalid JSON.'); }
    if (!data || typeof data !== 'object') throw bad('Missing roll request.');
    const clean = (v, max) => typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max) : '';
    const player = clean(data.player, 60);
    if (!player) throw bad('Enter a player or character name.');
    const result = rollExpression(data.expression, data.mode ?? 'normal');
    const time = Date.now();
    const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const code = `${time.toString(36).padStart(9, '0').toUpperCase()}-${random}`;
    const roll = { version: 1, code, created: new Date(time).toISOString(), player, label: clean(data.label, 120), ...result };
    // A conditional single-object write makes result + history entry atomic and immutable.
    const saved = await bucket.put(keyFor(code), JSON.stringify(roll), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
    if (!saved) return json({ error: 'Could not save this roll. Please try again.' }, 503);
    return json({ roll }, 201);
  } catch (error) {
    if (!error.status) console.error('Dice API failure', error);
    return json({ error: error.status ? error.message : 'Dice storage is unavailable. A submitted roll may have saved; check the history before trying again.' }, error.status || 503);
  }
}
