import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { getPlayerId, setPlayerId } from "@/lib/gameStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Users className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Gå med i spelet</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Skriv ditt namn för att gå med
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <Input
              data-testid="input-player-name"
              placeholder="Ditt namn..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              autoFocus
              className="text-center text-lg"
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <Button
              data-testid="button-join"
              type="submit"
              disabled={loading || !name.trim()}
              className="gap-2"
            >
              {loading ? "Ansluter..." : "Gå med"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
