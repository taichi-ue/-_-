const DB_NAME = 'kurekaSplitDB';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('transactions')) {
        const tx = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        tx.createIndex('yearMonth', 'yearMonth');
        tx.createIndex('category', 'category');
        tx.createIndex('importId', 'importId');
      }

      if (!db.objectStoreNames.contains('importLogs')) {
        const logs = db.createObjectStore('importLogs', { keyPath: 'id', autoIncrement: true });
        logs.createIndex('cardType_targetYearMonth', ['cardType', 'targetYearMonth'], { unique: true });
      }

      if (!db.objectStoreNames.contains('rules')) {
        const rules = db.createObjectStore('rules', { keyPath: 'id', autoIncrement: true });
        rules.createIndex('priority', 'priority');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store);

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addRecord(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const result = await requestToPromise(store.add(value));
  return result;
}

async function putRecord(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const result = await requestToPromise(store.put(value));
  return result;
}

async function deleteRecord(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await requestToPromise(store.delete(key));
}

async function getAll(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return requestToPromise(store.getAll());
}

async function getByIndex(storeName, indexName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const index = store.index(indexName);
  return requestToPromise(index.getAll(key));
}

async function clearStore(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await requestToPromise(store.clear());
}

export {
  openDB,
  withStore,
  addRecord,
  putRecord,
  deleteRecord,
  getAll,
  getByIndex,
  clearStore,
};
