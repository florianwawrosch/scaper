// Standalone re-implementation check: verify the collected-cap logic behaves
// as intended with multiple keywords, without needing a real Meta API key.

function simulateScrape(keywords, limit, adsPerKeyword) {
  const allRows = [];
  const seenAdIds = new Set();
  let collected = 0;
  let adCounter = 0;

  for (const term of keywords) {
    if (collected >= limit) break;
    const pageSize = Math.min(limit - collected, 100);
    // Simulate one page response with `adsPerKeyword` fresh ads (unique ids)
    const ads = Array.from({ length: Math.min(adsPerKeyword, pageSize) }, () => ({ id: String(adCounter++) }));

    for (const ad of ads) {
      if (collected >= limit) break;
      if (seenAdIds.has(ad.id)) continue;
      seenAdIds.add(ad.id);
      allRows.push(ad);
      collected++;
    }
  }
  return allRows.length;
}

// 3 keywords, limit=100, each keyword has 100 available ads → should cap at 100 total, not 300
const result1 = simulateScrape(['coach', 'consultant', 'trainer'], 100, 100);
console.log(`3 keywords, limit=100, 100 ads each → total collected: ${result1} (expected: 100)`);
console.log(result1 === 100 ? '✅ PASS' : '❌ FAIL');

// 2 keywords, limit=30, each keyword has only 20 ads → should collect 30 total (20 + 10)
const result2 = simulateScrape(['a', 'b'], 30, 20);
console.log(`2 keywords, limit=30, 20 ads each → total collected: ${result2} (expected: 30)`);
console.log(result2 === 30 ? '✅ PASS' : '❌ FAIL');

// 1 keyword, limit=50, 50 ads available → should collect exactly 50
const result3 = simulateScrape(['solo'], 50, 50);
console.log(`1 keyword, limit=50, 50 ads → total collected: ${result3} (expected: 50)`);
console.log(result3 === 50 ? '✅ PASS' : '❌ FAIL');
