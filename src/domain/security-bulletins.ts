import type { Incident } from "./model";
import { monitoringSources } from "../providers/catalog";

export const securitySources = monitoringSources.filter(
  (source) => source.platform,
);

export function securityPlatform(event: Incident) {
  return securitySources.find((source) => source.id === event.evidence.source)
    ?.platform;
}

export function recentBulletins(records: Incident[], now: number) {
  return records
    .filter((event) => {
      const age = now - Date.parse(event.updated ?? event.published ?? "");
      return (
        event.status === "published" &&
        event.confirmation === "official" &&
        event.category === "SECURITY_ADVISORY" &&
        !!securityPlatform(event) &&
        age >= 0 &&
        age < 30 * 86400000
      );
    })
    .sort((a, b) =>
      (b.updated ?? b.published ?? "").localeCompare(
        a.updated ?? a.published ?? "",
      ),
    );
}

export function bulletinTitle(event: Incident) {
  if (securityPlatform(event) === "windows") {
    const products = [
      [/Win32k|Graphics Kernel/i, "Windows · componentes gráficos"],
      [/\bNTFS\b/i, "Windows · sistema de arquivos NTFS"],
      [/\bNTLM\b/i, "Windows · autenticação NTLM"],
      [/\biSCSI\b/i, "Windows · armazenamento iSCSI"],
      [/\bDNS\b/i, "Windows · DNS"],
      [/\bKernel\b/i, "Windows · kernel"],
    ] as const;
    const subject =
      products.find(([pattern]) => pattern.test(event.title))?.[1] ?? "Windows";
    return event.cve ? subject + " · " + event.cve : subject;
  }
  const [code] = event.title.match(/\bUSN-\d+-\d+\b/i) ?? [];
  const component = event.title
    .replace(/^USN-\d+-\d+:\s*/i, "")
    .replace(/\s+vulnerabilit(?:ies|y).*$/i, "")
    .replace(/^Linux kernel/i, "Kernel Linux")
    .replace(/\s+regression$/i, " · correção de regressão")
    .replace(/\s+security update$/i, " · atualização de segurança");
  return (component || "Pacotes do Ubuntu") + (code ? " · " + code : "");
}
