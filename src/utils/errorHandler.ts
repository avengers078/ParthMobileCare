/**
 * Centralized Firebase and Network Error Handler for Parth Mobile Care
 * Translates internal codes, network timeouts, and raw exception messages
 * into user-friendly, actionable feedback.
 */

export function getFriendlyErrorMessage(error: any, fallback: string = 'Operation failed. Please try again.'): string {
  if (!error) return fallback;

  // If already an Error object with an explicit detailed user-facing message
  if (error instanceof Error && error.message) {
    const msg = error.message;
    if (
      msg.startsWith('Serverless backend') ||
      msg.startsWith('Backend') ||
      msg.startsWith('Access denied') ||
      msg.startsWith('You must be signed in') ||
      msg.startsWith('An account with this email') ||
      msg.startsWith('Network error:') ||
      msg.startsWith('Validation Error:') ||
      msg.startsWith('No Firebase Authentication')
    ) {
      return msg;
    }
  }

  // If already a clean user-facing string that does not contain raw code prefixes
  if (typeof error === 'string') {
    if (error.startsWith('Serverless backend') || error.startsWith('Backend') || error.startsWith('Access denied')) {
      return error;
    }
    return error;
  }

  const rawCode = String(error?.code || '').toLowerCase();
  const rawMessage = String(error?.message || '').trim();

  // Log detailed technical error in development console for debugging
  console.warn('[ErrorHandler] Captured error:', { code: rawCode, message: rawMessage, details: error?.details });

  // 1. Serverless Deployment & Endpoint Not Found Errors
  if (
    rawCode.includes('not-found') ||
    rawMessage.includes('not found on this server') ||
    rawMessage.includes('not yet deployed') ||
    rawMessage.includes('404')
  ) {
    return 'Service temporarily unavailable. Please ask the store admin to check the server or try again in a few moments. Your details have been saved.';
  }

  // 2. Authentication & Session Errors
  if (rawCode.includes('unauthenticated') || rawMessage.includes('unauthenticated')) {
    return 'Your session has expired. Please sign in again as an administrator.';
  }

  // 3. Authorization & Permissions
  if (rawCode.includes('permission-denied') || rawMessage.includes('permission-denied')) {
    return "You don't have permission to perform this action. Only active store administrators are authorized.";
  }

  // 4. Duplicate Records
  if (
    rawCode.includes('already-exists') ||
    rawCode.includes('email-already-in-use') ||
    rawMessage.includes('already exists')
  ) {
    if (rawMessage.includes('phone') || rawMessage.includes('mobile')) {
      return 'A staff member with this mobile number is already registered in store records.';
    }
    return 'This email address is already registered. Please check the email or use another address.';
  }

  // 5. Precondition Failures (e.g. deactivation status)
  if (rawCode.includes('failed-precondition') || rawMessage.includes('failed-precondition')) {
    if (rawMessage.includes('deactivated') || rawMessage.includes('inactive')) {
      return 'Cannot send invitation to a deactivated staff account. Reactivate the account first.';
    }
    return rawMessage.replace(/^FirebaseError:\s*/, '').replace(/\[.*?\]/g, '').trim() || fallback;
  }

  // 6. Validation / Invalid Argument
  if (rawCode.includes('invalid-argument') || rawMessage.includes('invalid-argument')) {
    const clean = rawMessage
      .replace(/^FirebaseError:\s*/, '')
      .replace(/^invalid-argument:\s*/i, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    return clean || 'Please check the provided details and try again.';
  }

  // 7. Internal Serverless Execution Errors
  if (rawCode.includes('internal') || rawMessage.includes('internal [0]')) {
    return 'Something went wrong while processing your request. Please try again.';
  }

  // 8. Credentials & Sign-in
  if (
    rawCode.includes('invalid-credential') ||
    rawCode.includes('wrong-password') ||
    rawCode.includes('user-not-found')
  ) {
    return 'The email or password is incorrect. Please check and try again.';
  }

  // 9. Network & Timeout
  if (
    rawCode.includes('unavailable') ||
    rawCode.includes('network-request-failed') ||
    rawCode.includes('deadline-exceeded') ||
    rawMessage.includes('network') ||
    rawMessage.includes('timed out')
  ) {
    return 'No internet connection. Please check your network and try again. Form data has been preserved.';
  }

  // 10. Rate Limiting
  if (rawCode.includes('too-many-requests') || rawMessage.includes('too many requests')) {
    return 'Too many attempts in a short time. Please wait a few moments before trying again.';
  }

  // Generic sanitized fallback
  const sanitized = rawMessage
    .replace(/^FirebaseError:\s*/, '')
    .replace(/\[.*?\]/g, '')
    .trim();

  return sanitized && sanitized.length > 5 && sanitized !== 'internal' ? sanitized : fallback;
}
