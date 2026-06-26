import { useState } from "react";
import { useAction } from "convex/react";
import { Instagram } from "lucide-react";
import { Button } from "@vanda-studio/ui/components/button";
import { api } from "../../convex/_generated/api";
import { getInstagramRedirectUri } from "../../instagramRedirect";
import { OnboardingSplit } from "./onboarding-shell";

/**
 * Step 1 — the only hard requirement. Connecting Instagram is a full-page OAuth
 * round-trip (getConnectUrl -> instagram.com -> /api/.../callback -> back to
 * /onboarding), so this step just kicks it off; the wizard resumes at Observing
 * once the account exists.
 */
export function ConnectStep() {
  const getConnectUrl = useAction(api.instagramGraphActions.getConnectUrl);
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");

  async function connect() {
    setStatus("connecting");
    try {
      const { url } = await getConnectUrl({ redirectUri: getInstagramRedirectUri() });
      window.location.href = url;
    } catch {
      setStatus("error");
    }
  }

  return (
    <OnboardingSplit
      current="conectar"
      aperture={{ caption: "A orquídea como lente", sub: "Sempre no melhor momento de publicar" }}
    >
      <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.03em]">
        Sua agência de marketing,
        <br />
        no automático.
      </h1>
      <p className="mt-3 text-[14.5px] leading-[1.55] text-text-3">
        Conecte seu Instagram — a Vanda lê sua conta e já começa a entender seu negócio.
      </p>

      <Button
        variant="brand"
        size="xl"
        className="mt-7 w-full"
        disabled={status === "connecting"}
        onClick={connect}
      >
        <Instagram />
        {status === "connecting" ? "Conectando…" : "Conectar Instagram"}
      </Button>

      {status === "error" ? (
        <p className="mt-3 text-[13px] text-amber">
          Não consegui conectar.{" "}
          <button type="button" className="underline underline-offset-2" onClick={connect}>
            Tentar de novo
          </button>
        </p>
      ) : (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-5">
          Conexão segura · você controla tudo
        </p>
      )}
    </OnboardingSplit>
  );
}
