const { jest } = require('@jest/globals');

const enrolledPersonnel = new Set();

const FaceAuth = {
  init: jest.fn(async () => undefined),
  isInitialized: jest.fn(() => true),
  checkDuplicate: jest.fn(async () => false),
  enrollLocal: jest.fn(async (id) => {
    enrolledPersonnel.add(id);
    try {
      const templateStore = require('./jest.faceTemplateStoreMock');
      templateStore.addPersonnelForTest(id);
    } catch (e) {
      // ignore
    }
    return undefined;
  }),
  verifyLocal: jest.fn(async () => ({ verified: true, similarity: 1 })),
  listEnrolledPersonnel: jest.fn(async () => Array.from(enrolledPersonnel)),
  removePersonnel: jest.fn(async (id) => {
    enrolledPersonnel.delete(id);
    try {
      const templateStore = require('./jest.faceTemplateStoreMock');
      templateStore.removePersonnel(id);
    } catch (e) {
      // ignore
    }
    return undefined;
  }),
  resetMockState: () => {
    enrolledPersonnel.clear();
  },
};

function FaceAuthView() {
  return null;
}

module.exports = { FaceAuth, FaceAuthView };
