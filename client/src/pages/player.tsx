import { useParams, useLocation } from "wouter";
import { getPlayerId } from "@/lib/gameStorage";
import { useGameWebSocket } from "@/lib/useWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, SkipForward, Unlock, Users, Trophy, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { Team, Player } from "@shared/schema";

export default function PlayerPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId || "";
  const [, setLocation] = useLocation();
  const playerId = getPlayerId(sessionId);
  const { session, connected, send } = useGameWebSocket(sessionId, playerId);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (!playerId) {
      setLocation(`/${sessionId}`);
    }
  }, [playerId, sessionId, setLocation]);

  const myPlayer = useMemo(() =>
    session?.players.find((p: Player) => p.id === playerId),
    [session, playerId]
  );

  const myTeam = useMemo(() =>
    session?.teams.find((t: Team) => t.id === myPlayer?.teamId),
    [session, myPlayer]
  );

  const currentAnswer = useMemo(() => {
    if (!myTeam || session?.currentBoardIndex === undefined) return null;
    return myTeam.answers.find((a) => a.boardIndex === session.currentBoardIndex) || null;
  }, [myTeam, session]);

  useEffect(() => {
    if (currentAnswer?.answer) {
      setAnswer(currentAnswer.answer);
    }
  }, [session?.currentBoardIndex]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Ansluter till spelet...</p>
          {!connected && <p className="text-destructive text-xs">Tappad anslutning, försöker igen...</p>}
        </div>
      </div>
    );
  }

  if (session.gameState === "lobby") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Clock className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Väntar på att spelet ska börja</CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              Du är med som <span className="font-semibold text-foreground">{myPlayer?.name}</span>
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {session.players.length} spelare anslutna
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.gameState === "teams" && myTeam) {
    const teamMembers = session.players.filter((p: Player) => p.teamId === myTeam.id);
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: myTeam.color + "22" }}
            >
              <Users className="w-8 h-8" style={{ color: myTeam.color }} />
            </div>
            <CardTitle className="text-xl" style={{ color: myTeam.color }}>{myTeam.name}</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Ditt lag</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {teamMembers.map((p: Player) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-md"
                  style={{ backgroundColor: myTeam.color + "0D" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: myTeam.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{p.name}</span>
                  {p.id === playerId && (
                    <Badge variant="secondary" className="ml-auto">Du</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.gameState === "playing" && myTeam) {
    const isLocked = currentAnswer?.locked || false;
    const isPassed = currentAnswer?.passed || false;
    const hasUnlockedAndRelocked = currentAnswer?.unlockedAndRelocked || false;

    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div
          className="p-3 flex items-center justify-between gap-2 flex-wrap border-b"
          style={{ borderColor: myTeam.color + "33" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: myTeam.color }}
            />
            <span className="font-semibold text-sm" style={{ color: myTeam.color }}>{myTeam.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-sm">{myTeam.score}p</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Fråga {(session.currentBoardIndex || 0) + 1} av {session.boards.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Ledtråd {(session.currentClueIndex || 0) + 1} av 5
            </p>
          </div>

          {isLocked ? (
            <Card className="w-full max-w-sm text-center">
              <CardContent className="pt-6">
                <Lock className="w-10 h-10 mx-auto mb-3 text-primary" />
                <p className="font-semibold mb-1">Svar låst</p>
                <p className="text-lg font-bold text-primary mb-4">"{currentAnswer?.answer}"</p>
                {hasUnlockedAndRelocked && (
                  <p className="text-xs text-muted-foreground mb-3">Halverade poäng (bytt svar)</p>
                )}
                <Button
                  data-testid="button-unlock"
                  variant="outline"
                  onClick={() => {
                    send({ type: "unlock", teamId: myTeam.id });
                    setAnswer(currentAnswer?.answer || "");
                  }}
                  className="gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  Lås upp & ändra
                </Button>
              </CardContent>
            </Card>
          ) : isPassed ? (
            <Card className="w-full max-w-sm text-center">
              <CardContent className="pt-6">
                <SkipForward className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold">Ni har passat</p>
                <p className="text-sm text-muted-foreground mt-1">Väntar på nästa ledtråd...</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full max-w-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <Input
                    data-testid="input-answer"
                    placeholder="Skriv ert svar..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="text-center text-lg"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      data-testid="button-pass"
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => send({ type: "pass", teamId: myTeam.id })}
                    >
                      <SkipForward className="w-4 h-4" />
                      Passa
                    </Button>
                    <Button
                      data-testid="button-lock"
                      className="flex-1 gap-2"
                      disabled={!answer.trim()}
                      onClick={() => {
                        send({ type: "lock_answer", teamId: myTeam.id, answer: answer.trim() });
                      }}
                    >
                      <Lock className="w-4 h-4" />
                      Låsa
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (session.gameState === "revealing" && myTeam) {
    const result = currentAnswer;
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-6">
            {result?.correct === true ? (
              <>
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <p className="text-2xl font-bold text-green-500 mb-2">Rätt svar!</p>
              </>
            ) : result?.correct === false ? (
              <>
                <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
                <p className="text-2xl font-bold text-destructive mb-2">Fel svar</p>
              </>
            ) : (
              <>
                <SkipForward className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-2xl font-bold text-muted-foreground mb-2">Passade</p>
              </>
            )}
            <p className="text-muted-foreground text-sm">
              Ert svar: <span className="font-semibold">{result?.answer || "(inget)"}</span>
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5" style={{ color: myTeam.color }} />
              <span className="text-xl font-bold">{myTeam.score}p</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.gameState === "finished") {
    const sortedTeams = [...session.teams].sort((a, b) => b.score - a.score);
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Trophy className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
            <CardTitle className="text-2xl">Spelet är slut!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {sortedTeams.map((team, i) => (
                <div
                  key={team.id}
                  className="flex items-center gap-3 p-3 rounded-md"
                  style={{ backgroundColor: team.color + "15" }}
                >
                  <span className="text-lg font-bold w-6 text-center text-muted-foreground">
                    {i + 1}
                  </span>
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="font-semibold flex-1" style={{ color: team.color }}>{team.name}</span>
                  <span className="font-bold">{team.score}p</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6">
          <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Väntar på nästa steg...</p>
        </CardContent>
      </Card>
    </div>
  );
}
