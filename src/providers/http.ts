export class CollectionError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retry?: number,
  ) {
    super(message);
  }
}
type Options = {
  etag?: string;
  modified?: string;
  timeout?: number;
  method?: "HEAD" | "GET";
  probe?: boolean;
};
export async function request(
  url: string,
  options: Options = {},
  fetcher = fetch,
): Promise<{
  status: number;
  body: string;
  unchanged: boolean;
  etag?: string;
  modified?: string;
}> {
  const headers = new Headers();
  if (options.etag) headers.set("If-None-Match", options.etag);
  if (options.modified) headers.set("If-Modified-Since", options.modified);
  const signal = AbortSignal.timeout(options.timeout ?? 12000);
  try {
    const response = await fetcher(url, {
      headers,
      signal,
      method: options.method ?? "GET",
      credentials: "omit",
      redirect: options.probe ? "manual" : "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (options.probe) {
      if (!response.bodyUsed) await response.body?.cancel();
      if (response.status !== 429)
        return { status: response.status, body: "", unchanged: false };
    }
    const result = {
      status: response.status,
      body: "",
      unchanged: response.status === 304,
      etag: response.headers.get("etag") ?? undefined,
      modified: response.headers.get("last-modified") ?? undefined,
    };
    if (result.unchanged) return result;
    if (!response.ok) {
      const header = response.headers.get("retry-after");
      const retry = header
        ? /^\d+$/.test(header)
          ? Date.now() + Number(header) * 1000
          : Date.parse(header)
        : undefined;
      if (!response.bodyUsed) await response.body?.cancel();
      throw new CollectionError(
        "HTTP " + response.status,
        response.status,
        retry,
      );
    }
    const max = 6 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > max) {
      if (!response.bodyUsed) await response.body?.cancel();
      throw new CollectionError("Resposta excede 6 MiB");
    }
    if (!response.body) throw new CollectionError("Resposta sem corpo");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new CollectionError("Resposta excede 6 MiB");
      }
      result.body += decoder.decode(value, { stream: true });
    }
    result.body += decoder.decode();
    return result;
  } catch (error) {
    if (error instanceof CollectionError) throw error;
    throw new CollectionError(
      signal.aborted
        ? "Tempo limite excedido"
        : "Falha de rede, DNS, TLS ou redirecionamento bloqueado",
    );
  }
}
