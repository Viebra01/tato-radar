export const categories = {
  SERVICE_NOTICE: "Comunicado de serviço",
  OUTAGE: "Indisponibilidade",
  DEGRADED: "Degradação",
  RECOVERED: "Recuperação",
  SECURITY_BREACH: "Invasão confirmada",
  SUSPECTED_BREACH: "Suspeita de comprometimento",
  DATA_LEAK: "Vazamento de dados",
  RANSOMWARE: "Ransomware",
  DDOS: "DDoS",
  VULNERABILITY: "Vulnerabilidade",
  ACTIVELY_EXPLOITED: "Exploração confirmada",
  SECURITY_ADVISORY: "Alerta de segurança",
  CYBER_NEWS: "Notícia",
  MAINTENANCE: "Manutenção",
} as const;
export type Category = keyof typeof categories;
export type Severity = "critical" | "high" | "medium" | "low" | "unknown";
export type Confirmation =
  | "official"
  | "observed"
  | "reported"
  | "unconfirmed"
  | "corroborated"
  | "contested";
export type Status = "active" | "resolved" | "published" | "planned";
export const states = {
  UNKNOWN: "Desconhecido",
  OPERATIONAL: "Operacional",
  DEGRADED: "Degradado",
  SUSPECTED_OUTAGE: "Possível indisponibilidade",
  OUTAGE_CONFIRMED: "Indisponibilidade oficial",
  RECOVERING: "Em recuperação",
  RECOVERED: "Recuperação observada",
  MAINTENANCE: "Manutenção",
} as const;
export type Availability = keyof typeof states;
export type Evidence = {
  source: string;
  name: string;
  url: string;
  trust: "official" | "editorial" | "local" | "custom";
};
export type Update = { at: string; text: string; status?: Status };
export type Event = {
  id: string;
  title: string;
  summary: string;
  category: Category;
  related?: Category[];
  organization?: string;
  service?: string;
  region?: string;
  language?: "pt-BR";
  locations?: string[];
  cve?: string;
  severity: Severity;
  confirmation: Confirmation;
  status: Status;
  availability?: Availability;
  occurred?: string;
  published?: string;
  publishedPrecision?: "day";
  updated?: string;
  resolved?: string;
  durationMs?: number;
  evidence: Evidence;
  timeline: Update[];
  raw?: Record<string, string>;
};
export type Incident = Event & {
  keys: string[];
  sources: Evidence[];
  detected: string;
  checked: string;
  read: 0 | 1;
  transitions: { at: string; from: Status; to: Status }[];
};
export type Service = {
  id: string;
  source: string;
  name: string;
  organization: string;
  state: Availability;
  checked: string;
  url: string;
  detail?: string;
  history?: { at: string; state: Availability }[];
};
export type Health = {
  eventIds?: string[];
  parserVersion?: number;
  id: string;
  attempted?: string;
  success?: string;
  originUpdated?: string;
  failures: number;
  next: number;
  error?: string;
  etag?: string;
  modified?: string;
  count?: number;
  log?: { at: string; result: string }[];
};
export type Snapshot = {
  events: Event[];
  services?: Service[];
  originUpdated?: string;
};
export type Probe = {
  state: Availability;
  failures: number;
  successes: number;
  since?: string;
  outageId?: string;
};
