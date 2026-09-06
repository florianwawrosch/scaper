// Papierkorb (Kleineinträge): anlegen, neueste zuerst, Ablauf nach 30 Tagen, Obergrenze, entfernen
const { ok, lib } = require('./setup');
const { trashPut, loadTrashItems, removeTrashItem, clearTrashItems, TRASH_DAYS } = lib('trash');

localStorage.clear();
const now = Date.parse('2026-09-06T12:00:00Z');
const day = 86_400_000;
const a = trashPut('search', 'Yoga', { name: 'Yoga', cfg: { keywords: ['yoga'] } }, now - 2 * day);
const b = trashPut('block', 'Spam Seite', { pageName: 'Spam Seite', pageId: '1' }, now - 1 * day);
trashPut('ki', 'ki_alt', { id: 'x' }, now - (TRASH_DAYS + 1) * day);

let items = loadTrashItems(now);
ok(items.length === 2 && items[0].id === b.id && items[1].id === a.id, 'neueste zuerst, abgelaufene (>30 Tage) ausgeblendet');
ok(items[0].kind === 'block' && items[0].label === 'Spam Seite' && items[0].payload.pageId === '1', 'Eintrag mit Art, Label und Nutzlast');

removeTrashItem(a.id);
ok(loadTrashItems(now).length === 1, 'removeTrashItem');

for (let i = 0; i < 120; i++) trashPut('search', `s${i}`, {}, now + i * 1000);
items = loadTrashItems(now + 200_000);
ok(items.length === 100 && items[0].label === 's119' && !items.some(e => e.id === b.id), 'Obergrenze 100 — älteste fallen weg');

clearTrashItems();
ok(loadTrashItems(now).length === 0 && localStorage.getItem('trash_items') === null, 'clearTrashItems');
