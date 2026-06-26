import { createFileRoute } from "@tanstack/react-router";
import { StatusPill } from "@vanda-studio/ui/components/status-pill";
import { VandaMark } from "../components/vanda-mark";

export const Route = createFileRoute("/_dashboard/automatico")({
  // `welcome` is set once, right after onboarding, to show the handoff banner.
  validateSearch: (search: Record<string, unknown>): { welcome?: true } =>
    search.welcome === true || search.welcome === "true" ? { welcome: true } : {},
  component: AutomaticoPage,
});

function AutomaticoPage() {
  const { welcome } = Route.useSearch();
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {welcome ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-inset px-6 py-3">
          <StatusPill tone="done" dot>
            Pronto
          </StatusPill>
          <span className="text-[13px] text-text-2">A Vanda já está observando.</span>
          <span className="text-[13px] text-text-4">
            Você está no controle — ela só te chama quando precisar.
          </span>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <VandaMark size={44} />
        <h2 className="mt-5 text-[16px] font-medium text-text">
          A Vanda começou a observar seu Instagram.
        </h2>
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-[1.5] text-text-4">
          As primeiras ideias aparecem aqui em breve. Quando algo precisar de você, a Vanda te
          chama.
        </p>
      </div>
    </div>
  );
}
