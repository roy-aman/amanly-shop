/**
 * The password rule, stated once.
 *
 * The backend enforces 12–72 characters containing lowercase, uppercase, a digit
 * and a special character. Both the sign-up form and the change-password form
 * quote it, and when they were separate strings one of them drifted to "at least
 * 8 characters, including a letter and a number" — advice that produces a 400 the
 * user cannot explain.
 */
export const PASSWORD_HINT =
  'At least 12 characters with uppercase, lowercase, a digit and a special character.';
