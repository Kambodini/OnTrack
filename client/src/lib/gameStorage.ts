import type { GameBoard } from "@shared/schema";

const ADMIN_KEY_PREFIX = "pa_sparet_admin_";
const PLAYER_KEY_PREFIX = "pa_sparet_player_";
const BOARDS_KEY = "pa_sparet_saved_boards";

export interface SavedBoardSet {
  id: string;
  name: string;
  boards: GameBoard[];
  createdAt: number;
  updatedAt: number;
}

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

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function getSavedBoardSets(): SavedBoardSet[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveBoardSet(boardSet: SavedBoardSet): void {
  const sets = getSavedBoardSets();
  const idx = sets.findIndex((s) => s.id === boardSet.id);
  if (idx >= 0) {
    sets[idx] = { ...boardSet, updatedAt: Date.now() };
  } else {
    sets.push(boardSet);
  }
  localStorage.setItem(BOARDS_KEY, JSON.stringify(sets));
}

export function createBoardSet(name: string, boards: GameBoard[]): SavedBoardSet {
  const now = Date.now();
  const boardSet: SavedBoardSet = {
    id: generateId(),
    name,
    boards,
    createdAt: now,
    updatedAt: now,
  };
  saveBoardSet(boardSet);
  return boardSet;
}

export function deleteBoardSet(id: string): void {
  const sets = getSavedBoardSets().filter((s) => s.id !== id);
  localStorage.setItem(BOARDS_KEY, JSON.stringify(sets));
}

export function getBoardSet(id: string): SavedBoardSet | undefined {
  return getSavedBoardSets().find((s) => s.id === id);
}
