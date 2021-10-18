const { set, createStore, del, entries } = require('idb-keyval');

jest.mock('idb-keyval', () => {
  const actual = jest.requireActual('idb-keyval');
  const FDBFactory = jest.requireActual('fake-indexeddb/lib/FDBFactory');
  return {
    ...actual,
    createStore: function (dbName, storeName) {
      const indexedDB = new FDBFactory();
      const request = indexedDB.open(dbName);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      const dbp = actual.promisifyRequest(request);

      return (txMode, callback) => {
        return dbp.then((db) => {
          return callback(db.transaction(storeName, txMode).objectStore(storeName));
        });
      };
    },
  };
});

const testSize = 100;

test('create and read a bunch of values', async () => {
  const store = createStore('testStore', 'event');

  for (let i = 0; i < testSize; i++) {
    await set(i.toString(), { id: i, name: 'Event #' + i }, store);
  }

  const allEntries = await entries(store);

  expect(allEntries).toHaveLength(testSize);

  for (let i = 0; i < testSize; i++) {
    await del(i.toString(), store);
  }
});

test('create and read a bunch of values with fake timers', async () => {
  jest.useFakeTimers();

  try {
    const store = createStore('testStore', 'event');

    for (let i = 0; i < testSize; i++) {
      const setResult = set(i.toString(), { id: i, name: 'Event #' + i }, store);
      await runPromisesAndTimers();
      await setResult;
    }

    const allEntriesPromise = entries(store);
    await runPromisesAndTimers();
    const allEntries = await allEntriesPromise;

    expect(allEntries).toHaveLength(testSize);

    for (let i = 0; i < testSize; i++) {
      const delPromise = del(i.toString(), store);
      await runPromisesAndTimers();
      await delPromise;
    }
  } finally {
    jest.useRealTimers();
  }
});

async function runPromisesAndTimers() {
  jest.runAllTimers();
  await new Promise((resolve) => resolve());
  jest.runAllTimers();
}
