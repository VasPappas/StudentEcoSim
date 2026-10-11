import { MoonIcon, SunIcon } from "./lib/icons";
import { useTheme } from "./lib/theme";
import { MarketStage } from "./market/MarketStage";

export function App() {
  const [theme, toggleTheme] = useTheme();
  return (
    <div className="app">
      <header className="masthead">
        <p className="wordmark">StudentEcoSim</p>
        <div className="title">
          <h1>The bread market</h1>
          <p>Stage 1 of 7. One hundred buyers, one hundred sellers and a price that has to find its own level.</p>
        </div>
        <button type="button" className="quiet theme" onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to the paper look" : "Switch to the blackboard look"}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>
      <main>
        <MarketStage />
      </main>
      <footer className="colophon">
        <p>
          An agent-based economy for students. The people follow simple rules; the textbook diagram is drawn from what
          they do.
        </p>
      </footer>
    </div>
  );
}
