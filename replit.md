# På Spåret - Klassrumsspel

## Overview
Interactive classroom quiz game inspired by the Swedish TV show "På Spåret". Teachers create game sessions, students join, get randomly assigned to teams, and compete by guessing answers from progressively easier clues.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components + wouter routing
- **Backend**: Express + WebSocket (ws) for real-time game state
- **Storage**: In-memory (MemStorage) - game sessions are ephemeral
- **Board Storage**: localStorage - saved board sets persist in browser

## Key Routes
- `/` - Creates new session, redirects to admin
- `/:sessionId` - Join page for students (enter name)
- `/:sessionId/admin` - Admin dashboard (requires localStorage token)
- `/:sessionId/play` - Player/student game view

## API Endpoints
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session (public)
- `POST /api/sessions/:id/join` - Join as player
- `PATCH /api/sessions/:id/players/:playerId` - Rename player (admin)
- `POST /api/sessions/:id/teams` - Randomize teams (admin)
- `POST /api/sessions/:id/boards` - Import game boards (admin)
- `POST /api/sessions/:id/start` - Start game (admin)
- `POST /api/sessions/:id/next-clue` - Show next clue (admin)
- `POST /api/sessions/:id/reveal` - Reveal answer & score (admin)
- `POST /api/sessions/:id/next-question` - Next question (admin)
- `POST /api/sessions/:id/finish` - End game (admin)
- `POST /api/sessions/:id/reset` - Reset to lobby (admin)

## WebSocket
- Path: `/ws?sessionId=xxx&playerId=yyy`
- Messages from client: `lock_answer` (individual player locking)
- Messages from server: `session_update`

## Scoring System
- Each player answers individually; points contribute to team total
- Points per clue (descending): 10p, 8p, 6p, 4p, 2p (CLUE_POINTS constant)
- Players lock answers once per question; earlier correct answers = more points
- Admin reveals answer → server checks correctness and awards points

## Game Flow
1. Teacher visits `/` → session created → redirected to admin
2. Students visit `/:sessionId` → enter name → redirected to play
3. Admin creates/selects a game board (saved in localStorage) or imports JSON
4. Admin randomizes teams with slider for team size (1-8 per team)
5. Admin starts game → clues shown progressively
6. Players individually lock answers → admin reveals → scoring → next question

## Board Management
- Boards are saved as "board sets" in localStorage (key: `pa_sparet_saved_boards`)
- Each board set has: id, name, boards[], createdAt, updatedAt
- Admin can create, edit, delete board sets via in-browser editor
- Admin selects a board set to load into the active session
- Boards can be shared between teachers by exporting/importing JSON
- Max 10 questions per board, each with exactly 5 clues

## JSON Board Format
```json
{
  "title": "Board name",
  "boards": [
    {
      "answer": "Answer text",
      "clues": ["Hardest clue", "Hard", "Medium", "Easy", "Easiest/answer"]
    }
  ]
}
```

## API Endpoints (Moderation)
- `DELETE /api/sessions/:id/players/:playerId` - Remove player (admin)
- `POST /api/sessions/:id/players/:playerId/ban` - Ban player (admin)
- `POST /api/sessions/:id/players/:playerId/override` - Override answer correct/incorrect (admin)
- `POST /api/sessions/:id/players/:playerId/penalize` - Penalize player with minus points (admin)

## Recent Changes
- 2026-02-08: Removed "teams" gameState - team randomization stays in lobby
- 2026-02-08: Admin playing view is projector-safe (no facit/answer visible)
- 2026-02-08: Hover tooltips on team cards show player names and lock status
- 2026-02-08: End-game uses team AVERAGE score (total/player count) for fair results
- 2026-02-08: Admin can remove players during gameplay via tooltip
- 2026-02-08: Manual answer correction (toggle correct/incorrect) in reveal phase
- 2026-02-08: Point penalty system (-5p) for vulgar answers
- 2026-02-08: Ban functionality for offensive content (removes from team, deducts score)
- 2026-02-08: Hover tooltips for truncated answers to show full text + player name
- 2026-02-08: Anonymized player names ("Spelare 1, 2...") in reveal phase for privacy
- 2026-02-08: Player banned field added to schema
- 2026-02-08: Players see team assignment in lobby (no separate teams screen)
- 2026-02-08: Banned players see dedicated "Avstängd" screen
- 2026-02-08: Individual player scoring system - each player answers independently, points contribute to team total
- 2026-02-08: Points per clue: 10p, 8p, 6p, 4p, 2p (CLUE_POINTS constant in schema)
- 2026-02-08: Colorful gradient UI theme (indigo-950/purple-950 backgrounds, amber-400/orange-500 accents)
- 2026-02-08: Game rules card displayed on player view showing scoring info
- 2026-02-08: Added full board manager (create/edit/delete/select) with localStorage persistence
- 2026-02-08: Added JSON import/export for sharing boards between colleagues
- 2026-02-08: Changed team size slider range to 1-8 (was 2-10)
- 2026-02-08: Start game button disabled when no board is loaded
