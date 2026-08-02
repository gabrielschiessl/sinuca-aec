import { loginGoogle, logoutAdmin, validateAdminSession } from "./api.js";

const SESSION_STORAGE_KEY = "aec_admin_session";

export function getStoredAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)) || null;
  } catch (error) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function authenticateWithGoogle(credential) {
  const session = await loginGoogle(credential);

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

  return session;
}

export async function restoreAdminSession() {
  const storedSession = getStoredAdminSession();

  if (!storedSession?.token) return null;

  try {
    const validatedSession = await validateAdminSession(storedSession.token);
    const session = { ...validatedSession, token: storedSession.token };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return session;
  } catch (error) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    throw error;
  }
}

export async function endAdminSession() {
  const session = getStoredAdminSession();

  localStorage.removeItem(SESSION_STORAGE_KEY);

  if (session?.token) {
    await logoutAdmin(session.token);
  }
}
