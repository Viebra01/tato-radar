import { monitoringSources as sources } from "./providers/catalog.ts";
const hosts = [...new Set(sources.map((s) => new URL(s.url).origin + "/*"))];
export const manifest = {
  manifest_version: 3,
  name: "Tato Radar",
  version: "2.0.1",
  description:
    "Tem algo fora da toca? O Tato acompanha incidentes, serviços e novidades de segurança digital no Brasil.",
  minimum_chrome_version: "116",
  permissions: ["storage", "alarms", "notifications", "sidePanel"],
  host_permissions: hosts,
  optional_host_permissions: ["https://*/*", "http://*/*"],
  action: {
    default_popup: "popup.html",
    default_title: "Tato Radar · Tem algo fora da toca?",
    default_icon: "icon-32.png",
  },
  icons: {
    16: "icon-16.png",
    32: "icon-32.png",
    48: "icon-48.png",
    128: "icon-128.png",
  },
  background: { service_worker: "worker.js", type: "module" },
  side_panel: { default_path: "sidepanel.html" },
  options_ui: { page: "index.html#settings", open_in_tab: true },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'none'; base-uri 'none'",
  },
};
