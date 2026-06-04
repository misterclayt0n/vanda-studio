import { AuthStatus } from "./components/AuthStatus";
import { VandaCopilotSidebar } from "./components/VandaCopilotSidebar";

export default function Page() {
  return (
    <main className="operator-workbench">
      <section className="briefing-panel">
        <div className="brand-mark">V</div>
        <span className="eyebrow">Vanda operator POC</span>
        <h1>Social media management as a conversation.</h1>
        <p>
          This is the rewrite thesis in one screen: natural language becomes live Convex reads, Instagram performance
          context, and dynamic UI the agent renders on demand.
        </p>
        <AuthStatus />
        <div className="capability-grid">
          <article><b>01</b><span>Fetch latest synced Instagram posts</span></article>
          <article><b>02</b><span>Rank posts by engagement signals</span></article>
          <article><b>03</b><span>Render stat cards and quick charts in chat</span></article>
        </div>
      </section>
      <VandaCopilotSidebar />
    </main>
  );
}
