import "./bootstrap";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

// If a tab is still running an older deployment and requests a removed
// content-hashed chunk, refresh once to load the current entry point.
const preloadRecoveryKey = "hris-vite-preload-recovery";
if (import.meta.env.PROD && typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    try {
      if (window.sessionStorage.getItem(preloadRecoveryKey) === "1") {
        window.sessionStorage.removeItem(preloadRecoveryKey);
        return;
      }
      window.sessionStorage.setItem(preloadRecoveryKey, "1");
      window.location.reload();
    } catch {
      window.location.reload();
    }
  });
  window.setTimeout(() => {
    try { window.sessionStorage.removeItem(preloadRecoveryKey); } catch { /* Storage may be disabled. */ }
  }, 30_000);
}

createRoot(document.getElementById("root")!).render(<App />);
