import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

class MemoryBucket {
  objects = new Map();
  async put(key, value, options = {}) {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, { bytes, options });
  }
}

function messageFrom(raw, from = 'david@example.com') {
  let rejection = '';
  return {
    from,
    to: 'recipes@pikulin.net',
    raw: new Response(raw).body,
    setReject(reason) { rejection = reason; },
    get rejection() { return rejection; },
  };
}

test('stores an allowlisted recipe and its attachment as a private draft', async () => {
  const boundary = 'pikulin-test-boundary';
  const raw = [
    'From: David <david@example.com>',
    'To: recipes@pikulin.net',
    'Subject: Recipe: Test Soup',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Ingredients',
    '- 500 g tomatoes',
    '',
    'Directions',
    '1. Simmer until tender.',
    `--${boundary}`,
    'Content-Type: text/plain',
    'Content-Disposition: attachment; filename="note.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    'aGVsbG8=',
    `--${boundary}--`,
    '',
  ].join('\r\n');
  const bucket = new MemoryBucket();
  const message = messageFrom(raw);

  await worker.email(message, {
    RECIPE_DRAFTS: bucket,
    ALLOWED_RECIPE_SENDERS: 'david@example.com',
  });

  assert.equal(message.rejection, '');
  const metadataEntry = [...bucket.objects.entries()].find(([key]) => key.endsWith('.json'));
  assert.ok(metadataEntry);
  const draft = JSON.parse(new TextDecoder().decode(metadataEntry[1].bytes));
  assert.equal(draft.recipe.title, 'Test Soup');
  assert.deepEqual(draft.recipe.ingredients, ['500 g tomatoes']);
  assert.deepEqual(draft.recipe.steps, ['Simmer until tender.']);
  assert.equal(draft.attachments[0].filename, 'note.txt');
  assert.ok(bucket.objects.has(draft.attachments[0].key));
});

test('rejects a sender who is not allowlisted', async () => {
  const message = messageFrom('From: stranger@example.com\r\nTo: recipes@pikulin.net\r\nSubject: Nope\r\n\r\nSpam', 'stranger@example.com');
  const bucket = new MemoryBucket();

  await worker.email(message, {
    RECIPE_DRAFTS: bucket,
    ALLOWED_RECIPE_SENDERS: 'david@example.com',
  });

  assert.match(message.rejection, /not authorized/i);
  assert.equal(bucket.objects.size, 0);
});
