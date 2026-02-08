import type { GameSession, Player, Team, GameBoard, PlayerAnswer } from "@shared/schema";
import { CLUE_POINTS } from "@shared/schema";
import { randomUUID } from "crypto";

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const TEAM_COLORS = [
  "#E53935", "#1E88E5", "#43A047", "#FB8C00",
  "#8E24AA", "#00ACC1", "#F4511E", "#3949AB",
  "#7CB342", "#C0CA33", "#D81B60", "#00897B",
  "#5E35B1", "#039BE5", "#FFB300", "#6D4C41",
];

const TEAM_NAMES = [
  "Elden", "Stormen", "Blixten", "Vinden",
  "Stjärnan", "Molnet", "Berget", "Vågen",
  "Draken", "Vargen", "Örnen", "Falken",
  "Lejonet", "Tigern", "Korpen", "Räven",
];

function getDistinctColors(count: number): string[] {
  if (count <= TEAM_COLORS.length) {
    const shuffled = [...TEAM_COLORS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
  const colors: string[] = [...TEAM_COLORS];
  for (let i = TEAM_COLORS.length; i < count; i++) {
    const hue = (i * 137.508) % 360;
    colors.push(`hsl(${Math.round(hue)}, 70%, 50%)`);
  }
  return colors;
}

export interface IStorage {
  createSession(): Promise<GameSession>;
  getSession(id: string): Promise<GameSession | undefined>;
  addPlayer(sessionId: string, name: string): Promise<Player>;
  updatePlayerName(sessionId: string, playerId: string, name: string): Promise<Player | undefined>;
  removePlayer(sessionId: string, playerId: string): Promise<void>;
  banPlayer(sessionId: string, playerId: string): Promise<void>;
  randomizeTeams(sessionId: string, teamSize: number): Promise<Team[]>;
  setBoards(sessionId: string, boards: GameBoard[]): Promise<void>;
  startGame(sessionId: string): Promise<void>;
  nextClue(sessionId: string): Promise<number>;
  lockPlayerAnswer(sessionId: string, playerId: string, answer: string): Promise<void>;
  revealAnswer(sessionId: string): Promise<void>;
  overridePlayerAnswer(sessionId: string, playerId: string, boardIndex: number, correct: boolean): Promise<void>;
  penalizePlayer(sessionId: string, playerId: string, points: number): Promise<void>;
  nextQuestion(sessionId: string): Promise<void>;
  finishGame(sessionId: string): Promise<void>;
  resetSession(sessionId: string): Promise<void>;
  getPublicSession(id: string): Promise<Omit<GameSession, "adminToken"> | undefined>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, GameSession>;

  constructor() {
    this.sessions = new Map();
  }

  async createSession(): Promise<GameSession> {
    const id = generateSessionId();
    const adminToken = randomUUID();
    const session: GameSession = {
      id,
      adminToken,
      players: [],
      teams: [],
      boards: [],
      currentBoardIndex: 0,
      currentClueIndex: 0,
      gameState: "lobby",
      teamSize: 3,
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<GameSession | undefined> {
    return this.sessions.get(id);
  }

  async getPublicSession(id: string): Promise<Omit<GameSession, "adminToken"> | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const { adminToken, ...publicSession } = session;
    return publicSession;
  }

  async addPlayer(sessionId: string, name: string): Promise<Player> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    const player: Player = {
      id: randomUUID(),
      name,
      sessionId,
      teamId: null,
      answers: [],
      score: 0,
      banned: false,
    };
    session.players.push(player);
    return player;
  }

  async updatePlayerName(sessionId: string, playerId: string, name: string): Promise<Player | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    const player = session.players.find((p) => p.id === playerId);
    if (!player) return undefined;
    player.name = name;
    return player;
  }

  async removePlayer(sessionId: string, playerId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const player = session.players.find((p) => p.id === playerId);
    if (player && player.teamId) {
      const team = session.teams.find((t) => t.id === player.teamId);
      if (team) {
        team.score -= player.score;
        if (team.score < 0) team.score = 0;
        team.players = team.players.filter((id) => id !== playerId);
      }
    }
    session.players = session.players.filter((p) => p.id !== playerId);
  }

  async banPlayer(sessionId: string, playerId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const player = session.players.find((p) => p.id === playerId);
    if (!player) return;
    player.banned = true;
    for (const team of session.teams) {
      team.players = team.players.filter((id) => id !== playerId);
    }
    const team = session.teams.find((t) => t.id === player.teamId);
    if (team) {
      team.score -= player.score;
      if (team.score < 0) team.score = 0;
    }
    player.teamId = null;
  }

  async randomizeTeams(sessionId: string, teamSize: number): Promise<Team[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const activePlayers = session.players.filter((p) => !p.banned);
    const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
    const numTeams = Math.ceil(shuffled.length / teamSize);
    const colors = getDistinctColors(numTeams);
    const usedNameIndexes = new Set<number>();
    const teams: Team[] = [];

    for (let i = 0; i < numTeams; i++) {
      let nameIdx: number;
      do {
        nameIdx = Math.floor(Math.random() * TEAM_NAMES.length);
      } while (usedNameIndexes.has(nameIdx) && usedNameIndexes.size < TEAM_NAMES.length);
      usedNameIndexes.add(nameIdx);

      const teamPlayers = shuffled.slice(i * teamSize, (i + 1) * teamSize);
      const team: Team = {
        id: randomUUID(),
        name: `Lag ${TEAM_NAMES[nameIdx]}`,
        color: colors[i],
        players: teamPlayers.map((p) => p.id),
        score: 0,
      };
      teams.push(team);
      teamPlayers.forEach((p) => {
        const found = session.players.find((sp) => sp.id === p.id);
        if (found) found.teamId = team.id;
      });
    }

    session.teams = teams;
    session.teamSize = teamSize;
    return teams;
  }

  async setBoards(sessionId: string, boards: GameBoard[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    session.boards = boards;
  }

  async startGame(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.teams.length === 0) throw new Error("Inga lag skapade");
    if (session.boards.length === 0) throw new Error("Inget spelbräde laddat");
    session.gameState = "playing";
    session.currentBoardIndex = 0;
    session.currentClueIndex = 0;
  }

  async nextClue(sessionId: string): Promise<number> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.currentClueIndex < 4) {
      session.currentClueIndex++;
    }
    return session.currentClueIndex;
  }

  async lockPlayerAnswer(sessionId: string, playerId: string, answer: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    const player = session.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not found");
    if (player.banned) return;

    const existing = player.answers.find((a) => a.boardIndex === session.currentBoardIndex);
    if (existing && existing.locked) return;

    if (existing) {
      existing.answer = answer;
      existing.locked = true;
      existing.lockedAtClue = session.currentClueIndex;
    } else {
      player.answers.push({
        boardIndex: session.currentBoardIndex,
        answer,
        locked: true,
        lockedAtClue: session.currentClueIndex,
        correct: null,
        pointsAwarded: 0,
      });
    }
  }

  async revealAnswer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const currentBoard = session.boards[session.currentBoardIndex];
    if (!currentBoard) return;

    const correctAnswer = currentBoard.answer.toLowerCase().trim();

    for (const team of session.teams) {
      let teamRoundPoints = 0;
      const teamPlayers = session.players.filter((p) => p.teamId === team.id && !p.banned);

      for (const player of teamPlayers) {
        const pAnswer = player.answers.find((a) => a.boardIndex === session.currentBoardIndex);
        if (pAnswer && pAnswer.locked) {
          const isCorrect = pAnswer.answer.toLowerCase().trim() === correctAnswer;
          pAnswer.correct = isCorrect;
          if (isCorrect) {
            const points = CLUE_POINTS[pAnswer.lockedAtClue] || 2;
            pAnswer.pointsAwarded = points;
            player.score += points;
            teamRoundPoints += points;
          } else {
            pAnswer.pointsAwarded = 0;
          }
        } else if (pAnswer) {
          pAnswer.correct = false;
          pAnswer.pointsAwarded = 0;
        }
      }

      team.score += teamRoundPoints;
    }

    session.gameState = "revealing";
  }

  async overridePlayerAnswer(sessionId: string, playerId: string, boardIndex: number, correct: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    const player = session.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not found");

    const pAnswer = player.answers.find((a) => a.boardIndex === boardIndex);
    if (!pAnswer || !pAnswer.locked) return;

    const wasCorrect = pAnswer.correct;
    const oldPoints = pAnswer.pointsAwarded;

    if (correct && !wasCorrect) {
      const points = CLUE_POINTS[pAnswer.lockedAtClue] || 2;
      pAnswer.correct = true;
      pAnswer.pointsAwarded = points;
      player.score += points;
      const team = session.teams.find((t) => t.id === player.teamId);
      if (team) team.score += points;
    } else if (!correct && wasCorrect) {
      pAnswer.correct = false;
      player.score -= oldPoints;
      pAnswer.pointsAwarded = 0;
      const team = session.teams.find((t) => t.id === player.teamId);
      if (team) team.score -= oldPoints;
    }
  }

  async penalizePlayer(sessionId: string, playerId: string, points: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    const player = session.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not found");

    player.score -= points;
    const team = session.teams.find((t) => t.id === player.teamId);
    if (team) team.score -= points;
  }

  async nextQuestion(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    session.currentBoardIndex++;
    session.currentClueIndex = 0;
    session.gameState = "playing";
  }

  async finishGame(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    session.gameState = "finished";
  }

  async resetSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.teams = [];
    session.currentBoardIndex = 0;
    session.currentClueIndex = 0;
    session.gameState = "lobby";
    session.players = session.players.filter((p) => !p.banned);
    session.players.forEach((p) => {
      p.teamId = null;
      p.answers = [];
      p.score = 0;
    });
  }
}

export const storage = new MemStorage();
