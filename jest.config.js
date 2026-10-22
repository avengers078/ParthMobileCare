module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^lucide-react-native$': '<rootDir>/jest.lucideMock.js',
    '^@react-native-community/netinfo$': '<rootDir>/jest.netinfoMock.js',
    '^react-native-offline-face-auth$': '<rootDir>/jest.faceAuthMock.js',
    '^react-native-offline-face-auth/src/secure/templateStore$': '<rootDir>/jest.faceTemplateStoreMock.js',
    '^.*OnDeviceFaceAuthView$': '<rootDir>/jest.onDeviceFaceAuthViewMock.js',
    '^firebase/app$': '<rootDir>/jest.firebaseMock.js',
    '^firebase/auth$': '<rootDir>/jest.firebaseMock.js',
    '^firebase/firestore$': '<rootDir>/jest.firebaseMock.js',
    '^firebase/storage$': '<rootDir>/jest.firebaseMock.js',
    '^firebase$': '<rootDir>/jest.firebaseMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|@react-navigation|firebase|@firebase|lucide-react-native)',
  ],
};
