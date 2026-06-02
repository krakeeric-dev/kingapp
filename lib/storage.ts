import type { SessionUser } from "@/lib/auth";

const SESSION_KEY = "kingapp.session";
const OFFLINE_USERS_KEY = "kingapp.offlineAllowedUsers";

export function saveSession(user: SessionUser) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  const rawUsers = window.localStorage.getItem(OFFLINE_USERS_KEY);
  const users = rawUsers ? (JSON.parse(rawUsers) as string[]) : [];
  const updatedUsers = Array.from(new Set([...users, user.username, user.email].filter(Boolean)));
  window.localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(updatedUsers));
}

export function canLoginOffline(username: string) {
  const rawUsers = window.localStorage.getItem(OFFLINE_USERS_KEY);
  const users = rawUsers ? (JSON.parse(rawUsers) as string[]) : [];
  return users.includes(username) || users.includes(username.toLowerCase());
}

export function getSession(): SessionUser | null {
  const rawSession = window.localStorage.getItem(SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as SessionUser;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}
