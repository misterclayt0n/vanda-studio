"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

export function VandaCopilotSidebar() {
  return (
    <section className="vanda-console">
      <div className="console-header">
        <div>
          <span className="eyebrow">Live operator console</span>
          <h2>Ask Vanda</h2>
        </div>
        <div className="console-live-dot"><span /> Convex live</div>
      </div>
      <CopilotChat
        labels={{
          chatInputPlaceholder: "Ask about posts, stats, what worked…",
          welcomeMessageText:
            "I can read your synced Instagram data from Convex. Try: ‘what post hit hardest?’ or ‘summarize my current stats’.",
        }}
      />
    </section>
  );
}
