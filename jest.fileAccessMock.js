module.exports = {
  FileSystem: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(''),
    exists: jest.fn().mockResolvedValue(true),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue('/mock/dir'),
    cpExternal: jest.fn().mockResolvedValue(undefined),
  },
  Dirs: {
    CacheDir: '/mock/cache',
    DocumentDir: '/mock/documents',
    MainBundleDir: '/mock/bundle',
  },
};

