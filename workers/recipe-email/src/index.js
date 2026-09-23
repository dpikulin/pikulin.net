import PostalMime from 'postal-mime';

const RECIPIENT = 'recipes@pikulin.net';
const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;

export default {
  async email(message, env) {
    if (!env.RECIPE_DRAFTS) {
      message.setReject('Recipe draft storage is not configured.');
      return;
    }

    const recipient = String(message.to || '').trim().toLowerCase();
    if (recipient !== RECIPIENT) {
      message.setReject('Unknown recipe address.');
      return;
    }

    const allowed = parseAllowlist(env.ALLOWED_RECIPE_SENDERS);
    const envelopeSender = normalizeAddress(message.from);
    if (!allowed.size || !allowed.has(envelopeSender)) {
      message.setReject('This sender is not authorized to submit recipes.');
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    if (raw.byteLength > MAX_MESSAGE_BYTES) {
      message.setReject('Recipe email is larger than 20 MB.');
      return;
    }

    const parsed = await PostalMime.parse(raw);
    const headerSender = normalizeAddress(parsed.from?.address);
    if (headerSender && !allowed.has(headerSender)) {
      message.setReject('The From address is not authorized to submit recipes.');
      return;
    }

    const received = new Date().toISOString();
    const id = `${received.replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
    const prefix = `drafts/${id}`;
    const attachments = [];

    for (let index = 0; index < (parsed.attachments || []).length; index++) {
      const attachment = parsed.attachments[index];
      const filename = safeFilename(attachment.filename || `attachment-${index + 1}`);
      const key = `${prefix}/attachments/${String(index + 1).padStart(2, '0')}-${filename}`;
      await env.RECIPE_DRAFTS.put(key, attachment.content, {
        httpMetadata: { contentType: attachment.mimeType || 'application/octet-stream' },
        customMetadata: { filename },
      });
      attachments.push({
        index,
        key,
        filename,
        contentType: attachment.mimeType || 'application/octet-stream',
        size: attachment.content?.byteLength || 0,
      });
    }

    const text = cleanBody(parsed.text || htmlToText(parsed.html || ''));
    const subject = cleanHeader(parsed.subject || 'Untitled recipe');
    const draft = {
      id,
      received,
      from: headerSender || envelopeSender,
      subject,
      text,
      attachments,
      recipe: inferRecipe(subject, text),
    };

    await env.RECIPE_DRAFTS.put(`${prefix}.json`, JSON.stringify(draft), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { from: draft.from, subject: subject.slice(0, 120), received },
    });
  },
};

function parseAllowlist(value) {
  return new Set(String(value || '').split(',').map(normalizeAddress).filter(Boolean));
}

function normalizeAddress(value) {
  const match = String(value || '').trim().toLowerCase().match(/<?([^<>\s]+@[^<>\s]+)>?$/);
  return match ? match[1] : '';
}

function cleanHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function cleanBody(value) {
  return String(value || '').replace(/\r/g, '').replace(/\u0000/g, '').trim().slice(0, 100000);
}

function safeFilename(value) {
  const cleaned = String(value).normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'attachment').slice(0, 140);
}

function htmlToText(html) {
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function inferRecipe(subject, body) {
  const title = subject.replace(/^\s*(recipe|fwd?|fw)\s*:\s*/i, '').trim() || 'Emailed recipe';
  const lines = body.split('\n').map(line => line.trim()).filter(Boolean);
  const ingredients = [];
  const steps = [];
  let section = '';

  for (const line of lines) {
    if (/^ingredients?\s*:?$/i.test(line)) { section = 'ingredients'; continue; }
    if (/^(directions?|instructions?|method|preparation)\s*:?$/i.test(line)) { section = 'steps'; continue; }
    if (/^(notes?|source)\s*:?$/i.test(line)) { section = ''; continue; }
    if (section === 'ingredients') ingredients.push(stripBullet(line));
    if (section === 'steps') steps.push(stripStepNumber(line));
  }

  return {
    slug: '',
    title: title.slice(0, 120),
    description: '',
    category: 'Other',
    tags: ['emailed recipe'],
    image: '',
    prepTime: '',
    cookTime: '',
    totalTime: '',
    yield: '',
    ingredients: ingredients.filter(Boolean).slice(0, 100),
    steps: steps.filter(Boolean).slice(0, 80),
    notes: '',
  };
}

function stripBullet(value) {
  return value.replace(/^[-*•]\s*/, '').trim();
}

function stripStepNumber(value) {
  return value.replace(/^\d+[.)]\s*/, '').trim();
}
