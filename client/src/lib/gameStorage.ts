const ADMIN_KEY_PREFIX = "pa_sparet_admin_";
const PLAYER_KEY_PREFIX = "pa_sparet_player_";

export function setAdminToken(sessionId: string, token: string) {
  localStorage.setItem(`${ADMIN_KEY_PREFIX}${sessionId}`, token);
}

export function getAdminToken(sessionId: string): string | null {
  return localStorage.getItem(`${ADMIN_KEY_PREFIX}${sessionId}`);
}

export function setPlayerId(sessionId: string, playerId: string) {
  localStorage.setItem(`${PLAYER_KEY_PREFIX}${sessionId}`, playerId);
}

export function getPlayerId(sessionId: string): string | null {
  return localStorage.getItem(`${PLAYER_KEY_PREFIX}${sessionId}`);
}
