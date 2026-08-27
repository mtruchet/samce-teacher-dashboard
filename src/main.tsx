import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Tipografía auto-hospedada: no depende de un servicio externo, funciona sin
// internet y no filtra la visita de cada docente a un tercero.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";

import "./styles/tokens.css";
import "./styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
