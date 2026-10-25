const $ = id => document.getElementById(id);
let cursor = null, historyBusy = false, loaded = [];
const status = (id, message, error = false) => { $(id).textContent = message; $(id).className = error ? 'error-text' : ''; };
async function api(query = '', body) {
  const response = await fetch(`/api/dice${query}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  let data; try { data = await response.json(); } catch { throw new Error('The dice service is not available yet. Please try again later.'); }
  if (!response.ok) throw new Error(data.error || 'The dice request failed.');
  return data;
}
function element(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
function breakdown(roll) {
  return roll.terms.map((t, i) => {
    const sign = t.sign < 0 ? '− ' : i ? '+ ' : '';
    return sign + (t.rolls ? `${t.count}d${t.sides} [${t.rolls.join(', ')}]${t.kept !== null ? ` → keep ${t.kept}` : ''}` : t.modifier);
  }).join(' ');
}
function linkFor(code) { return `${location.origin}/dice?code=${encodeURIComponent(code)}`; }
function showRoll(target, roll, verified = false) {
  const box = element('article', undefined, 'roll-result');
  box.append(element('p', verified ? '✓ Original saved roll' : '✓ Rolled and saved', 'eyebrow'), element('h3', roll.label || 'Dice roll'), element('p', `${roll.player} · ${new Date(roll.created).toLocaleString()}`, 'roll-meta'), element('div', String(roll.total), 'roll-total'), element('p', `${roll.expression} · ${roll.mode}`, 'roll-meta'), element('p', breakdown(roll), 'roll-breakdown'), element('code', roll.code, 'roll-code'));
  const actions = element('div', undefined, 'share-actions');
  const note = element('p', '', 'hint');
  for (const [title, value] of [['Copy code', roll.code], ['Copy link', linkFor(roll.code)]]) {
    const button = element('button', title, 'secondary-button'); button.type = 'button';
    button.onclick = async () => { try { await navigator.clipboard.writeText(value); note.textContent = 'Copied!'; } catch { note.textContent = `Copy this: ${value}`; } };
    actions.append(button);
  }
  box.append(actions, note); $(target).replaceChildren(box);
}
$('rollForm').onsubmit = async event => {
  event.preventDefault(); $('rollButton').disabled = true; $('result').replaceChildren(); status('rollStatus', 'Rolling and saving…');
  const body = { player: $('player').value, label: $('label').value, expression: $('expression').value, mode: $('mode').value };
  try {
    const { roll } = await api('', body); showRoll('result', roll); status('rollStatus', '');
    try { localStorage.setItem('pikulin-dice-player', body.player); } catch {}
    await loadHistory(false);
  } catch (error) { status('rollStatus', `${error.message} If the connection dropped, refresh the log before rolling again.`, true); }
  finally { $('rollButton').disabled = false; }
};
async function verify(code) {
  status('verifyStatus', 'Looking up the original roll…'); $('verified').replaceChildren();
  try { const { roll } = await api(`?code=${encodeURIComponent(code.trim())}`); showRoll('verified', roll, true); status('verifyStatus', ''); }
  catch (error) { status('verifyStatus', error.message, true); }
}
$('verifyForm').onsubmit = event => { event.preventDefault(); verify($('code').value); };
function renderHistory() {
  $('history').replaceChildren();
  const counts = new Map(); for (const roll of loaded) counts.set(roll.player, (counts.get(roll.player) || 0) + 1);
  for (const roll of loaded) {
    const row = element('article', undefined, 'history-entry'), details = element('div');
    details.append(element('strong', roll.player), element('p', roll.label || 'Dice roll'), element('p', `${roll.expression} · ${roll.mode}`, 'roll-meta'), element('p', breakdown(roll), 'roll-breakdown'), element('p', `${new Date(roll.created).toLocaleString()} · ${counts.get(roll.player)} roll(s) by this name in loaded history`, 'roll-meta'));
    const link = element('a', roll.code); link.href = linkFor(roll.code);
    link.onclick = event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); $('code').value = roll.code; verify(roll.code); $('verifyForm').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    details.append(link); row.append(details, element('div', String(roll.total), 'history-total')); $('history').append(row);
  }
}
async function loadHistory(append) {
  if (historyBusy) return;
  historyBusy = true; $('refresh').disabled = true; $('older').disabled = true; status('historyStatus', 'Loading rolls…');
  try {
    const data = await api(append && cursor ? `?cursor=${encodeURIComponent(cursor)}` : '');
    const combined = append ? [...loaded, ...data.rolls] : data.rolls;
    loaded = [...new Map(combined.map(r => [r.code, r])).values()]; cursor = data.cursor;
    renderHistory(); $('older').hidden = !cursor; status('historyStatus', loaded.length ? `${loaded.length} saved rolls loaded${cursor ? ' · older rolls available' : ' · all saved rolls shown'}.` : 'No rolls yet. Someone has to go first.');
  } catch (error) { status('historyStatus', error.message, true); }
  finally { historyBusy = false; $('refresh').disabled = false; $('older').disabled = false; }
}
$('refresh').onclick = () => loadHistory(false); $('older').onclick = () => loadHistory(true);
document.querySelectorAll('[data-dice]').forEach(button => button.onclick = () => { $('expression').value = button.dataset.dice; $('mode').value = 'normal'; $('expression').focus(); });
try { $('player').value = localStorage.getItem('pikulin-dice-player') || ''; } catch {}
const initialCode = new URLSearchParams(location.search).get('code');
if (initialCode) { $('code').value = initialCode; verify(initialCode); }
loadHistory(false);
