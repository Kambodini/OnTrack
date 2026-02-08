import { useParams, useLocation } from "wouter";
import { getPlayerId } from "@/lib/gameStorage";
import { useGameWebSocket } from "@/lib/useWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Users, Trophy, Clock, CheckCircle2, XCircle, Zap, Target, Info } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { CLUE_POINTS } from "@shared/schema";
import type { Team, Player, PlayerAnswer } from "@shared/schema";

function RulesCard() {
  return (
    <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="w-5 h-5 text-amber-500" />
          Spelregler
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p>Du svarar <span className="font-semibold">individuellt</span> men dina poäng bidrar till lagets totala poäng.</p>
        </div>
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Poäng per ledtråd:</p>
            <div className="flex gap-2 flex-wrap">
              {CLUE_POINTS.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {i + 1}: {p}p
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p>Lås ditt svar när du tror du vet! Ju tidigare du svarar rätt, desto fler poäng.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlayerPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId || "";
  const [, setLocation] = useLocation();
  const playerId = getPlayerId(sessionId);
  const { session, connected, send } = useGameWebSocket(sessionId, playerId);
  const [answer, setAnswer] = useState("");
  const [showRules, setShowRules] = useState(true);

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

  const myAnswer = useMemo((): PlayerAnswer | null => {
    if (!myPlayer || session?.currentBoardIndex === undefined) return null;
    return myPlayer.answers.find((a) => a.boardIndex === session.currentBoardIndex) || null;
  }, [myPlayer, session]);

  useEffect(() => {
    setAnswer("");
  }, [session?.currentBoardIndex]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Ansluter till spelet...</p>
          {!connected && <p className="text-red-400 text-xs">Tappad anslutning, försöker igen...</p>}
        </div>
      </div>
    );
  }

  if (session.gameState === "lobby") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              På Spåret
            </h1>
            <p className="text-white/60">Väntar på att spelet ska börja...</p>
          </div>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-white/80">
                  Du är med som <span className="font-bold text-amber-400">{myPlayer?.name}</span>
                </p>
                <p className="text-white/40 text-sm mt-1">{session.players.length} spelare anslutna</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (session.gameState === "teams" && myTeam) {
    const teamMembers = session.players.filter((p: Player) => p.teamId === myTeam.id);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="text-center pb-2">
              <div
                className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: myTeam.color + "33" }}
              >
                <Users className="w-10 h-10" style={{ color: myTeam.color }} />
              </div>
              <CardTitle className="text-2xl" style={{ color: myTeam.color }}>{myTeam.name}</CardTitle>
              <p className="text-white/50 text-sm mt-1">Ditt lag</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {teamMembers.map((p: Player) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-md"
                    style={{ backgroundColor: myTeam.color + "15" }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: myTeam.color }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-white">{p.name}</span>
                    {p.id === playerId && (
                      <Badge className="ml-auto bg-white/10 text-white/70">Du</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <RulesCard />
        </div>
      </div>
    );
  }

  if (session.gameState === "playing" && myTeam) {
    const isLocked = myAnswer?.locked || false;
    const currentCluePoints = CLUE_POINTS[session.currentClueIndex] || 2;

    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
        <div
          className="p-3 flex items-center justify-between gap-2 flex-wrap"
          style={{ backgroundColor: myTeam.color + "22", borderBottom: `2px solid ${myTeam.color}44` }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full" style={{ backgroundColor: myTeam.color }} />
            <span className="font-bold text-sm text-white" style={{ color: myTeam.color }}>{myTeam.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-white/60 text-xs">
              <span>{myPlayer?.name}</span>
              <span className="font-bold text-amber-400">{myPlayer?.score || 0}p</span>
            </div>
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm text-white">{myTeam.score}p</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <div className="text-center space-y-1">
            <p className="text-xs text-white/40 uppercase tracking-widest">
              Fråga {(session.currentBoardIndex || 0) + 1} av {session.boards.length}
            </p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs text-white/40">
                Ledtråd {(session.currentClueIndex || 0) + 1} av 5
              </p>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0">
                {currentCluePoints}p
              </Badge>
            </div>
          </div>

          {showRules && (
            <div className="w-full max-w-sm">
              <RulesCard />
              <Button
                variant="ghost"
                className="w-full mt-1 text-white/40 text-xs"
                onClick={() => setShowRules(false)}
              >
                Dölj regler
              </Button>
            </div>
          )}

          {isLocked ? (
            <Card className="w-full max-w-sm bg-white/5 border-emerald-500/30 text-center">
              <CardContent className="pt-6">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                  <Lock className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="font-semibold text-white mb-1">Ditt svar är låst</p>
                <p className="text-lg font-bold text-emerald-400 mb-4">"{myAnswer?.answer}"</p>
                <p className="text-white/40 text-xs">Väntar på att facit avslöjas...</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full max-w-sm bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <Input
                    data-testid="input-answer"
                    placeholder="Skriv ditt svar..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="text-center text-lg bg-white/10 border-white/20 text-white placeholder:text-white/30"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && answer.trim()) {
                        send({ type: "lock_answer", answer: answer.trim() });
                      }
                    }}
                  />
                  <Button
                    data-testid="button-lock"
                    disabled={!answer.trim()}
                    onClick={() => {
                      send({ type: "lock_answer", answer: answer.trim() });
                    }}
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0"
                  >
                    <Lock className="w-4 h-4" />
                    Lås svar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (session.gameState === "revealing" && myTeam) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
        <Card className="w-full max-w-sm text-center bg-white/5 border-white/10">
          <CardContent className="pt-6 space-y-4">
            {myAnswer?.correct === true ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-400">Rätt svar!</p>
                <p className="text-amber-400 font-bold text-lg">+{myAnswer.pointsAwarded}p</p>
              </>
            ) : myAnswer?.correct === false ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-red-400">Fel svar</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-white/10 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-white/40" />
                </div>
                <p className="text-2xl font-bold text-white/40">Inget svar</p>
              </>
            )}
            <div className="text-white/50 text-sm">
              {myAnswer?.answer ? (
                <p>Ditt svar: <span className="font-semibold text-white/70">"{myAnswer.answer}"</span></p>
              ) : (
                <p>Du lämnade inget svar</p>
              )}
            </div>
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="text-center">
                <p className="text-white/40 text-xs">Dina poäng</p>
                <p className="text-lg font-bold text-white">{myPlayer?.score || 0}p</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-xs" style={{ color: myTeam.color + "99" }}>Lagpoäng</p>
                <p className="text-lg font-bold" style={{ color: myTeam.color }}>{myTeam.score}p</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.gameState === "finished") {
    const sortedTeams = [...session.teams].sort((a, b) => b.score - a.score);
    const myRank = sortedTeams.findIndex((t) => t.id === myTeam?.id) + 1;
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Spelet är slut!
            </h2>
            {myTeam && (
              <p className="text-white/60">
                Ditt lag kom <span className="font-bold text-amber-400">#{myRank}</span> med <span className="font-bold text-white">{myTeam.score}p</span>
              </p>
            )}
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-4">
              <div className="flex flex-col gap-2">
                {sortedTeams.map((team, i) => (
                  <div
                    key={team.id}
                    className={`flex items-center gap-3 p-3 rounded-md ${
                      team.id === myTeam?.id ? "ring-1" : ""
                    }`}
                    style={{
                      backgroundColor: team.color + "15",
                      ...(team.id === myTeam?.id ? { ringColor: team.color } : {}),
                    }}
                  >
                    <span className="text-lg font-bold w-6 text-center text-white/40">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full" style={{ backgroundColor: team.color }} />
                    <span className="font-semibold flex-1 text-white" style={{ color: team.color }}>{team.name}</span>
                    <span className="font-bold text-white">{team.score}p</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {myPlayer && (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-4 text-center">
                <p className="text-white/50 text-xs mb-1">Dina totala poäng</p>
                <p className="text-2xl font-bold text-amber-400">{myPlayer.score}p</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
      <Card className="w-full max-w-md text-center bg-white/5 border-white/10">
        <CardContent className="pt-6">
          <Clock className="w-10 h-10 mx-auto mb-3 text-white/30" />
          <p className="text-white/50">Väntar på nästa steg...</p>
        </CardContent>
      </Card>
    </div>
  );
}
