const { jest } = require('@jest/globals');

const NetInfo = {
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
  refresh: jest.fn(async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
};

module.exports = NetInfo;
module.exports.default = NetInfo;
