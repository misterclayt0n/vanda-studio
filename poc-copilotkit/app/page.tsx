import { AuthStatus } from "./components/AuthStatus";
import { VandaCopilotSidebar } from "./components/VandaCopilotSidebar";

export default function Page() {
  return (
    <main className="operator-workbench" aria-label="Vanda social media operator POC">
      <header className="operator-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">V</div>
          <div>
            <span className="eyebrow">Vanda Operator POC</span>
            <h1>Social media command center</h1>
          </div>
        </div>
        <AuthStatus />
      </header>
      <VandaCopilotSidebar />
    </main>
  );
}
