/**
 * Maximum length of a single comment, in JavaScript characters. Enforced on BOTH
 * the client (input `maxLength` + submit guard) and the server (`addComment`),
 * so an oversized comment is rejected with a clean, user-readable error long
 * before it could reach the Next.js Server Action body-size limit. This is a
 * character cap, deliberately NOT a byte/1 MB limit.
 *
 * Lives in this plain (non-`"use server"`) module so it can be imported by both
 * client components and server actions — a `"use server"` file may only export
 * async server actions, never a plain constant.
 */
export const MAX_COMMENT_LENGTH = 2000

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Accepts 10-digit numbers, optionally with country code / spaces / dashes. */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, '')
  return digits.length >= 10 && digits.length <= 13
}

export function passwordIssue(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number.'
  }
  return null
}
