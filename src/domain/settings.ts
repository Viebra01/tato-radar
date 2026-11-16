import { z } from "zod";
import { categories } from "./model";
import { publicUrl } from "./security";

export const categorySchema = z.enum(
  Object.keys(categories) as [
    keyof typeof categories,
    ...(keyof typeof categories)[],
  ],
);
const urlSchema = z.string().transform((value, context) => {
  const url = publicUrl(value);
  if (!url) {
    context.addIssue({ code: "custom", message: "URL pública inválida" });
    return z.NEVER;
  }
  return url;
});
const label = z.string().trim().min(1).max(100);
const minutes = (min: number, max: number) =>
  z.number().int().min(min).max(max);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const watchSchema = z.object({
  id,
  name: label,
  keywords: z.array(label).max(12),
  priority: z.boolean(),
  alerts: z.boolean(),
  categories: z.array(categorySchema).max(15).default([]),
  kind: z.enum(["service", "company", "technology", "domain"]),
});
export const monitorSchema = z.object({
  id,
  name: label,
  url: urlSchema,
  minutes: minutes(2, 1440),
  timeout: minutes(2, 20),
  failures: minutes(2, 10),
  successes: minutes(2, 10),
  method: z.enum(["HEAD", "GET"]),
  severity: z.enum(["low", "medium", "high"]),
  mute: z.boolean(),
  authorized: z.literal(true),
});
export const feedSchema = z.object({
  id,
  name: label,
  url: urlSchema,
  minutes: minutes(10, 1440),
});
export const serviceAlertModes = {
  outage: "Só quedas",
  recovery: "Quedas e restabelecimentos",
  changes: "Incluindo instabilidades",
  mute: "Sem notificações de disponibilidade",
} as const;
const serviceAlertModeSchema = z.enum([
  "outage",
  "recovery",
  "changes",
  "mute",
]);
export type ServiceAlertMode = z.infer<typeof serviceAlertModeSchema>;
export const maxPinnedServices = 4;
const defaultPins = [
  "essential-outlook",
  "essential-caixa",
  "essential-ssw",
  "default-5",
];
export const settingsSchema = z
  .object({
    watch: z.array(watchSchema).max(100),
    monitors: z.array(monitorSchema).max(20),
    feeds: z.array(feedSchema).max(20),
    disabled: z.array(id).max(100),
    intervals: z.record(id, minutes(1, 1440)).default({}),
    notifications: z.boolean(),
    dnd: z.boolean(),
    snooze: z.number().nonnegative(),
    cooldown: minutes(1, 1440),
    alertCategories: z.array(categorySchema).max(15),
    favoritesOnly: z.boolean(),
    notifyGlobal: z.boolean().default(false),
    pinnedServices: z.array(id).max(maxPinnedServices).default(defaultPins),
    serviceAlerts: z.record(id, serviceAlertModeSchema).default({}),
    digest: minutes(0, 168),
    timeZone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  })
  .superRefine((settings, ctx) => {
    const ids = [
      ...settings.watch,
      ...settings.monitors,
      ...settings.feeds,
    ].map((item) => item.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Há identificadores duplicados.",
      });
  });
export type Settings = z.infer<typeof settingsSchema>;
export type Monitor = z.infer<typeof monitorSchema>;
export type Watch = z.infer<typeof watchSchema>;
const defaultNames = [
  ["service", "Microsoft Outlook", "Outlook"],
  ["service", "Microsoft 365", "Office 365"],
  ["service", "Google Workspace"],
  ["service", "GitHub"],
  ["service", "Cloudflare"],
  ["service", "OpenAI", "ChatGPT"],
  ["service", "AWS", "Amazon Web Services"],
  ["service", "Azure"],
  ["company", "SSW Sistemas"],
  ["company", "Caixa Econômica Federal"],
  ["company", "Caixa Vida e Previdência"],
  ["technology", "Microsoft Windows", "Windows"],
  ["technology", "SQL Server"],
  ["technology", "Oracle Database"],
  ["technology", ".NET", "dotnet"],
  ["technology", "Chrome", "Chromium"],
  ["technology", "Edge", "Microsoft Edge"],
] as const;
export const defaults: Settings = {
  watch: defaultNames.map(([kind, name, ...keywords], index) => ({
    id: "default-" + index,
    kind,
    name,
    keywords,
    priority: true,
    alerts: true,
    categories: [],
  })),
  monitors: [],
  feeds: [],
  disabled: [],
  intervals: {},
  notifications: true,
  dnd: false,
  snooze: 0,
  cooldown: 15,
  alertCategories: [
    "OUTAGE",
    "DEGRADED",
    "RECOVERED",
    "ACTIVELY_EXPLOITED",
    "SECURITY_BREACH",
    "SECURITY_ADVISORY",
    "RANSOMWARE",
    "DATA_LEAK",
    "DDOS",
    "CYBER_NEWS",
  ],
  favoritesOnly: false,
  notifyGlobal: false,
  pinnedServices: defaultPins,
  serviceAlerts: {},
  digest: 0,
  timeZone: "America/Sao_Paulo",
};
export function matchingWatch(
  event: {
    title: string;
    summary?: string;
    organization?: string;
    service?: string;
    category?: keyof typeof categories;
  },
  watch: Watch[],
): Watch[] {
  const haystack = [
    event.title,
    event.summary,
    event.organization,
    event.service,
  ]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  return watch.filter(
    (item) =>
      (!item.categories.length ||
        (event.category && item.categories.includes(event.category))) &&
      [item.name, ...item.keywords].some((term) => {
        const literal = term
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(
          "(?:^|[^\\p{L}\\p{N}])" + literal + "(?:$|[^\\p{L}\\p{N}])",
          "u",
        ).test(haystack);
      }),
  );
}
export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  const parsed = settingsSchema.safeParse({ ...defaults, ...(settings ?? {}) });
  return parsed.success ? parsed.data : defaults;
}
