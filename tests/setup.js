if (typeof globalThis.localStorage?.getItem !== 'function') {
  const store = new Map()

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
      key: (index) => [...store.keys()][index] ?? null,
      removeItem: (key) => store.delete(String(key)),
      setItem: (key, value) => store.set(String(key), String(value)),
      get length() {
        return store.size
      },
    },
  })
}
