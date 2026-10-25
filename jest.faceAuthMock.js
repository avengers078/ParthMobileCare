const { jest } = require('@jest/globals');

const FaceAuth = {
  init: jest.fn(async () => undefined),
  isInitialized: jest.fn(() => true),
  checkDuplicate: jest.fn(async () => false),
  enrollLocal: jest.fn(async () => undefined),
  verifyLocal: jest.fn(async () => ({ verified: true, similarity: 1 })),
};

function FaceAuthView() {
  return null;
}

module.exports = { FaceAuth, FaceAuthView };
