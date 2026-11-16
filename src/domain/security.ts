import { decodeHTMLStrict } from "entities";
export function publicUrl(input: unknown): string | undefined {
  if (typeof input !== "string" || input.length > 2048) return;
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return;
    if (
      host.includes(":") ||
      /^\d+(\.\d+){3}$/.test(host) ||
      !host.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion|arpa)$/.test(
        host,
      ) ||
      !/\.[a-z][a-z\d-]*$/.test(host)
    )
      return;
    url.hostname = host;
    url.hash = "";
    return url.href;
  } catch {
    return;
  }
}
export function canonical(input: string): string {
  const safe = publicUrl(input);
  if (!safe) return "";
  const url = new URL(safe);
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.*|fbclid|gclid|ref)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href.replace(/\/$/, "");
}
export function plain(input: unknown, limit = 420): string {
  if (typeof input !== "string") return "";
  return (
    decodeHTMLStrict(decodeHTMLStrict(input.slice(0, 10000)))
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit)
  );
}
export function iso(input: unknown): string | undefined {
  if (typeof input !== "string") return;
  const value = Date.parse(input);
  if (Number.isFinite(value)) return new Date(value).toISOString();
}
export function permissionPattern(input: string): string {
  const safe = publicUrl(input);
  if (!safe)
    throw new Error(
      "Informe um endereço público HTTP ou HTTPS, sem credenciais, IP ou porta personalizada.",
    );
  return new URL(safe).origin + "/*";
}
