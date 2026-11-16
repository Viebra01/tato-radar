export type Kind =
  | "statuspage"
  | "cloud"
  | "kev"
  | "nvd"
  | "rss"
  | "bulletin"
  | "statusfeed"
  | "microsoft-consumer";
export type Source = {
  id: string;
  name: string;
  home: string;
  url: string;
  kind: Kind;
  minutes: number;
  note: string;
  organization?: string;
  history?: string;
  language?: "pt-BR";
  platform?: "windows" | "ubuntu";
};
function statuspage(
  id: string,
  name: string,
  home: string,
  history = true,
): Source {
  return {
    id,
    name: name + " Status",
    organization: name,
    home,
    kind: "statuspage",
    minutes: 3,
    url: home + "/api/v2/summary.json",
    history: history ? home + "/api/v2/incidents.json" : undefined,
    note: history
      ? "Status agregado, componentes, manutenções anunciadas e histórico público."
      : "Compatibilidade pública com summary.json. Status agregado por componente.",
  };
}
export const sources: Source[] = [
  statuspage("github", "GitHub", "https://www.githubstatus.com"),
  statuspage("cloudflare", "Cloudflare", "https://www.cloudflarestatus.com"),
  statuspage("discord", "Discord", "https://discordstatus.com"),
  statuspage("openai", "OpenAI", "https://status.openai.com"),
  {
    id: "microsoft365",
    name: "Microsoft 365 · Comunicados públicos",
    organization: "Microsoft 365",
    home: "https://status.cloud.microsoft/",
    url: "https://status.cloud.microsoft/api/feed/mac",
    kind: "statusfeed",
    minutes: 5,
    note: "Comunicados públicos de incidentes amplos da Microsoft. O feed pode não publicar todos os incidentes do Exchange Online.",
  },
  {
    id: "microsoft-consumer",
    name: "Microsoft · Serviços pessoais",
    organization: "Microsoft",
    home: "https://status.cloud.microsoft/",
    url: "https://status.cloud.microsoft/api/posts/m365Consumer",
    kind: "microsoft-consumer",
    minutes: 5,
    note: "Dados da página pública da Microsoft para Outlook.com e outros serviços pessoais.",
  },
  {
    id: "gcloud",
    name: "Google Cloud Service Health",
    organization: "Google Cloud",
    home: "https://status.cloud.google.com/",
    url: "https://status.cloud.google.com/incidents.json",
    kind: "cloud",
    minutes: 3,
    note: "Incidentes públicos. Ausência de registro não indica operação normal.",
  },
  {
    id: "workspace",
    name: "Google Workspace Status",
    organization: "Google Workspace",
    home: "https://www.google.com/appsstatus/dashboard/",
    url: "https://www.google.com/appsstatus/dashboard/incidents.json",
    kind: "cloud",
    minutes: 3,
    note: "Histórico público do Workspace. Sem visibilidade específica por domínio.",
  },
  {
    id: "gitlab",
    name: "GitLab System Status",
    organization: "GitLab",
    home: "https://status.gitlab.com/",
    url: "https://status.gitlab.com/pages/5b36dc6502d06804c08349f7/rss",
    kind: "statusfeed",
    minutes: 5,
    note: "Avisos públicos do GitLab.com. Sem estados por componente pelo RSS.",
  },
  {
    id: "azure",
    name: "Azure Status",
    organization: "Azure",
    home: "https://azure.status.microsoft/en-us/status",
    url: "https://azure.status.microsoft/en-us/status/feed/",
    kind: "statusfeed",
    minutes: 5,
    note: "Comunicados públicos do RSS. Sem estado individual por recurso ou região.",
  },
  {
    id: "aws",
    name: "AWS Health",
    organization: "AWS",
    home: "https://health.aws.amazon.com/health/status",
    url: "https://status.aws.amazon.com/rss/all.rss",
    kind: "statusfeed",
    minutes: 5,
    note: "Avisos públicos via RSS. Sem eventos específicos da conta.",
  },
  {
    id: "kev",
    name: "CISA KEV",
    home: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    kind: "kev",
    minutes: 60,
    note: "Confirma exploração conhecida. A inclusão no catálogo tem data, mas não informa a data do ataque nem um CVSS.",
  },
  {
    id: "nvd",
    name: "NIST NVD",
    home: "https://nvd.nist.gov/developers/vulnerabilities",
    url: "https://services.nvd.nist.gov/rest/json/cves/2.0",
    kind: "nvd",
    minutes: 60,
    note: "Uma página de até 200 CVEs modificadas nas últimas 48 h, em ordem de publicação. Pode haver resultados adicionais. Publicação e CVSS não confirmam exploração.",
  },
  {
    id: "bc",
    name: "BleepingComputer",
    home: "https://www.bleepingcomputer.com/",
    url: "https://www.bleepingcomputer.com/feed/",
    kind: "rss",
    minutes: 10,
    note: "Manchetes e trechos do RSS editorial.",
  },
  {
    id: "sw",
    name: "SecurityWeek",
    home: "https://www.securityweek.com/",
    url: "https://www.securityweek.com/feed/",
    kind: "rss",
    minutes: 10,
    note: "Manchetes e trechos do RSS editorial.",
  },
  {
    id: "thn",
    name: "The Hacker News",
    home: "https://thehackernews.com/",
    url: "https://feeds.feedburner.com/TheHackersNews",
    kind: "rss",
    minutes: 10,
    note: "Feed editorial publicado via FeedBurner.",
  },
  {
    id: "record",
    name: "The Record",
    home: "https://therecord.media/",
    url: "https://therecord.media/feed",
    kind: "rss",
    minutes: 10,
    note: "Manchetes e trechos do RSS editorial.",
  },
  {
    id: "dr",
    name: "Dark Reading",
    home: "https://www.darkreading.com/",
    url: "https://www.darkreading.com/rss.xml",
    kind: "rss",
    minutes: 10,
    note: "Manchetes e trechos do RSS editorial.",
  },
  {
    id: "cisa-advisories",
    name: "CISA Advisories",
    home: "https://www.cisa.gov/cybersecurity-advisories",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    kind: "bulletin",
    minutes: 30,
    note: "Boletins oficiais. Um boletim não implica exploração ativa.",
  },
  {
    id: "msrc",
    name: "Microsoft Security Response Center",
    home: "https://msrc.microsoft.com/update-guide/",
    url: "https://api.msrc.microsoft.com/update-guide/rss",
    kind: "bulletin",
    platform: "windows",
    minutes: 60,
    note: "Boletins Microsoft cujo título identifica Windows, Win32k ou NTFS.",
  },
  {
    id: "ubuntu-usn",
    name: "Canonical · Ubuntu Security Notices",
    home: "https://ubuntu.com/security/notices",
    url: "https://ubuntu.com/security/notices/rss.xml",
    kind: "bulletin",
    platform: "ubuntu",
    minutes: 60,
    note: "Correções para pacotes oficiais do Ubuntu. Consulte a versão afetada no boletim.",
  },
  {
    id: "certbr",
    name: "CERT.br",
    home: "https://cert.br/",
    url: "https://cert.br/rss/certbr-rss.xml",
    kind: "bulletin",
    language: "pt-BR",
    minutes: 30,
    note: "Publicações do CERT.br. A origem brasileira não define o escopo geográfico do evento.",
  },
  {
    id: "tecnoblog",
    name: "Tecnoblog",
    home: "https://tecnoblog.net/",
    url: "https://tecnoblog.net/feed/",
    kind: "rss",
    language: "pt-BR",
    minutes: 10,
    note: "Notícias de tecnologia. O painel seleciona incidentes relevantes com vínculo ao Brasil.",
  },
  {
    id: "canaltech",
    name: "Canaltech",
    home: "https://canaltech.com.br/",
    url: "https://canaltech.com.br/rss/",
    kind: "rss",
    language: "pt-BR",
    minutes: 10,
    note: "Notícias de tecnologia. O painel seleciona incidentes relevantes com vínculo ao Brasil.",
  },
];
export const monitoringSources = sources.filter(
  (source) =>
    !!source.platform ||
    source.language === "pt-BR" ||
    source.id === "sw" ||
    ["statuspage", "cloud", "statusfeed", "microsoft-consumer"].includes(
      source.kind,
    ),
);
export const pending = [
  [
    "Microsoft 365 por conta",
    "A situação detalhada de uma conta corporativa ou escolar é consultada no centro de administração da Microsoft.",
  ],
  [
    "GitLab por componente",
    "O feed RSS está integrado. Os endpoints Statuspage testados retornaram HTTP 404.",
  ],
  ["CTIR Gov", "A rota RSS testada respondeu HTML."],
  [
    "SSW e Caixa",
    "Correspondência por termos na watchlist. A opção de teste HTTP exige um endereço público autorizado.",
  ],
];
