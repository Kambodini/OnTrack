import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { getPlayerId, setPlayerId } from "@/lib/gameStorage";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import { useEffect } from "react";

export default function JoinPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId || "";
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const existingPlayer = getPlayerId(sessionId);
    if (existingPlayer) {
      setLocation(`/${sessionId}/play`);
    } else {
      setChecking(false);
    }
  }, [sessionId, setLocation]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Skriv ditt namn");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/join`, { name: name.trim() });
      const data = await res.json();
      setPlayerId(sessionId, data.id);
      setLocation(`/${sessionId}/play`);
    } catch (e: any) {
      setError(e.message || "Kunde inte gå med i sessionen");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
            På Spåret
          </h1>
          <p className="text-white/50 text-sm">Gissa svaret från ledtrådarna!</p>
        </div>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Gå med i spelet</h2>
            <p className="text-white/40 text-sm mb-4">Skriv ditt namn för att gå med</p>
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <Input
                data-testid="input-player-name"
                placeholder="Ditt namn..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                autoFocus
                className="text-center text-lg bg-white/10 border-white/20 text-white placeholder:text-white/30"
              />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <Button
                data-testid="button-join"
                type="submit"
                disabled={loading || !name.trim()}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
              >
                {loading ? "Ansluter..." : "Gå med"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
