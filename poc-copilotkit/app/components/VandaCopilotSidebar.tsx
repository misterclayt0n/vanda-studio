"use client";

import { CopilotChat, useConfigureSuggestions } from "@copilotkit/react-core/v2";

function StarterSuggestions() {
  useConfigureSuggestions({
    suggestions: [
      { title: "Latest post", message: "Vanda, fetch my latest Instagram post" },
      { title: "Best post", message: "Vanda, what is my best performing post?" },
      { title: "Stats", message: "Vanda, summarize my current stats" },
      { title: "Next move", message: "Vanda, what should I post next based on what worked recently?" },
    ],
    available: "before-first-message",
  });

  return null;
}

export function VandaCopilotSidebar() {
  return (
    <section className="vanda-console dark">
      <div className="console-header">
        <div>
          <span className="eyebrow">Live agent workspace</span>
          <h2>Ask about posts, stats, and what worked.</h2>
        </div>
        <div className="console-live-dot">
          <span /> Convex tools wired
        </div>
      </div>
      <CopilotChat
        labels={{
          chatInputPlaceholder: "Ask about posts, stats, what worked...",
          welcomeMessageText:
            "I can read synced Instagram data from Convex and render the results here. Try one of the prompts below.",
        }}
      />
      <StarterSuggestions />
    </section>
  );
}
