import { z } from "zod";

export interface GameSession {
  id: string;
  adminToken: string;
  players: Player[];
  teams: Team[];
  boards: GameBoard[];
  currentBoardIndex: number;
  currentClueIndex: number;
  gameState: "lobby" | "teams" | "playing" | "revealing" | "finished";
  teamSize: number;
}

export interface Player {
  id: string;
  name: string;
  sessionId: string;
  teamId: string | null;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  players: string[];
  score: number;
  answers: TeamAnswer[];
}

export interface TeamAnswer {
  boardIndex: number;
  answer: string;
  locked: boolean;
  passed: boolean;
  lockedAtClue: number;
  unlockedAndRelocked: boolean;
  correct: boolean | null;
}

export interface GameBoard {
  answer: string;
  clues: string[];
}

export interface GameBoardExport {
  title?: string;
  boards: GameBoard[];
}

export const joinSessionSchema = z.object({
  name: z.string().min(1, "Namn krävs").max(30, "Max 30 tecken"),
});

export const updatePlayerNameSchema = z.object({
  name: z.string().min(1, "Namn krävs").max(30, "Max 30 tecken"),
});

export const importBoardSchema = z.object({
  boards: z.array(z.object({
    answer: z.string().min(1),
    clues: z.array(z.string()).length(5),
  })).min(1).max(10),
});

export type JoinSession = z.infer<typeof joinSessionSchema>;
export type UpdatePlayerName = z.infer<typeof updatePlayerNameSchema>;

export type WSMessage =
  | { type: "session_update"; session: Omit<GameSession, "adminToken"> }
  | { type: "error"; message: string }
  | { type: "player_joined"; player: Player }
  | { type: "team_answer_update"; teamId: string; answer: TeamAnswer }
  | { type: "clue_revealed"; clueIndex: number }
  | { type: "round_result"; boardIndex: number; answer: string; results: { teamId: string; correct: boolean; points: number }[] };
