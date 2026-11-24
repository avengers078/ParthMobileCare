module.exports = {
  preset: '@react-native/jest-preset',
  watchman: false,
  moduleNameMapper: {
    '^lucide-react-native$': '<rootDir>/jest.lucideMock.js',
    '^@react-native-community/netinfo$': '<rootDir>/jest.netinfoMock.js',
    '^react-native-file-access$': '<rootDir>/jest.fileAccessMock.js',
    '^@react-native-documents/picker$': '<rootDir>/jest.documentPickerMock.js',
    '^react-native-offline-face-auth$': '<rootDir>/jest.faceAuthMock.js',
    '^react-native-offline-face-auth/src/secure/templateStore$': '<rootDir>/jest.faceTemplateStoreMock.js',
    '^.*OnDeviceFaceAuthView$': '<rootDir>/jest.onDeviceFaceAuthViewMock.js',
    '^firebase/app$': '<rootDir>/jest.firebaseMock.js',
    '^firebase/auth$': '<rootDir>/jest.firebaseMock.js',
    '^firebase/firestore$': '<rootDir>/jest.firebaseMock.js',
    '^firebase/storage$': '<rootDir>/jest.firebaseMock.js',
    '^firebase/functions$': '<rootDir>/jest.firebaseMock.js',
    '^firebase$': '<rootDir>/jest.firebaseMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|@react-navigation|firebase|@firebase|lucide-react-native)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/functions/',
    '<rootDir>/admin-dashboard/',
    '<rootDir>/__tests__/firestoreRulesEmulator.test.ts',
    '<rootDir>/__tests__/announcementsEmulatorRules.test.ts',
  ],
};
