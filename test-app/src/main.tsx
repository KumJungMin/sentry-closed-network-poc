import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { resolveInitialAppPath } from "./routing/routes.core";

const initialPath = resolveInitialAppPath(window.location.pathname);

if (initialPath !== window.location.pathname) {
  window.history.replaceState(
    window.history.state,
    "",
    `${initialPath}${window.location.search}${window.location.hash}`,
  );
}

async function renderApp() {
  const { default: App } = await import("./App");

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

void renderApp();
