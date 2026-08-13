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
