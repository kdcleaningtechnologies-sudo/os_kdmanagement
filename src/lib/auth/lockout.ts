const KEY = 'kd-login-lock'
const MAX_FAILURES = 8
const WINDOW_MS = 15 * 60 * 1000

type LockState = { failures: number; until: number }

function read(): LockState {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return { failures: 0, until: 0 }
    const parsed = JSON.parse(raw) as LockState
    if (parsed.until && parsed.until < Date.now()) return { failures: 0, until: 0 }
    return parsed
  } catch {
    return { failures: 0, until: 0 }
  }
}

function write(state: LockState) {
  sessionStorage.setItem(KEY, JSON.stringify(state))
}

export function loginLockMessage() {
  const state = read()
  if (state.until > Date.now()) {
    const minutes = Math.max(1, Math.ceil((state.until - Date.now()) / 60000))
    return `Too many sign-in attempts. Try again in ${minutes} min.`
  }
  return null
}

export function recordLoginFailure() {
  const state = read()
  const failures = state.failures + 1
  const until = failures >= MAX_FAILURES ? Date.now() + WINDOW_MS : 0
  write({ failures, until })
  return loginLockMessage()
}

export function clearLoginFailures() {
  sessionStorage.removeItem(KEY)
}

const RESET_KEY = 'kd-reset-lock'
const MAX_RESETS = 5

export function passwordResetLockMessage() {
  try {
    const raw = sessionStorage.getItem(RESET_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LockState
    if (parsed.until && parsed.until > Date.now()) {
      const minutes = Math.max(1, Math.ceil((parsed.until - Date.now()) / 60000))
      return `Too many reset requests. Try again in ${minutes} min.`
    }
  } catch {
    return null
  }
  return null
}

export function recordPasswordResetRequest() {
  let failures = 1
  try {
    const raw = sessionStorage.getItem(RESET_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LockState
      if (!parsed.until || parsed.until >= Date.now()) failures = parsed.failures + 1
    }
  } catch {
    failures = 1
  }
  const until = failures >= MAX_RESETS ? Date.now() + WINDOW_MS : 0
  sessionStorage.setItem(RESET_KEY, JSON.stringify({ failures, until }))
  return passwordResetLockMessage()
}

const SIGNUP_KEY = 'kd-signup-lock'
const MAX_SIGNUPS = 5

export function signupLockMessage() {
  try {
    const raw = sessionStorage.getItem(SIGNUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LockState
    if (parsed.until && parsed.until > Date.now()) {
      const minutes = Math.max(1, Math.ceil((parsed.until - Date.now()) / 60000))
      return `Too many sign-up attempts. Try again in ${minutes} min.`
    }
  } catch {
    return null
  }
  return null
}

export function recordSignupAttempt() {
  let failures = 1
  try {
    const raw = sessionStorage.getItem(SIGNUP_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LockState
      if (!parsed.until || parsed.until >= Date.now()) failures = parsed.failures + 1
    }
  } catch {
    failures = 1
  }
  const until = failures >= MAX_SIGNUPS ? Date.now() + WINDOW_MS : 0
  sessionStorage.setItem(SIGNUP_KEY, JSON.stringify({ failures, until }))
  return signupLockMessage()
}
