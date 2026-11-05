/* Static data works offline; IndexedDB caches the bank and selection history. */
window.EPSO_BANK = (() => {
  'use strict';
  const originals = window.EPSO_EXPANDED_BANK.questions;
  const materials = window.EPSO_MATERIALS.questions;
  const all = [...materials, ...originals];
  const historyKey = 'epso-question-history-v1';
  let history = {}, clock = 0, database = null;
  try {
    const stored = JSON.parse(localStorage.getItem(historyKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      for (const [id, value] of Object.entries(stored)) if (Number.isFinite(value) && value > 0) history[id] = value;
    }
  } catch { /* Restricted storage still permits practice in this tab. */ }
  clock = Math.max(0, ...Object.values(history));

  function requestValue(request) {
    return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onabort = transaction.onerror = () => reject(transaction.error); });
  }
  const ready = (async () => {
    try {
      const opening = indexedDB.open('epso-bulgarian-question-bank', 1);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        db.createObjectStore('questions', { keyPath: 'bankId' }).createIndex('category', 'category');
        db.createObjectStore('meta');
      };
      opening.onblocked = () => opening.onerror?.();
      database = await requestValue(opening);
      const metadata = database.transaction('meta', 'readonly').objectStore('meta');
      const cachedVersion = await requestValue(metadata.get('version'));
      const historyTransaction = database.transaction('meta', 'readonly');
      const cachedHistory = await requestValue(historyTransaction.objectStore('meta').get('history'));
      if (cachedHistory && typeof cachedHistory === 'object') {
        for (const [id, value] of Object.entries(cachedHistory)) {
          if (Number.isFinite(value) && value > (history[id] || 0)) history[id] = value;
        }
        clock = Math.max(clock, ...Object.values(history));
      }
      if (cachedVersion !== window.EPSO_EXPANDED_BANK.version) {
        const tx = database.transaction(['questions', 'meta'], 'readwrite');
        const done = transactionDone(tx);
        const store = tx.objectStore('questions');
        store.clear(); all.forEach(q => store.put(q));
        tx.objectStore('meta').put(window.EPSO_EXPANDED_BANK.version, 'version');
        await done;
      }
      return { persistent: true, count: all.length };
    } catch {
      database = null;
      return { persistent: false, count: all.length };
    }
  })();

  function pool(category, source) {
    const sourcePool = source === 'materials' ? materials : source === 'generated' ? originals : all;
    return sourcePool.filter(q => q.category === category);
  }
  function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function diverse(items, count) {
    const groups = new Map();
    shuffled(items).forEach(q => {
      const family = q.family || q.bankId;
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family).push(q);
    });
    const selected = [];
    const batches = shuffled([...groups.values()]);
    while (selected.length < count && batches.some(batch => batch.length)) {
      for (const batch of shuffled(batches)) {
        if (batch.length) selected.push(batch.pop());
        if (selected.length === count) break;
      }
    }
    return selected;
  }
  function sample(category, count, source = 'all') {
    if (!count) return [];
    const available = pool(category, source);
    if (count > available.length) throw new Error(`В раздела има ${available.length} въпроса. Намалете броя или изберете цялата банка.`);
    const fresh = available.filter(q => !history[q.bankId]);
    const selected = diverse(fresh, Math.min(fresh.length, count));
    if (selected.length < count) {
      const seen = shuffled(available.filter(q => history[q.bankId])).sort((a, b) => history[a.bankId] - history[b.bankId]);
      selected.push(...seen.slice(0, count - selected.length));
    }
    return shuffled(selected).map(q => {
      if (!q.bankId.startsWith('original-')) return { ...q };
      const indices = shuffled(q.options.map((_, i) => i));
      return { ...q, options: indices.map(i => q.options[i]), correct: indices.indexOf(q.correct), optionRationales: indices.map(i => q.optionRationales[i]) };
    });
  }
  function record(questions) {
    clock++;
    questions.forEach(q => { history[q.bankId] = clock; });
    try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch { /* Keep tab-local history. */ }
    if (database) {
      try {
        const tx = database.transaction('meta', 'readwrite');
        transactionDone(tx).catch(() => {});
        tx.objectStore('meta').put(history, 'history');
      } catch { /* The browser may have evicted or closed the cache. */ }
    }
  }
  function stats(source = 'all') {
    return Object.fromEntries(['verbal', 'numerical', 'abstract'].map(category => {
      const items = pool(category, source);
      return [category, { total: items.length, unseen: items.filter(q => !history[q.bankId]).length }];
    }));
  }
  return { ready, sample, record, stats, count: all.length, patternCount: 62, version: window.EPSO_EXPANDED_BANK.version };
})();
