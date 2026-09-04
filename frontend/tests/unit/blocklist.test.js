// Unit-Test lib/blocklist: Eingabe-Parser (Link/ID/Name), Links, Filter
const { ok, lib } = require('./setup');
const B = lib('blocklist');

const p = B.parseBlockInput;
ok(p('') === null && p('   ') === null, 'leer → null');
ok(JSON.stringify(p('123456789')) === JSON.stringify({ pageName: 'Page 123456789', pageId: '123456789' }), 'reine Page-ID');
ok(p('https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=DE&view_all_page_id=987654321&search_type=page').pageId === '987654321', 'Ads-Library-Link → view_all_page_id');
ok(p('https://www.facebook.com/987654321').pageId === '987654321', 'Fanpage-Link mit ID');
ok(p('facebook.com/profile.php?id=55555555').pageId === '55555555', 'profile.php?id= ohne Schema');
ok(p('https://www.facebook.com/pages/Fitness-Max/123456789').pageId === '123456789' && p('https://www.facebook.com/pages/Fitness-Max/123456789').pageName === 'Fitness-Max', '/pages/Name/ID');
const slug = p('https://www.facebook.com/fitnesscoachmax/');
ok(slug.pageName === 'fitnesscoachmax' && !slug.pageId, 'Slug-Link → nur Name, keine ID');
ok(p('https://www.facebook.com/ads/library/') === null, 'Ads-Library ohne Page-ID → null');
ok(JSON.stringify(p('Fitness Coach Max')) === JSON.stringify({ pageName: 'Fitness Coach Max' }), 'freier Text → Seitenname');
ok(p('https://example.com/x').pageName === 'https://example.com/x', 'fremde URL → als Name');

ok(B.adsLibraryUrl('42').includes('view_all_page_id=42'), 'adsLibraryUrl enthält Page-ID');
ok(B.fanpageUrl({ pageName: 'x', pageId: '42' }) === 'https://www.facebook.com/42' && B.fanpageUrl({ pageName: 'x' }) === null, 'fanpageUrl nur mit ID');

localStorage.clear();
B.addBlockInput('https://www.facebook.com/ads/library/?view_all_page_id=1112223334');
B.addBlockInput('Spam Seite');
B.addBlockInput('1112223334'); // Duplikat per ID
ok(B.loadBlocklist().length === 2, 'Duplikat über ID nicht doppelt');
const { kept, blocked } = B.applyBlocklist([
  { page_name: 'Umbenannt', page_id: '1112223334' },
  { page_name: 'spam seite', page_id: '2' },
  { page_name: 'Ok', page_id: '3' },
]);
ok(kept.length === 1 && blocked === 2 && kept[0].page_id === '3', 'applyBlocklist: ID-Treffer trotz Umbenennung + Name case-insensitiv');
