import type { Incident } from "../domain/model";
import { plain } from "../domain/security";
import { isRestored } from "../domain/favorite-services";

const reports = {
  SECURITY_BREACH: "acesso não autorizado",
  SUSPECTED_BREACH: "suspeita de invasão",
  DATA_LEAK: "vazamento de dados",
  RANSOMWARE: "ransomware",
  DDOS: "ataque DDoS",
} as const;

const servicePhase: Record<string, string> = {
  investigating: "O fornecedor está investigando.",
  identified: "O fornecedor identificou a causa.",
  monitoring: "O fornecedor monitora o efeito da correção.",
  in_progress: "A manutenção está em andamento.",
  verifying: "O fornecedor verifica o resultado da intervenção.",
};

const severityText = {
  critical: "crítica",
  high: "de severidade alta",
  medium: "de severidade média",
  low: "de severidade baixa",
  unknown: "publicada",
} as const;

const componentNames: Record<string, string> = {
  "git operations": "operações do Git",
  "api requests": "requisições à API",
  "pull requests": "pull requests",
  issues: "issues",
};

export function serviceScope(incident: Incident) {
  if (incident.service) {
    return incident.service
      .split(", ")
      .map((service) => componentNames[service.toLowerCase()] ?? service)
      .join(", ");
  }
  if (/\bsign.in and sign.up\b|\blogins?, sign.ups\b/i.test(incident.title)) {
    return "login e cadastro";
  }
  if (/\bsign.in\b|\blogins?\b/i.test(incident.title)) return "login";
  if (/\bwebhooks?\b/i.test(incident.title)) return "webhooks";
  return "";
}

function shortened(value: string, limit: number) {
  if (value.length <= limit) return value;
  const prefix = value.slice(0, limit - 1).trimEnd();
  const space = prefix.lastIndexOf(" ");
  return (space > limit * 0.65 ? prefix.slice(0, space) : prefix) + "…";
}

function editorialTopic(incident: Incident) {
  if (incident.category in reports)
    return reports[incident.category as keyof typeof reports];
  const headline = incident.title;
  if (/\bphishing\b/i.test(headline)) return "phishing";
  if (/\bmalware\b/i.test(headline)) return "malware";
  if (/\b(?:credential theft|steal\w* credentials)\b/i.test(headline))
    return "roubo de credenciais";
  if (/\b(?:vulnerabilit\w*|zero.day|security flaw)\b/i.test(headline))
    return "vulnerabilidade de segurança";
  if (/\b(?:security update|security patch|patches)\b/i.test(headline))
    return "correção de segurança";
  return "segurança digital";
}

export function formatNotification(incident: Incident, favorite?: string) {
  const source = shortened(incident.evidence.name, 42);
  const org = shortened(incident.organization ?? "", 50);
  const service = shortened(
    ["OUTAGE", "DEGRADED", "RECOVERED", "MAINTENANCE"].includes(
      incident.category,
    )
      ? serviceScope(incident)
      : (incident.service ?? ""),
    58,
  );
  const target = org || service || source;
  const scope = service && service !== org ? " em " + service : "";
  const related = favorite
    ? " Relacionado a " + shortened(favorite, 42) + "."
    : "";
  const phase = servicePhase[incident.raw?.status ?? ""];
  const copy = (title: string, message: string) => ({
    title: "CyberWatch | " + shortened(title, 76),
    message: shortened(message, 180),
  });

  if (isRestored(incident))
    return copy(
      "Restabelecido · " + target,
      incident.evidence.trust === "local" ||
        incident.confirmation === "observed"
        ? "Acesso restabelecido na sua rede."
        : "A fonte informou a recuperação" + scope + ".",
    );
  if (incident.language === "pt-BR") {
    return copy(
      plain(incident.title, 250),
      plain(incident.summary) || "Publicado por " + source + ".",
    );
  }

  if (incident.category === "OUTAGE" || incident.category === "DEGRADED") {
    if (incident.confirmation === "reported") {
      const kind =
        incident.category === "OUTAGE" ? "indisponibilidade" : "instabilidade";
      return copy(
        "Relato de " + kind + scope,
        "Publicado por " + source + "." + related,
      );
    }
    if (incident.confirmation === "observed") {
      const response = incident.raw?.response;
      return copy(
        "Possível indisponibilidade · " + target,
        "Testes HTTP consecutivos falharam na sua rede." +
          (response ? " Retorno do teste — " + response + "." : ""),
      );
    }
    const outage = incident.category === "OUTAGE";
    return copy(
      target +
        (outage ? " informa indisponibilidade" : " informa instabilidade"),
      (scope ? "Impacto relatado" + scope + ". " : "") +
        (phase ?? "Consulte o comunicado do fornecedor.") +
        " Comunicado de " +
        source +
        ".",
    );
  }

  if (incident.category === "ACTIVELY_EXPLOITED") {
    const product =
      service && org && service !== org
        ? service + " (" + org + ")"
        : service || org;
    return copy(
      (incident.cve ?? "Vulnerabilidade") + " com exploração confirmada",
      "A CISA registrou exploração conhecida" +
        (product ? " em " + product : "") +
        " no catálogo KEV.",
    );
  }

  if (incident.category === "VULNERABILITY") {
    const score = incident.raw?.cvss;
    return copy(
      "Vulnerabilidade " +
        severityText[incident.severity] +
        (incident.cve ? " · " + incident.cve : ""),
      "Registro publicado por " +
        source +
        "." +
        (score && /^\d+(?:\.\d+)?$/.test(score)
          ? " Pontuação CVSS " + score.replace(".", ",") + "."
          : "") +
        related,
    );
  }

  if (incident.category === "SECURITY_ADVISORY") {
    const cves = [
      ...new Set(
        [
          incident.cve,
          ...([incident.title, incident.summary]
            .join(" ")
            .match(/\bCVE-\d{4}-\d{4,}\b/g) ?? []),
        ].filter(Boolean),
      ),
    ];
    return copy(
      "Boletim de segurança · " + source,
      (cves.length
        ? "Boletim sobre " + cves.slice(0, 3).join(", ") + "."
        : "Boletim oficial com detalhes e orientações de segurança.") + related,
    );
  }

  if (incident.category === "MAINTENANCE") {
    return copy(
      "Manutenção · " + target,
      (scope ? "Manutenção anunciada" + scope + ". " : "") +
        (phase ?? "Manutenção programada pelo fornecedor.") +
        " Comunicado de " +
        source +
        ".",
    );
  }
  if (incident.category === "SERVICE_NOTICE") {
    return copy(
      "Comunicado de serviço · " + target,
      "Aviso publicado por " + source + "." + related,
    );
  }
  if (
    incident.category === "SECURITY_BREACH" &&
    incident.confirmation === "official"
  ) {
    return copy(
      "Invasão confirmada · " + target,
      "Comunicado oficial confirma acesso não autorizado" +
        scope +
        ". Publicado por " +
        source +
        ".",
    );
  }

  const topic = editorialTopic(incident);
  const kind =
    incident.confirmation === "reported" ? "Reportagem" : "Publicação";
  return copy(
    kind + " sobre " + topic,
    kind +
      " publicada por " +
      source +
      "." +
      (org ? " A publicação cita " + org + "." : related),
  );
}
