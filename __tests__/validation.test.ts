import {
  MOBILE_NUMBER_ERROR_MESSAGE,
  MOBILE_NUMBER_REQUIRED_MESSAGE,
  getMobileNumberError,
  isValidMobileNumber,
  sanitizeMobileNumber,
  validateMobileNumber,
} from '../src/utils/validation';

describe('Standard Mobile Number Validation & Utilities', () => {
  test('validates correct 10-digit mobile numbers', () => {
    expect(isValidMobileNumber('9876543210')).toBe(true);
    expect(isValidMobileNumber('9825123456')).toBe(true);
    expect(isValidMobileNumber(' 9876543210 ')).toBe(true);
    expect(getMobileNumberError('9876543210')).toBe('');
  });

  test('rejects numbers with less than or more than 10 digits', () => {
    expect(isValidMobileNumber('987654321')).toBe(false);
    expect(isValidMobileNumber('98765432101')).toBe(false);
    expect(getMobileNumberError('987654321')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
    expect(getMobileNumberError('98765432101')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
  });

  test('rejects numbers with non-numeric characters', () => {
    expect(isValidMobileNumber('987654321a')).toBe(false);
    expect(isValidMobileNumber('98765-4321')).toBe(false);
    expect(isValidMobileNumber('abcdefghij')).toBe(false);
    expect(getMobileNumberError('98765-4321')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
  });

  test('handles required vs optional mobile numbers', () => {
    // Required (default) rejects empty / whitespace with required message
    expect(isValidMobileNumber('', true)).toBe(false);
    expect(isValidMobileNumber('   ', true)).toBe(false);
    expect(getMobileNumberError('', true)).toBe(MOBILE_NUMBER_REQUIRED_MESSAGE);

    // Optional accepts empty / whitespace
    expect(isValidMobileNumber('', false)).toBe(true);
    expect(isValidMobileNumber('   ', false)).toBe(true);
    expect(isValidMobileNumber(undefined, false)).toBe(true);
    expect(isValidMobileNumber(null, false)).toBe(true);
    expect(getMobileNumberError('', false)).toBe('');

    // Optional rejects invalid numbers when entered
    expect(isValidMobileNumber('12345', false)).toBe(false);
    expect(isValidMobileNumber('12345678901', false)).toBe(false);
    expect(isValidMobileNumber('abcdefghij', false)).toBe(false);
    expect(getMobileNumberError('12345', false)).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
  });

  test('sanitizes input: strips non-numeric characters and limits to 10 digits', () => {
    expect(sanitizeMobileNumber('98765abc43210')).toBe('9876543210');
    expect(sanitizeMobileNumber('+91 98765-43210')).toBe('9198765432');
    expect(sanitizeMobileNumber('123456789012345')).toBe('1234567890');
    expect(sanitizeMobileNumber('')).toBe('');
  });

  describe('Real-time validation while typing (validateMobileNumber)', () => {
    test('required field: shows error while typing fewer than 10 digits', () => {
      // 1 digit
      expect(validateMobileNumber('7', true, true, '7')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
      // 4 digits (e.g. 7776)
      expect(validateMobileNumber('7776', true, true, '7776')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
      // 9 digits
      expect(validateMobileNumber('777612345', true, true, '777612345')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
      // exactly 10 digits: error cleared
      expect(validateMobileNumber('7776123456', true, true, '7776123456')).toBe('');
    });

    test('required field: shows required message when user deletes all digits', () => {
      expect(validateMobileNumber('', true, true)).toBe(MOBILE_NUMBER_REQUIRED_MESSAGE);
      expect(validateMobileNumber('', true, false)).toBe('');
    });

    test('optional field: allows empty, but requires 10 digits if started', () => {
      // Empty optional: no error
      expect(validateMobileNumber('', false, false)).toBe('');
      // Incomplete optional: shows error
      expect(validateMobileNumber('9', false, false, '9')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
      expect(validateMobileNumber('9876', false, false, '9876')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
      // Complete optional: no error
      expect(validateMobileNumber('9876543210', false, false, '9876543210')).toBe('');
    });

    test('rejects non-numeric characters and shows error message', () => {
      // Typing alphabetic characters into empty field
      expect(validateMobileNumber('', true, true, 'abc')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
      // Typing alphabetic characters into optional field
      expect(validateMobileNumber('', false, false, 'abc')).toBe(MOBILE_NUMBER_ERROR_MESSAGE);
    });
  });
});
