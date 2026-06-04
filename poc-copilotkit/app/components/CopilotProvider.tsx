"use client";

import { useAuth } from "@clerk/nextjs";
import { CopilotKit } from "@copilotkit/react-core/v2";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { vandaToolRenderers } from "./ToolCards";

export function CopilotProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [convexToken, setConvexToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshToken() {
      if (!isLoaded || !isSignedIn) {
        setConvexToken(null);
        return;
      }

      try {
        const token = await getToken({ template: "convex" });
        if (!cancelled) setConvexToken(token ?? null);
      } catch {
        if (!cancelled) setConvexToken(null);
      }
    }

    void refreshToken();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      headers={(): Record<string, string> => (convexToken ? { Authorization: `Bearer ${convexToken}` } : {})}
      renderToolCalls={vandaToolRenderers}
    >
      {children}
    </CopilotKit>
  );
}
