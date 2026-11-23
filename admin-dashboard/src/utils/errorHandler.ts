/**
 * Centralized Human-Readable Error Handler for Parth Mobile Care Admin Web Portal
 * Ensures no raw Firebase technical codes, stack traces, or session tokens are exposed.
 */

export function getFriendlyAdminErrorMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;

  // Log raw technical diagnostics in developer console
  if (import.meta.env?.DEV || typeof window !== 'undefined') {
    console.warn('[AdminPortal Error Captured]', error);
  }

  const rawCode = String(error?.code || '').toLowerCase();
  const rawMsg = String(error?.message || error || '').trim();

  // 1. Permission & Authorization Failures
  if (
    rawCode.includes('permission-denied') ||
    rawMsg.toLowerCase().includes('permission-denied') ||
    rawMsg.toLowerCase().includes('missing or insufficient permissions') ||
    rawMsg.toLowerCase().includes('insufficient permissions') ||
    rawMsg.includes('PERMISSION_DENIED')
  ) {
    return "You don't have permission to perform this action.";
  }

  // 2. Authentication, Password & Session
  if (
    rawCode.includes('auth/wrong-password') ||
    rawCode.includes('auth/invalid-credential') ||
    rawMsg.toLowerCase().includes('wrong password') ||
    rawMsg.toLowerCase().includes('invalid credential')
  ) {
    return 'The current password entered is incorrect. Please verify and try again.';
  }

  if (
    rawCode.includes('auth/requires-recent-login') ||
    rawMsg.toLowerCase().includes('requires-recent-login') ||
    rawMsg.toLowerCase().includes('recent login')
  ) {
    return 'For security reasons, this action requires a fresh sign-in. Please log out and log back in.';
  }

  if (
    rawCode.includes('auth/weak-password') ||
    rawMsg.toLowerCase().includes('weak-password')
  ) {
    return 'The new password is too weak. Please choose at least 6 characters with a combination of letters and numbers.';
  }

  if (
    rawCode.includes('auth/invalid-email') ||
    rawMsg.toLowerCase().includes('invalid-email')
  ) {
    return 'Please enter a valid email address.';
  }

  if (
    rawCode.includes('unauthenticated') ||
    rawMsg.toLowerCase().includes('unauthenticated') ||
    rawCode.includes('auth/id-token-expired') ||
    rawMsg.toLowerCase().includes('session expired') ||
    rawMsg.toLowerCase().includes('token expired')
  ) {
    return 'Your session has expired. Please sign in again.';
  }

  // 3. Network & Connection Failures
  if (
    rawCode.includes('network-request-failed') ||
    rawCode.includes('unavailable') ||
    rawMsg.toLowerCase().includes('network') ||
    rawMsg.toLowerCase().includes('offline') ||
    rawMsg.toLowerCase().includes('failed to fetch') ||
    rawMsg.toLowerCase().includes('could not reach') ||
    rawMsg.toLowerCase().includes('transport')
  ) {
    return 'Unable to connect. Please check your internet and try again.';
  }

  // 4. Record Already Exists / Duplication
  if (
    rawCode.includes('already-exists') ||
    rawCode.includes('email-already-in-use') ||
    rawMsg.toLowerCase().includes('already exists')
  ) {
    return 'A staff account or record with these details already exists in the store directory.';
  }

  // 5. User Not Found
  if (rawCode.includes('user-not-found') || rawMsg.toLowerCase().includes('user-not-found')) {
    return 'Staff account not found in authentication directory.';
  }

  // 6. Precondition / State Conflict
  if (rawCode.includes('failed-precondition') || rawMsg.toLowerCase().includes('failed-precondition')) {
    if (rawMsg.toLowerCase().includes('deactivated') || rawMsg.toLowerCase().includes('inactive')) {
      return 'Cannot perform this action on an inactive account. Please reactivate the staff account first.';
    }
    return 'The requested operation conflicts with the current record state. Please refresh and try again.';
  }

  // 7. Invalid Argument / Validation
  if (rawCode.includes('invalid-argument') || rawMsg.toLowerCase().includes('invalid-argument')) {
    const cleanMsg = rawMsg
      .replace(/^FirebaseError:\s*/i, '')
      .replace(/^invalid-argument:\s*/i, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    return cleanMsg || 'Please verify the submitted details and try again.';
  }

  // 8. Quota / Too Many Requests
  if (rawCode.includes('too-many-requests') || rawMsg.toLowerCase().includes('too-many-requests')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // 9. If message is already clean and user-friendly (does not contain stack traces or code prefixes)
  if (
    typeof rawMsg === 'string' &&
    rawMsg.length > 0 &&
    rawMsg.length < 160 &&
    !rawMsg.includes('FirebaseError') &&
    !rawMsg.includes('at ') &&
    !rawMsg.includes('(') &&
    !rawMsg.includes('{') &&
    !rawMsg.includes('Error:') &&
    !rawMsg.includes('auth/')
  ) {
    return rawMsg;
  }

  return fallback;
}

