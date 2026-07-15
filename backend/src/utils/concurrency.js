async function runWithConcurrencyLimit(items, worker, concurrency = 10) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function runNext() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const runners = Array.from({ length: workerCount }, () => runNext());
  await Promise.all(runners);

  return results;
}

module.exports = { runWithConcurrencyLimit };
