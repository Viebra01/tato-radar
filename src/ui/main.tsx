import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./style.css";
import "./tato.css";
import "./radar.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TatoDemo } from "./TatoDemo";
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    document.body.dataset.surface === "demo" ? <TatoDemo /> : <App />,
  );
