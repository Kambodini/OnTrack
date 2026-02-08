import { useParams, useLocation } from "wouter";
import { getAdminToken } from "@/lib/gameStorage";
import { useGameWebSocket } from "@/lib/useWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Shuffle, Play, ChevronRight, Copy, Check,
  Lock, SkipForward, Trophy, Upload, Download, Pencil,
  Eye, ArrowRight, CheckCircle2, XCircle, RotateCcw
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { Player, Team, GameBoard, GameBoardExport } from "@shared/schema";

export default function AdminPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId || "";
  const [, setLocation] = useLocation();
  const adminToken = getAdminToken(sessionId);
  const { session, connected, send } = useGameWebSocket(sessionId, null);
  const [teamSize, setTeamSize] = useState(3);
  const [copied, setCopied] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [boardEditorOpen, setBoardEditorOpen] = useState(false);

  useEffect(() => {
    if (!adminToken) {
      setLocation(`/${sessionId}`);
    }
  }, [adminToken, sessionId, setLocation]);

  const shareUrl = useMemo(() => {
    return `${window.location.origin}/${sessionId}`;
  }, [sessionId]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  async function handleRenameSave(playerId: string) {
    try {
      await apiRequest("PATCH", `/api/sessions/${sessionId}/players/${playerId}`, {
        name: editName.trim(),
        adminToken,
      });
      setEditingPlayer(null);
    } catch (e) {
      console.error("Failed to rename player", e);
    }
  }

  async function handleRandomizeTeams() {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/teams`, {
        adminToken,
        teamSize,
      });
    } catch (e) {
      console.error("Failed to randomize teams", e);
    }
  }

  async function handleImportBoard() {
    try {
      setImportError("");
      const parsed = JSON.parse(importJson);
      const boards = parsed.boards || parsed;
      await apiRequest("POST", `/api/sessions/${sessionId}/boards`, {
        adminToken,
        boards: Array.isArray(boards) ? boards : [boards],
      });
      setImportOpen(false);
      setImportJson("");
    } catch (e: any) {
      setImportError(e.message || "Ogiltig JSON");
    }
  }

  function handleExportBoard() {
    if (!session?.boards.length) return;
    const exported: GameBoardExport = {
      title: "På Spåret - Spelbräde",
      boards: session.boards,
    };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spelbrade.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleStartGame() {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/start`, { adminToken });
    } catch (e) {
      console.error("Failed to start game", e);
    }
  }

  async function handleNextClue() {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/next-clue`, { adminToken });
    } catch (e) {
      console.error("Failed to advance clue", e);
    }
  }

  async function handleRevealAnswer() {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/reveal`, { adminToken });
    } catch (e) {
      console.error("Failed to reveal answer", e);
    }
  }

  async function handleNextQuestion() {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/next-question`, { adminToken });
    } catch (e) {
      console.error("Failed to go to next question", e);
    }
  }

  async function handleFinishGame() {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/finish`, { adminToken });
    } catch (e) {
      console.error("Failed to finish game", e);
    }
  }

  async function handleResetToLobby() {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/reset`, { adminToken });
    } catch (e) {
      console.error("Failed to reset", e);
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Laddar spelsession...</p>
        </div>
      </div>
    );
  }

  const currentBoard = session.boards[session.currentBoardIndex];
  const currentClue = currentBoard?.clues?.[session.currentClueIndex];
  const isLastClue = session.currentClueIndex >= 4;
  const isLastBoard = session.currentBoardIndex >= session.boards.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">På Spåret</h1>
            <Badge variant="secondary">Admin</Badge>
            {!connected && <Badge variant="destructive">Frånkopplad</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              data-testid="input-share-link"
              value={shareUrl}
              readOnly
              className="w-64 text-sm"
            />
            <Button
              data-testid="button-copy-link"
              size="icon"
              variant="outline"
              onClick={copyLink}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {session.gameState === "lobby" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Spelare ({session.players.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {session.players.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-6">
                      Väntar på att spelare ska ansluta...
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {session.players.map((p: Player) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          {editingPlayer === p.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                data-testid={`input-edit-name-${p.id}`}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameSave(p.id);
                                  if (e.key === "Escape") setEditingPlayer(null);
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleRenameSave(p.id)}
                              >
                                Spara
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium flex-1 text-sm">{p.name}</span>
                              <Button
                                data-testid={`button-edit-player-${p.id}`}
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingPlayer(p.id);
                                  setEditName(p.name);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shuffle className="w-5 h-5" />
                      Skapa lag
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Lagstorlek</span>
                        <span className="font-bold text-lg">{teamSize}</span>
                      </div>
                      <Slider
                        data-testid="slider-team-size"
                        value={[teamSize]}
                        onValueChange={(v) => setTeamSize(v[0])}
                        min={2}
                        max={Math.max(2, Math.min(10, session.players.length))}
                        step={1}
                      />
                    </div>
                    <Button
                      data-testid="button-randomize-teams"
                      onClick={handleRandomizeTeams}
                      disabled={session.players.length < 2}
                      className="gap-2"
                    >
                      <Shuffle className="w-4 h-4" />
                      Slumpa lag
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Spelbräde
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {session.boards.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">
                          {session.boards.length} frågor laddade
                        </p>
                        {session.boards.map((b: GameBoard, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                            <Badge variant="secondary">{i + 1}</Badge>
                            <span className="font-medium truncate">{b.answer}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Inget spelbräde laddat
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Dialog open={importOpen} onOpenChange={setImportOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-import-board" variant="outline" className="flex-1 gap-2">
                            <Upload className="w-4 h-4" />
                            Importera JSON
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Importera spelbräde</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-4">
                            <Textarea
                              data-testid="textarea-import-json"
                              placeholder={`{
  "boards": [
    {
      "answer": "Pythagorassats",
      "clues": [
        "Svåraste ledtråden...",
        "Lite enklare...",
        "Medel...",
        "Ganska lätt...",
        "Facit: a² + b² = c²"
      ]
    }
  ]
}`}
                              value={importJson}
                              onChange={(e) => setImportJson(e.target.value)}
                              className="min-h-[300px] font-mono text-sm"
                            />
                            {importError && (
                              <p className="text-destructive text-sm">{importError}</p>
                            )}
                            <Button
                              data-testid="button-confirm-import"
                              onClick={handleImportBoard}
                              disabled={!importJson.trim()}
                              className="gap-2"
                            >
                              <Upload className="w-4 h-4" />
                              Importera
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {session.boards.length > 0 && (
                        <Button
                          data-testid="button-export-board"
                          variant="outline"
                          className="gap-2"
                          onClick={handleExportBoard}
                        >
                          <Download className="w-4 h-4" />
                          Exportera
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {session.teams.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg">Lag</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {session.teams.map((team: Team) => {
                      const members = session.players.filter((p: Player) => p.teamId === team.id);
                      return (
                        <div
                          key={team.id}
                          className="p-4 rounded-md border"
                          style={{ borderColor: team.color + "44" }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div
                              className="w-5 h-5 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="font-bold" style={{ color: team.color }}>{team.name}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {members.map((p: Player) => (
                              <span key={p.id} className="text-sm text-muted-foreground">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              data-testid="button-start-game"
              size="lg"
              className="gap-2 self-center"
              disabled={session.teams.length === 0 || session.boards.length === 0}
              onClick={handleStartGame}
            >
              <Play className="w-5 h-5" />
              Starta spelet
            </Button>
          </div>
        )}

        {session.gameState === "teams" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Lag har skapats!</h2>
              <p className="text-muted-foreground">Eleverna kan nu se sina lag</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {session.teams.map((team: Team) => {
                const members = session.players.filter((p: Player) => p.teamId === team.id);
                return (
                  <Card key={team.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="font-bold text-lg" style={{ color: team.color }}>{team.name}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {members.map((p: Player) => (
                          <span key={p.id} className="text-sm">{p.name}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Button
              data-testid="button-start-game"
              size="lg"
              className="gap-2 self-center"
              onClick={handleStartGame}
            >
              <Play className="w-5 h-5" />
              Starta spelet
            </Button>
          </div>
        )}

        {session.gameState === "playing" && currentBoard && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Fråga {session.currentBoardIndex + 1} av {session.boards.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ledtråd {session.currentClueIndex + 1} av 5
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Svar: {currentBoard.answer}
                </Badge>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wide">Nuvarande ledtråd</p>
                <p className="text-xl font-medium leading-relaxed">{currentClue}</p>
              </CardContent>
            </Card>

            <div className="flex gap-3 flex-wrap">
              {!isLastClue && (
                <Button
                  data-testid="button-next-clue"
                  variant="outline"
                  onClick={handleNextClue}
                  className="gap-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  Nästa ledtråd
                </Button>
              )}
              <Button
                data-testid="button-reveal-answer"
                onClick={handleRevealAnswer}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                Visa facit & poängräkning
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Lagstatus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {session.teams.map((team: Team) => {
                    const teamAnswer = team.answers.find(
                      (a) => a.boardIndex === session.currentBoardIndex
                    );
                    return (
                      <div
                        key={team.id}
                        className="p-4 rounded-md border"
                        style={{ borderColor: team.color + "44" }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="font-bold text-sm" style={{ color: team.color }}>
                              {team.name}
                            </span>
                          </div>
                          <span className="text-sm font-bold">{team.score}p</span>
                        </div>
                        <div className="mt-2">
                          {teamAnswer?.locked ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Lock className="w-3.5 h-3.5 text-primary" />
                              <span className="text-primary font-medium">Låst</span>
                              {teamAnswer.unlockedAndRelocked && (
                                <Badge variant="secondary" className="text-xs">Bytt</Badge>
                              )}
                            </div>
                          ) : teamAnswer?.passed ? (
                            <div className="flex items-center gap-2 text-sm">
                              <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Passat</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Väntar...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Alla ledtrådar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {currentBoard.clues.map((clue: string, i: number) => (
                    <div
                      key={i}
                      className={`p-3 rounded-md text-sm ${
                        i <= session.currentClueIndex
                          ? "bg-muted/50"
                          : "opacity-30"
                      } ${i === session.currentClueIndex ? "ring-1 ring-primary/30" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">{i + 1}</Badge>
                        <span>{i <= session.currentClueIndex ? clue : "????"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {session.gameState === "revealing" && currentBoard && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">{currentBoard.answer}</h2>
              <p className="text-muted-foreground">Facit avslöjat</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {session.teams.map((team: Team) => {
                const teamAnswer = team.answers.find(
                  (a) => a.boardIndex === session.currentBoardIndex
                );
                return (
                  <Card key={team.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-5 h-5 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="font-bold" style={{ color: team.color }}>
                          {team.name}
                        </span>
                        <span className="ml-auto font-bold">{team.score}p</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {teamAnswer?.correct === true ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-green-500 font-medium">Rätt!</span>
                          </>
                        ) : teamAnswer?.correct === false ? (
                          <>
                            <XCircle className="w-4 h-4 text-destructive" />
                            <span className="text-destructive font-medium">Fel</span>
                          </>
                        ) : (
                          <>
                            <SkipForward className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Passade</span>
                          </>
                        )}
                      </div>
                      {teamAnswer?.answer && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Svar: "{teamAnswer.answer}"
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              {!isLastBoard ? (
                <Button
                  data-testid="button-next-question"
                  onClick={handleNextQuestion}
                  className="gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Nästa fråga
                </Button>
              ) : (
                <Button
                  data-testid="button-finish-game"
                  onClick={handleFinishGame}
                  className="gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  Avsluta spelet
                </Button>
              )}
            </div>
          </div>
        )}

        {session.gameState === "finished" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-3xl font-bold mb-2">Spelet är slut!</h2>
            </div>

            <div className="max-w-md mx-auto w-full flex flex-col gap-3">
              {[...session.teams]
                .sort((a, b) => b.score - a.score)
                .map((team: Team, i: number) => (
                  <div
                    key={team.id}
                    className={`flex items-center gap-4 p-4 rounded-md border ${
                      i === 0 ? "ring-2 ring-yellow-500/30" : ""
                    }`}
                    style={{ borderColor: team.color + "44" }}
                  >
                    <span className="text-2xl font-bold text-muted-foreground w-8 text-center">
                      {i + 1}
                    </span>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: team.color }}
                    >
                      {i === 0 && <Trophy className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className="font-bold" style={{ color: team.color }}>{team.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {session.players.filter((p: Player) => p.teamId === team.id).map((p: Player) => p.name).join(", ")}
                      </div>
                    </div>
                    <span className="text-xl font-bold">{team.score}p</span>
                  </div>
                ))}
            </div>

            <Button
              data-testid="button-reset"
              variant="outline"
              className="self-center gap-2"
              onClick={handleResetToLobby}
            >
              <RotateCcw className="w-4 h-4" />
              Nytt spel (behåll spelare)
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
