import { useParams, useLocation } from "wouter";
import { getAdminToken, getSavedBoardSets, createBoardSet, saveBoardSet, deleteBoardSet, type SavedBoardSet } from "@/lib/gameStorage";
import { useGameWebSocket } from "@/lib/useWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Shuffle, Play, ChevronRight, Copy, Check,
  Lock, SkipForward, Trophy, Upload, Download, Pencil,
  Eye, ArrowRight, CheckCircle2, XCircle, RotateCcw,
  Plus, Trash2, FolderOpen, ClipboardCopy, ClipboardPaste, Save
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { Player, Team, GameBoard, GameBoardExport } from "@shared/schema";

function emptyClues(): string[] {
  return ["", "", "", "", ""];
}

function BoardEditor({
  initialBoards,
  initialName,
  onSave,
  onCancel,
}: {
  initialBoards: GameBoard[];
  initialName: string;
  onSave: (name: string, boards: GameBoard[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [boards, setBoards] = useState<GameBoard[]>(
    initialBoards.length > 0 ? initialBoards : [{ answer: "", clues: emptyClues() }]
  );

  function updateBoard(index: number, field: "answer", value: string): void;
  function updateBoard(index: number, field: "clue", value: string, clueIndex: number): void;
  function updateBoard(index: number, field: "answer" | "clue", value: string, clueIndex?: number) {
    setBoards((prev) => {
      const updated = [...prev];
      if (field === "answer") {
        updated[index] = { ...updated[index], answer: value };
      } else if (field === "clue" && clueIndex !== undefined) {
        const clues = [...updated[index].clues];
        clues[clueIndex] = value;
        updated[index] = { ...updated[index], clues };
      }
      return updated;
    });
  }

  function addBoard() {
    setBoards((prev) => [...prev, { answer: "", clues: emptyClues() }]);
  }

  function removeBoard(index: number) {
    setBoards((prev) => prev.filter((_, i) => i !== index));
  }

  const isValid = name.trim() && boards.length > 0 && boards.every(
    (b) => b.answer.trim() && b.clues.every((c) => c.trim())
  );

  const clueLabels = ["Ledtråd 1 (svårast)", "Ledtråd 2", "Ledtråd 3", "Ledtråd 4", "Ledtråd 5 (lättast)"];

  return (
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
      <div>
        <label className="text-sm font-medium mb-1 block">Namn på spelbrädet</label>
        <Input
          data-testid="input-board-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="T.ex. Matematik åk 8"
        />
      </div>

      {boards.map((board, bi) => (
        <Card key={bi}>
          <CardContent className="pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Fråga {bi + 1}</span>
              {boards.length > 1 && (
                <Button
                  data-testid={`button-remove-question-${bi}`}
                  size="icon"
                  variant="ghost"
                  onClick={() => removeBoard(bi)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Svar</label>
              <Input
                data-testid={`input-answer-${bi}`}
                value={board.answer}
                onChange={(e) => updateBoard(bi, "answer", e.target.value)}
                placeholder="Rätt svar"
              />
            </div>
            {board.clues.map((clue, ci) => (
              <div key={ci}>
                <label className="text-xs text-muted-foreground mb-1 block">{clueLabels[ci]}</label>
                <Input
                  data-testid={`input-clue-${bi}-${ci}`}
                  value={clue}
                  onChange={(e) => updateBoard(bi, "clue", e.target.value, ci)}
                  placeholder={clueLabels[ci]}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {boards.length < 10 && (
        <Button
          data-testid="button-add-question"
          variant="outline"
          className="gap-2"
          onClick={addBoard}
        >
          <Plus className="w-4 h-4" />
          Lägg till fråga
        </Button>
      )}

      <div className="flex gap-2 justify-end sticky bottom-0 bg-background pt-2">
        <Button data-testid="button-cancel-edit" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button
          data-testid="button-save-board"
          disabled={!isValid}
          onClick={() => onSave(name.trim(), boards)}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          Spara
        </Button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId || "";
  const [, setLocation] = useLocation();
  const adminToken = getAdminToken(sessionId);
  const { session, connected } = useGameWebSocket(sessionId, null);
  const [teamSize, setTeamSize] = useState(3);
  const [copied, setCopied] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [savedBoardSets, setSavedBoardSets] = useState<SavedBoardSet[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBoardSet, setEditingBoardSet] = useState<SavedBoardSet | null>(null);
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState("");
  const [exportJson, setExportJson] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    setSavedBoardSets(getSavedBoardSets());
  }, []);

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

  function refreshSavedBoards() {
    setSavedBoardSets(getSavedBoardSets());
  }

  function handleCreateNewBoard() {
    setEditingBoardSet(null);
    setEditorOpen(true);
  }

  function handleEditBoard(boardSet: SavedBoardSet) {
    setEditingBoardSet(boardSet);
    setEditorOpen(true);
  }

  function handleDeleteBoard(id: string) {
    deleteBoardSet(id);
    refreshSavedBoards();
  }

  function handleSaveBoard(name: string, boards: GameBoard[]) {
    if (editingBoardSet) {
      saveBoardSet({ ...editingBoardSet, name, boards, updatedAt: Date.now() });
    } else {
      createBoardSet(name, boards);
    }
    refreshSavedBoards();
    setEditorOpen(false);
    setEditingBoardSet(null);
  }

  async function handleSelectBoard(boardSet: SavedBoardSet) {
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/boards`, {
        adminToken,
        boards: boardSet.boards,
      });
    } catch (e) {
      console.error("Failed to load board", e);
    }
  }

  function handleImportFromJson() {
    try {
      setImportError("");
      const parsed = JSON.parse(importJson);
      const boards: GameBoard[] = parsed.boards || (Array.isArray(parsed) ? parsed : [parsed]);
      if (!Array.isArray(boards) || boards.length === 0) {
        setImportError("Ingen frågor hittades i JSON");
        return;
      }
      if (boards.length > 10) {
        setImportError("Max 10 frågor per spelbräde");
        return;
      }
      for (const b of boards) {
        if (!b.answer || !Array.isArray(b.clues) || b.clues.length !== 5) {
          setImportError("Varje fråga måste ha ett svar och exakt 5 ledtrådar");
          return;
        }
      }
      const name = parsed.title || `Importerat ${new Date().toLocaleDateString("sv-SE")}`;
      createBoardSet(name, boards);
      refreshSavedBoards();
      setImportJsonOpen(false);
      setImportJson("");
    } catch (e: any) {
      setImportError("Ogiltig JSON: " + (e.message || ""));
    }
  }

  function handleExportBoardSet(boardSet: SavedBoardSet) {
    const exported: GameBoardExport = {
      title: boardSet.name,
      boards: boardSet.boards,
    };
    setExportJson(JSON.stringify(exported, null, 2));
    setExportOpen(true);
  }

  function handleCopyExportJson() {
    navigator.clipboard.writeText(exportJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }

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
                        min={1}
                        max={8}
                        step={1}
                      />
                    </div>
                    <Button
                      data-testid="button-randomize-teams"
                      onClick={handleRandomizeTeams}
                      disabled={session.players.length < 1}
                      className="gap-2"
                    >
                      <Shuffle className="w-4 h-4" />
                      Slumpa lag
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FolderOpen className="w-5 h-5" />
                      Spelbräden
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {session.boards.length > 0 && (
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                        <p className="text-sm font-medium text-primary mb-1">
                          Aktivt spelbräde: {session.boards.length} frågor
                        </p>
                        <div className="flex flex-col gap-1">
                          {session.boards.map((b: GameBoard, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <Badge variant="secondary">{i + 1}</Badge>
                              <span className="truncate">{b.answer}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {savedBoardSets.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Sparade spelbräden</p>
                        {savedBoardSets.map((bs) => (
                          <div
                            key={bs.id}
                            data-testid={`board-set-${bs.id}`}
                            className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{bs.name}</p>
                              <p className="text-xs text-muted-foreground">{bs.boards.length} frågor</p>
                            </div>
                            <Button
                              data-testid={`button-select-board-${bs.id}`}
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectBoard(bs)}
                              className="gap-1 shrink-0"
                            >
                              <Play className="w-3 h-3" />
                              Välj
                            </Button>
                            <Button
                              data-testid={`button-export-board-${bs.id}`}
                              size="icon"
                              variant="ghost"
                              onClick={() => handleExportBoardSet(bs)}
                            >
                              <ClipboardCopy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              data-testid={`button-edit-board-${bs.id}`}
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditBoard(bs)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              data-testid={`button-delete-board-${bs.id}`}
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteBoard(bs.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {savedBoardSets.length === 0 && session.boards.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Inga spelbräden sparade. Skapa ett nytt eller klistra in JSON.
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        data-testid="button-create-board"
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={handleCreateNewBoard}
                      >
                        <Plus className="w-4 h-4" />
                        Skapa nytt
                      </Button>
                      <Dialog open={importJsonOpen} onOpenChange={setImportJsonOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-import-board" variant="outline" className="flex-1 gap-2">
                            <ClipboardPaste className="w-4 h-4" />
                            Klistra in JSON
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Importera spelbräde från JSON</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">
                            Klistra in JSON som du fått från en kollega för att spara spelbrädet.
                          </p>
                          <Textarea
                            data-testid="textarea-import-json"
                            placeholder={`{
  "title": "Mitt spelbräde",
  "boards": [
    {
      "answer": "Svaret",
      "clues": ["Svårast", "Svår", "Medel", "Lätt", "Lättast"]
    }
  ]
}`}
                            value={importJson}
                            onChange={(e) => setImportJson(e.target.value)}
                            className="min-h-[250px] font-mono text-sm"
                          />
                          {importError && (
                            <p className="text-destructive text-sm">{importError}</p>
                          )}
                          <Button
                            data-testid="button-confirm-import"
                            onClick={handleImportFromJson}
                            disabled={!importJson.trim()}
                            className="gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            Importera & spara
                          </Button>
                        </DialogContent>
                      </Dialog>
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
              disabled={session.boards.length === 0}
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

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingBoardSet ? "Redigera spelbräde" : "Skapa nytt spelbräde"}
            </DialogTitle>
          </DialogHeader>
          <BoardEditor
            initialBoards={editingBoardSet?.boards || []}
            initialName={editingBoardSet?.name || ""}
            onSave={handleSaveBoard}
            onCancel={() => {
              setEditorOpen(false);
              setEditingBoardSet(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dela spelbräde</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Kopiera texten nedan och skicka den till en kollega. De kan klistra in den med "Klistra in JSON".
          </p>
          <Textarea
            data-testid="textarea-export-json"
            value={exportJson}
            readOnly
            className="min-h-[250px] font-mono text-sm"
          />
          <Button
            data-testid="button-copy-json"
            onClick={handleCopyExportJson}
            className="gap-2"
          >
            {copiedJson ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
            {copiedJson ? "Kopierat!" : "Kopiera JSON"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
