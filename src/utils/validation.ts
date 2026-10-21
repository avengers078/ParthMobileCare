/**
 * Form and input validations across Parth Mobile Care
 */

export const MOBILE_NUMBER_ERROR_MESSAGE = 'Enter a valid 10-digit mobile number.';
export const MOBILE_NUMBER_REQUIRED_MESSAGE = 'Mobile number is required.';

/**
 * Strips non-numeric characters and limits length to 10 digits.
 * Prevents non-numeric characters from being accepted.
 */
export function sanitizeMobileNumber(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 10);
}

/**
 * Real-time mobile number validation while typing (onChangeText) or blur.
 * - If clean length is exactly 10 digits: valid (returns '')
 * - If clean length is > 0 and < 10 digits: invalid (returns 'Enter a valid 10-digit mobile number.')
 * - If raw input had invalid non-numeric characters (e.g. letters, symbols): invalid (returns 'Enter a valid 10-digit mobile number.')
 * - If clean length is 0 (empty):
 *   - For required field:
 *     - If triggered (e.g. user backspaced all characters, blurred, or submitted): returns 'Mobile number is required.'
 *     - If untouched / not triggered: returns ''
 *   - For optional field: returns ''
 */
export function validateMobileNumber(
  value: string,
  required: boolean = true,
  triggeredIfEmpty: boolean = true,
  rawInput?: string
): string {
  const clean = sanitizeMobileNumber(value);
  if (clean.length === 10) {
    return '';
  }
  if (clean.length > 0) {
    return MOBILE_NUMBER_ERROR_MESSAGE;
  }
  if (rawInput && rawInput.length > 0 && clean.length === 0) {
    return MOBILE_NUMBER_ERROR_MESSAGE;
  }
  if (required && triggeredIfEmpty) {
    return MOBILE_NUMBER_REQUIRED_MESSAGE;
  }
  return '';
}

/**
 * Validates a 10-digit Indian mobile number for submission or blur.
 * - Required mobile number: must not be empty, must be exactly 10 digits, digits only.
 * - Optional mobile number (e.g. alternative): if empty, valid. If entered, must be exactly 10 digits, digits only.
 * Returns error string if invalid, or '' if valid.
 */
export function getMobileNumberError(value?: string | null, required: boolean = true): string {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return required ? MOBILE_NUMBER_REQUIRED_MESSAGE : '';
  }
  const clean = sanitizeMobileNumber(trimmed);
  if (clean.length !== 10 || clean !== trimmed) {
    return MOBILE_NUMBER_ERROR_MESSAGE;
  }
  return '';
}

/**
 * Checks if a mobile number is valid.
 */
export function isValidMobileNumber(value?: string | null, required: boolean = true): boolean {
  return getMobileNumberError(value, required) === '';
}
