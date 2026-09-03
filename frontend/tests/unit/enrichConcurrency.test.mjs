// Verifies the concurrency pattern from the fixed /api/enrich route:
// order preservation + real wall-clock speedup vs the old sequential loop.

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function simulateLookup(i, latencyMs) {
  await delay(latencyMs);
  return { email: `person${i}@example.com`, enriched: true };
}

async function runSequential(n, latencyMs) {
  const start = Date.now();
  const results = [];
  for (let i = 0; i < n; i++) results.push(await simulateLookup(i, latencyMs));
  return { results, elapsed: Date.now() - start };
}

async function runConcurrent(n, latencyMs, concurrency) {
  const start = Date.now();
  const results = new Array(n);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, n) }, async () => {
      while (next < n) {
        const i = next++;
        results[i] = await simulateLookup(i, latencyMs);
      }
    }),
  );
  return { results, elapsed: Date.now() - start };
}

const N = 50;
const LATENCY = 300; // ms per lookup, scaled down from real ~1.5s for test speed

const seq = await runSequential(N, LATENCY);
console.log(`Sequential (old): ${N} rows @ ${LATENCY}ms each -> ${seq.elapsed}ms`);
console.log(`  Extrapolated to real ~1500ms/call: ~${(seq.elapsed / LATENCY * 1500 / 1000).toFixed(1)}s (maxDuration is 60s)`);

const conc = await runConcurrent(N, LATENCY, 8);
console.log(`Concurrent (new, 8-wide): ${N} rows @ ${LATENCY}ms each -> ${conc.elapsed}ms`);
console.log(`  Extrapolated to real ~1500ms/call: ~${(conc.elapsed / LATENCY * 1500 / 1000).toFixed(1)}s (maxDuration is 60s)`);

// Order preservation check
const orderOk = conc.results.every((r, i) => r.email === `person${i}@example.com`);
console.log(`\nOrder preserved despite concurrent completion: ${orderOk ? '✅ PASS' : '❌ FAIL'}`);

const speedup = seq.elapsed / conc.elapsed;
console.log(`Speedup: ${speedup.toFixed(1)}x`);
