const { jest } = require('@jest/globals');

const storedTemplates = new Map();

module.exports = {
  addPersonnelForTest: (id) => {
    storedTemplates.set(id, { personnelId: id, createdAt: Date.now() });
  },
  removePersonnel: jest.fn((id) => {
    storedTemplates.delete(id);
  }),
  loadAll: jest.fn(() => Array.from(storedTemplates.values())),
  count: jest.fn(() => storedTemplates.size),
  openTemplateStore: jest.fn(async () => undefined),
  resetMockState: () => {
    storedTemplates.clear();
  },
  _templatesMap: storedTemplates,
};
