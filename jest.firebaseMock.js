const firebaseMock = {
  __esModule: true,
  initializeApp: () => ({}),
  getApps: () => [],
  getApp: () => ({}),
  getAuth: () => ({}),
  getFirestore: () => ({}),
  getStorage: () => ({}),
  getFunctions: () => ({}),
  httpsCallable: () => jest.fn().mockResolvedValue({ data: {} }),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: { uid: 'mock_auth_uid', email: 'staff@example.com' },
  }),
  signOut: jest.fn().mockResolvedValue(undefined),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    return () => {};
  }),
  updatePassword: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  EmailAuthProvider: { credential: jest.fn() },
  reauthenticateWithCredential: jest.fn().mockResolvedValue(undefined),
  initializeAuth: () => ({}),
  doc: jest.fn((...args) => ({})),
  setDoc: jest.fn(async () => {}),
  deleteDoc: jest.fn(async () => {}),
  updateDoc: jest.fn(async () => {}),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  getDocs: jest.fn(async () => ({ empty: true, docs: [], forEach: () => {} })),
  onSnapshot: jest.fn((_ref, cb) => () => {}),
  collection: jest.fn((...args) => ({})),
  query: jest.fn((...args) => ({})),
  where: jest.fn((...args) => ({})),
  limit: jest.fn((...args) => ({})),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: { uid: 'mock_auth_uid', email: 'staff@example.com' },
  }),
};

firebaseMock.default = firebaseMock;
module.exports = firebaseMock;

