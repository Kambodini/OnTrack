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
- Messages from client: `lock_answer`, `pass`, `unlock`
- Messages from server: `session_update`

## Game Flow
1. Teacher visits `/` → session created → redirected to admin
2. Students visit `/:sessionId` → enter name → redirected to play
3. Admin creates/selects a game board (saved in localStorage) or imports JSON
4. Admin randomizes teams with slider for team size (1-8 per team)
5. Admin starts game → clues shown progressively
6. Teams lock/pass answers → admin reveals → scoring → next question

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

## Recent Changes
- 2026-02-08: Added full board manager (create/edit/delete/select) with localStorage persistence
- 2026-02-08: Added JSON import/export for sharing boards between colleagues
- 2026-02-08: Changed team size slider range to 1-8 (was 2-10)
- 2026-02-08: Start game button disabled when no board is loaded
