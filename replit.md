# På Spåret - Klassrumsspel

## Overview
Interactive classroom quiz game inspired by the Swedish TV show "På Spåret". Teachers create game sessions, students join, get randomly assigned to teams, and compete by guessing answers from progressively easier clues.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components + wouter routing
- **Backend**: Express + WebSocket (ws) for real-time game state
- **Storage**: In-memory (MemStorage) - game sessions are ephemeral

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
3. Admin randomizes teams with slider for team size
4. Admin imports game board JSON (10 answers × 5 clues each)
5. Admin starts game → clues shown progressively
6. Teams lock/pass answers → admin reveals → scoring → next question

## JSON Board Format
```json
{
  "boards": [
    {
      "answer": "Answer text",
      "clues": ["Hardest clue", "Hard", "Medium", "Easy", "Easiest/answer"]
    }
  ]
}
```
