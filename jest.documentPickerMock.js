module.exports = {
  pick: jest.fn().mockResolvedValue([]),
  keepLocalCopy: jest.fn().mockResolvedValue({ localUri: '/mock/file.xlsx' }),
  types: {
    allFiles: '*/*',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
  },
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
    IN_PROGRESS: 'IN_PROGRESS',
    UNABLE_TO_OPEN_FILE_TYPE: 'UNABLE_TO_OPEN_FILE_TYPE',
  },
  isErrorWithCode: jest.fn().mockReturnValue(false),
};

