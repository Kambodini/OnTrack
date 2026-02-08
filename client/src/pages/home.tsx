import { useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { setAdminToken } from "@/lib/gameStorage";

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    async function createSession() {
      try {
        const res = await apiRequest("POST", "/api/sessions");
        const data = await res.json();
        setAdminToken(data.id, data.adminToken);
        setLocation(`/${data.id}/admin`);
      } catch (e) {
        console.error("Failed to create session", e);
      }
    }
    createSession();
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Skapar spelsession...</p>
      </div>
    </div>
  );
}
