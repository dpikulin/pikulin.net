export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.RECIPE_ADMIN_PASSWORD) return json({ error: 'RECIPE_ADMIN_PASSWORD is not configured.' }, 503);
  if (!(await authorized(request, env.RECIPE_ADMIN_PASSWORD))) return json({ error: 'Incorrect recipe editor password.' }, 401);
  if (!env.RECIPE_DRAFTS) return json({ error: 'Recipe draft storage is not configured.' }, 503);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'list';
  try {
    if (action === 'list') return json({ drafts: await listDrafts(env.RECIPE_DRAFTS) });
    if (action === 'get') return getDraft(env.RECIPE_DRAFTS, url.searchParams.get('id'));
    if (action === 'attachment') return getAttachment(env.RECIPE_DRAFTS, url.searchParams.get('id'), url.searchParams.get('index'));
    if (action === 'delete') return deleteDraft(env.RECIPE_DRAFTS, url.searchParams.get('id'));
    return json({ error: 'Unknown draft action.' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Recipe draft request failed.' }, error.status || 500);
  }
}

async function listDrafts(bucket) {
  const result = await bucket.list({ prefix: 'drafts/', limit: 1000, include: ['customMetadata'] });
  return result.objects
    .filter(object => /^drafts\/[^/]+\.json$/.test(object.key))
    .map(object => ({
      id: object.key.slice('drafts/'.length, -'.json'.length),
      from: object.customMetadata?.from || '',
      subject: object.customMetadata?.subject || 'Untitled recipe',
      received: object.customMetadata?.received || object.uploaded?.toISOString?.() || '',
    }))
    .sort((a, b) => String(b.received).localeCompare(String(a.received)));
}

async function getDraft(bucket, id) {
  assertId(id);
  const object = await bucket.get(`drafts/${id}.json`);
  if (!object) return json({ error: 'Recipe draft not found.' }, 404);
  return new Response(object.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

async function getAttachment(bucket, id, indexValue) {
  assertId(id);
  const index = Number(indexValue);
  if (!Number.isInteger(index) || index < 0) return json({ error: 'Invalid attachment index.' }, 400);
  const draftObject = await bucket.get(`drafts/${id}.json`);
  if (!draftObject) return json({ error: 'Recipe draft not found.' }, 404);
  const draft = await draftObject.json();
  const attachment = draft.attachments?.[index];
  if (!attachment?.key || !attachment.key.startsWith(`drafts/${id}/attachments/`)) return json({ error: 'Attachment not found.' }, 404);
  const object = await bucket.get(attachment.key);
  if (!object) return json({ error: 'Attachment not found.' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('content-disposition', `attachment; filename="${safeDownloadName(attachment.filename)}"`);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

async function deleteDraft(bucket, id) {
  assertId(id);
  const prefix = `drafts/${id}/`;
  let cursor;
  do {
    const result = await bucket.list({ prefix, cursor });
    if (result.objects.length) await bucket.delete(result.objects.map(object => object.key));
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  await bucket.delete(`drafts/${id}.json`);
  return json({ ok: true });
}

function assertId(id) {
  if (!id || !/^[a-zA-Z0-9-]{20,100}$/.test(id)) {
    const error = new Error('Invalid recipe draft ID.');
    error.status = 400;
    throw error;
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
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
}

function safeDownloadName(value) {
  return String(value || 'attachment').replace(/["\r\n]/g, '').slice(0, 140);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
