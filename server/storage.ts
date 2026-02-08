import type { GameSession, Player, Team, GameBoard, TeamAnswer } from "@shared/schema";
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
  randomizeTeams(sessionId: string, teamSize: number): Promise<Team[]>;
  setBoards(sessionId: string, boards: GameBoard[]): Promise<void>;
  startGame(sessionId: string): Promise<void>;
  nextClue(sessionId: string): Promise<number>;
  lockAnswer(sessionId: string, teamId: string, answer: string): Promise<void>;
  passTeam(sessionId: string, teamId: string): Promise<void>;
  unlockAnswer(sessionId: string, teamId: string): Promise<void>;
  revealAnswer(sessionId: string): Promise<void>;
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
    session.players = session.players.filter((p) => p.id !== playerId);
  }

  async randomizeTeams(sessionId: string, teamSize: number): Promise<Team[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const shuffled = [...session.players].sort(() => Math.random() - 0.5);
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
        answers: [],
      };
      teams.push(team);
      teamPlayers.forEach((p) => {
        const found = session.players.find((sp) => sp.id === p.id);
        if (found) found.teamId = team.id;
      });
    }

    session.teams = teams;
    session.teamSize = teamSize;
    session.gameState = "teams";
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
      for (const team of session.teams) {
        const answer = team.answers.find((a) => a.boardIndex === session.currentBoardIndex);
        if (answer?.passed) {
          answer.passed = false;
        }
      }
    }
    return session.currentClueIndex;
  }

  async lockAnswer(sessionId: string, teamId: string, answer: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    const team = session.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");

    let existingAnswer = team.answers.find((a) => a.boardIndex === session.currentBoardIndex);
    if (existingAnswer) {
      if ((existingAnswer as any)._wasUnlocked) {
        existingAnswer.unlockedAndRelocked = true;
        delete (existingAnswer as any)._wasUnlocked;
      }
      existingAnswer.answer = answer;
      existingAnswer.locked = true;
      existingAnswer.passed = false;
      existingAnswer.lockedAtClue = session.currentClueIndex;
    } else {
      team.answers.push({
        boardIndex: session.currentBoardIndex,
        answer,
        locked: true,
        passed: false,
        lockedAtClue: session.currentClueIndex,
        unlockedAndRelocked: false,
        correct: null,
      });
    }
  }

  async passTeam(sessionId: string, teamId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    const team = session.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");

    let existingAnswer = team.answers.find((a) => a.boardIndex === session.currentBoardIndex);
    if (existingAnswer) {
      existingAnswer.passed = true;
      existingAnswer.locked = false;
    } else {
      team.answers.push({
        boardIndex: session.currentBoardIndex,
        answer: "",
        locked: false,
        passed: true,
        lockedAtClue: session.currentClueIndex,
        unlockedAndRelocked: false,
        correct: null,
      });
    }
  }

  async unlockAnswer(sessionId: string, teamId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    const team = session.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");

    const existingAnswer = team.answers.find((a) => a.boardIndex === session.currentBoardIndex);
    if (existingAnswer && existingAnswer.locked) {
      existingAnswer.locked = false;
      existingAnswer._wasUnlocked = true;
    }
  }

  async revealAnswer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const currentBoard = session.boards[session.currentBoardIndex];
    if (!currentBoard) return;

    const correctAnswer = currentBoard.answer.toLowerCase().trim();

    for (const team of session.teams) {
      const teamAnswer = team.answers.find((a) => a.boardIndex === session.currentBoardIndex);
      if (teamAnswer && teamAnswer.locked) {
        const isCorrect = teamAnswer.answer.toLowerCase().trim() === correctAnswer;
        teamAnswer.correct = isCorrect;
        if (isCorrect) {
          const basePoints = 10;
          const clueBonus = (4 - teamAnswer.lockedAtClue) * 0;
          let points = basePoints;
          if (teamAnswer.unlockedAndRelocked) {
            points = Math.floor(points / 2);
          }
          team.score += points;
        }
      } else if (teamAnswer) {
        teamAnswer.correct = false;
      }
    }

    session.gameState = "revealing";
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
    session.players.forEach((p) => (p.teamId = null));
    for (const team of session.teams) {
      team.answers = [];
      team.score = 0;
    }
  }
}

export const storage = new MemStorage();
