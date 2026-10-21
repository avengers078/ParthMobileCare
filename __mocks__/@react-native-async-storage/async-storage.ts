const storage: Record<string, string> = {};

const AsyncStorage = {
  getItem: jest.fn(async (key: string) => storage[key] || null),
  setItem: jest.fn(async (key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete storage[key];
  }),
  clear: jest.fn(async () => {
    Object.keys(storage).forEach(k => delete storage[k]);
  }),
  getAllKeys: jest.fn(async () => Object.keys(storage)),
};

export default AsyncStorage;
