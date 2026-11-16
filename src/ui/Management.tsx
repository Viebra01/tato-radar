import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  Database,
  Download,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { categories, type Health, type Incident } from "../domain/model";
import {
  matchingWatch,
  settingsSchema,
  getSettings,
  type Settings,
  type Monitor,
  type Watch,
} from "../domain/settings";
import { permissionPattern } from "../domain/security";
import { pending, monitoringSources as sources } from "../providers/catalog";

import { DateText } from "./shared";

async function write(patch: Partial<Settings>) {
  const before = await getSettings();
  const parsed = settingsSchema.safeParse({ ...before, ...patch });
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? "Configuração inválida.",
    );
  await chrome.storage.local.set({ settings: parsed.data });
}
function formData(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
const string = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const number = (data: FormData, key: string) => Number(data.get(key));
function showError(error: unknown) {
  return error instanceof Error ? error.message : "A operação falhou.";
}

export function Preferences({ settings }: { settings: Settings }) {
  const [message, setMessage] = useState("");
  const [incoming, setIncoming] = useState<Settings>();
  async function save(patch: Partial<Settings>) {
    try {
      await write(patch);
      setMessage("Preferências salvas.");
    } catch (error) {
      setMessage(showError(error));
    }
  }
  async function exportSettings() {
    try {
      const data = JSON.stringify(await getSettings(), null, 2);
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const link = Object.assign(document.createElement("a"), {
        href: url,
        download: "tato-radar-config.json",
      });
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(showError(error));
    }
  }
  async function importSettings(file: File) {
    try {
      setIncoming(undefined);
      if (file.size > 256000) throw new Error("O arquivo excede 256 kB.");
      const data = settingsSchema.parse(JSON.parse(await file.text()));
      setIncoming(data);
      setMessage(
        "Arquivo validado. Revise a quantidade de itens e confirme a importação.",
      );
    } catch (error) {
      setMessage(showError(error));
    }
  }
  return (
    <div className="stack">
      <section className="card padded">
        <div className="section-title flush">
          <h2>
            <Bell size={17} /> Notificações
          </h2>
        </div>
        <div className="options">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.notifyGlobal}
              onChange={(e) => void save({ notifyGlobal: e.target.checked })}
            />
            Notificar avisos de favoritos sem confirmação no Brasil
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => void save({ notifications: e.target.checked })}
            />{" "}
            Notificações nativas
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.dnd}
              onChange={(e) => void save({ dnd: e.target.checked })}
            />{" "}
            Não perturbe
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.favoritesOnly}
              onChange={(e) => void save({ favoritesOnly: e.target.checked })}
            />{" "}
            Notificar apenas favoritos
          </label>
          <button
            className="button"
            onClick={() =>
              void save({
                snooze: settings.snooze > Date.now() ? 0 : Date.now() + 3600000,
              })
            }
          >
            {settings.snooze > Date.now()
              ? "Cancelar silêncio até " +
                new Intl.DateTimeFormat("pt-BR", {
                  timeZone: settings.timeZone,
                  timeStyle: "short",
                }).format(settings.snooze)
              : "Silenciar por 1 h"}
          </button>
        </div>
        <div className="chips">
          {Object.entries(categories).map(([kind, label]) => (
            <label className="check pill" key={kind}>
              <input
                type="checkbox"
                checked={settings.alertCategories.some(
                  (value) => value === kind,
                )}
                onChange={(e) => {
                  const category = kind as keyof typeof categories;
                  void save({
                    alertCategories: e.target.checked
                      ? [...settings.alertCategories, category]
                      : settings.alertCategories.filter(
                          (value) => value !== category,
                        ),
                  });
                }}
              />
              {label}
            </label>
          ))}
        </div>
        <form
          className="form-grid"
          onSubmit={(e) => {
            const data = formData(e);
            void save({
              cooldown: number(data, "cooldown"),
              digest: number(data, "digest"),
              timeZone: string(data, "tz"),
            });
          }}
        >
          <label>
            Intervalo entre alertas (min)
            <input
              type="number"
              min="1"
              max="1440"
              name="cooldown"
              defaultValue={settings.cooldown}
              required
            />
          </label>
          <label>
            Resumo a cada (h, 0 desativa)
            <input
              type="number"
              min="0"
              max="168"
              name="digest"
              defaultValue={settings.digest}
              required
            />
          </label>
          <label>
            Fuso horário
            <input name="tz" defaultValue={settings.timeZone} required />
          </label>
          <button className="button primary">
            <Check size={16} />
            Salvar
          </button>
        </form>
      </section>
      <section className="card padded">
        <h2>Configuração local</h2>
        <p className="muted">
          A exportação inclui os endereços e palavras-chave cadastrados. A
          importação substitui as preferências atuais e reutiliza as permissões
          já concedidas.
        </p>
        <div className="actions">
          <button className="button" onClick={() => void exportSettings()}>
            <Download size={16} />
            Exportar JSON
          </button>
          <label className="file">
            Importar JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importSettings(file);
              }}
            />
          </label>
        </div>
        {incoming && (
          <div className="notice">
            <p>
              {incoming.watch.length} favoritos, {incoming.monitors.length}{" "}
              testes HTTP e {incoming.feeds.length} feeds.
            </p>
            <button
              className="button primary"
              onClick={() => {
                void save(incoming);
                setIncoming(undefined);
              }}
            >
              Confirmar importação
            </button>
          </div>
        )}
        <details>
          <summary>Privacidade</summary>
          <p className="muted">
            Incidentes, preferências e histórico de alertas ficam neste perfil.
            As coletas enviam requisições diretas às fontes públicas e aos
            endereços autorizados. A extensão usa respostas públicas sem cookies
            e não coleta histórico de navegação.
          </p>
        </details>
      </section>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </div>
  );
}
export function Watchlist({
  settings,
  records,
}: {
  settings: Settings;
  records: Incident[];
}) {
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Watch>();
  const [monitor, setMonitor] = useState<Monitor>();
  async function saveWatch(e: FormEvent<HTMLFormElement>) {
    const data = formData(e);
    const form = e.currentTarget;
    try {
      const item = {
        id: editing?.id ?? crypto.randomUUID(),
        name: string(data, "name"),
        kind: string(data, "kind") as Watch["kind"],
        keywords: string(data, "words")
          .split(",")
          .map((word) => word.trim())
          .filter(Boolean),
        priority: data.has("priority"),
        alerts: data.has("alerts"),
        categories: data.getAll("categories") as Watch["categories"],
      };
      await write({
        watch: [...settings.watch.filter((w) => w.id !== item.id), item],
      });
      form.reset();
      setEditing(undefined);
      setMessage("Favorito salvo.");
    } catch (error) {
      setMessage(showError(error));
    }
  }
  async function saveMonitor(e: FormEvent<HTMLFormElement>) {
    const data = formData(e);
    const form = e.currentTarget;
    try {
      const url = string(data, "url");
      if (!data.has("authorized"))
        throw new Error("Confirme a autorização do endereço.");
      if (
        !(await chrome.permissions.request({
          origins: [permissionPattern(url)],
        }))
      )
        throw new Error("O navegador não concedeu acesso ao domínio.");
      const item: Monitor = {
        id: monitor?.url === url ? monitor.id : crypto.randomUUID(),
        name: string(data, "name"),
        url,
        minutes: number(data, "minutes"),
        timeout: number(data, "timeout"),
        failures: number(data, "failures"),
        successes: number(data, "successes"),
        method: string(data, "method") as Monitor["method"],
        severity: string(data, "severity") as Monitor["severity"],
        mute: data.has("mute"),
        authorized: true,
      };
      await write({
        monitors: [
          ...settings.monitors.filter((m) => m.id !== monitor?.id),
          item,
        ],
      });
      form.reset();
      setMonitor(undefined);
      setMessage("Teste HTTP salvo.");
    } catch (error) {
      setMessage(showError(error));
    }
  }
  function remove(patch: Partial<Settings>) {
    void write(patch).catch((error) => setMessage(showError(error)));
  }
  return (
    <div className="stack">
      <section className="card padded">
        <h2>
          <Bookmark size={17} /> Favoritos
        </h2>
        <form
          className="form-grid"
          key={editing?.id ?? "new"}
          onSubmit={(e) => void saveWatch(e)}
        >
          <label>
            Nome
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={editing?.name}
            />
          </label>
          <label>
            Tipo
            <select name="kind" defaultValue={editing?.kind ?? "service"}>
              <option value="service">Serviço</option>
              <option value="company">Empresa</option>
              <option value="technology">Tecnologia</option>
              <option value="domain">Domínio</option>
            </select>
          </label>
          <label>
            Palavras-chave separadas por vírgula
            <input name="words" defaultValue={editing?.keywords.join(", ")} />
          </label>
          <label>
            Categorias (opcional)
            <select
              name="categories"
              multiple
              defaultValue={editing?.categories ?? []}
            >
              {Object.entries(categories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="priority"
              defaultChecked={editing?.priority ?? true}
            />{" "}
            Prioridade
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="alerts"
              defaultChecked={editing?.alerts ?? true}
            />{" "}
            Permitir alertas
          </label>
          <div className="actions">
            <button className="button primary">
              <Plus size={16} />
              {editing ? "Salvar edição" : "Adicionar favorito"}
            </button>
            {editing && (
              <button
                type="button"
                className="button"
                onClick={() => setEditing(undefined)}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        <div className="manage-list">
          {settings.watch.map((item) => {
            const linked = sources.find(
              (s) => s.organization?.toLowerCase() === item.name.toLowerCase(),
            );
            const count = records.filter(
              (event) => matchingWatch(event, [item]).length,
            ).length;
            return (
              <div key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {count} registros por termos ·{" "}
                    {linked ? linked.name : "Correspondência em publicações"}
                  </small>
                </div>
                <button
                  className="button"
                  onClick={() => setEditing(item)}
                  aria-label={"Editar " + item.name}
                >
                  Editar
                </button>
                <button
                  className="icon"
                  aria-label={"Remover " + item.name}
                  onClick={() =>
                    remove({
                      watch: settings.watch.filter((w) => w.id !== item.id),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="card padded">
        <h2>
          <Radio size={17} /> Testes HTTP autorizados
        </h2>
        <p className="muted">
          O teste mede acesso pela sua rede. Use um domínio público autorizado,
          com resposta direta, sem redirecionamentos.
        </p>
        <form
          className="form-grid"
          key={monitor?.id ?? "monitor"}
          onSubmit={(e) => void saveMonitor(e)}
        >
          <label>
            Nome
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={monitor?.name}
            />
          </label>
          <label>
            URL do serviço
            <input name="url" type="url" required defaultValue={monitor?.url} />
          </label>
          <label>
            Método
            <select name="method" defaultValue={monitor?.method ?? "HEAD"}>
              <option>HEAD</option>
              <option>GET</option>
            </select>
          </label>
          <label>
            Intervalo (min)
            <input
              name="minutes"
              type="number"
              min="2"
              max="1440"
              required
              defaultValue={monitor?.minutes ?? 5}
            />
          </label>
          <label>
            Timeout (s)
            <input
              name="timeout"
              type="number"
              min="2"
              max="20"
              required
              defaultValue={monitor?.timeout ?? 8}
            />
          </label>
          <label>
            Falhas consecutivas
            <input
              name="failures"
              type="number"
              min="2"
              max="10"
              required
              defaultValue={monitor?.failures ?? 3}
            />
          </label>
          <label>
            Sucessos para recuperação
            <input
              name="successes"
              type="number"
              min="2"
              max="10"
              required
              defaultValue={monitor?.successes ?? 2}
            />
          </label>
          <label>
            Severidade
            <select
              name="severity"
              defaultValue={monitor?.severity ?? "medium"}
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" name="mute" defaultChecked={monitor?.mute} />{" "}
            Silenciar alertas do teste
          </label>
          <label className="check">
            <input type="checkbox" name="authorized" required /> Confirmo que
            posso monitorar este endereço
          </label>
          <div className="actions">
            <button className="button primary">
              <Plus size={16} />
              {monitor ? "Salvar teste" : "Cadastrar teste"}
            </button>
            {monitor && (
              <button
                type="button"
                className="button"
                onClick={() => setMonitor(undefined)}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        <div className="manage-list">
          {settings.monitors.map((item) => (
            <div key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.method} · {item.minutes} min · {item.url}
                </small>
              </div>
              <button className="button" onClick={() => setMonitor(item)}>
                Editar / autorizar
              </button>
              <button
                className="icon"
                aria-label={"Remover " + item.name}
                onClick={() =>
                  remove({
                    monitors: settings.monitors.filter((m) => m.id !== item.id),
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </div>
  );
}
export function SourceList({
  settings,
  health,
  now,
}: {
  settings: Settings;
  health: Map<string, Health>;
  now: number;
}) {
  const [message, setMessage] = useState("");
  async function save(patch: Partial<Settings>) {
    try {
      await write(patch);
      setMessage("Configuração salva.");
    } catch (error) {
      setMessage(showError(error));
    }
  }
  async function addFeed(e: FormEvent<HTMLFormElement>) {
    const data = formData(e),
      form = e.currentTarget;
    try {
      const url = string(data, "url");
      if (
        !(await chrome.permissions.request({
          origins: [permissionPattern(url)],
        }))
      )
        throw new Error("O navegador não concedeu acesso ao domínio.");
      const name = string(data, "name");
      const existing = settings.feeds.find((feed) => feed.url === url);
      await write({
        feeds: [
          ...settings.feeds.filter((feed) => feed.id !== existing?.id),
          {
            id: existing?.id ?? crypto.randomUUID(),
            name,
            url,
            minutes: number(data, "minutes"),
          },
        ],
      });
      form.reset();
      setMessage("Feed salvo. A coleta começa no próximo ciclo.");
    } catch (error) {
      setMessage(showError(error));
    }
  }
  const all = [
    ...sources.map((source) => ({
      ...source,
      fixed: true,
      home: source.home,
      history: source.history,
    })),
    ...settings.feeds.map((feed) => ({
      ...feed,
      id: "feed-" + feed.id,
      home: feed.url,
      note: "Feed RSS/Atom personalizado.",
      kind: "rss",
      fixed: false,
      history: undefined,
    })),
    ...settings.monitors.map((item) => ({
      ...item,
      id: "http-" + item.id,
      home: item.url,
      note: "Sonda local " + item.method,
      kind: "http",
      fixed: false,
      history: undefined,
    })),
  ];
  return (
    <div className="stack">
      <div className="source-grid">
        {all.map((source) => {
          const row = health.get(source.id),
            history = health.get(source.id + "-history");
          const disabled = settings.disabled.includes(source.id);
          const minutes = Math.max(
            source.minutes,
            settings.intervals[source.id] ?? 0,
          );
          const age = row?.success
            ? Math.max(0, Math.floor((now - Date.parse(row.success)) / 60000))
            : undefined;
          const state = disabled
            ? "Pausada"
            : row?.error
              ? "Fonte indisponível"
              : age == null
                ? "Aguardando coleta"
                : age > Math.max(minutes * 3, 10)
                  ? "Desatualizada"
                  : row?.count === 0
                    ? "Sem registros"
                    : "Em dia";
          return (
            <article className="card padded source" key={source.id}>
              <div className="source-head">
                <Database size={17} />
                <span
                  className={
                    "pill " +
                    (state === "Em dia"
                      ? "mint"
                      : row?.error && !disabled
                        ? "amber"
                        : "")
                  }
                >
                  {state}
                </span>
                <a
                  href={source.home}
                  rel="noreferrer"
                  target="_blank"
                  aria-label={"Abrir " + source.name}
                >
                  <ArrowUpRight size={17} />
                </a>
              </div>
              <h2>{source.name}</h2>
              <p>{source.note}</p>
              <div className="muted">
                Método{" "}
                {source.kind === "http"
                  ? "HTTP"
                  : source.kind.includes("rss") ||
                      source.kind.includes("feed") ||
                      source.kind === "bulletin"
                    ? "RSS/Atom"
                    : "HTTPS JSON"}{" "}
                · {minutes} min
              </div>
              <dl>
                <div>
                  <dt>Última tentativa</dt>
                  <dd>
                    <DateText at={row?.attempted} zone={settings.timeZone} />
                  </dd>
                </div>
                <div>
                  <dt>Último sucesso</dt>
                  <dd>
                    <DateText at={row?.success} zone={settings.timeZone} />
                    {age != null && " · " + age + " min"}
                  </dd>
                </div>
                <div>
                  <dt>Data da origem</dt>
                  <dd>
                    <DateText
                      at={row?.originUpdated}
                      zone={settings.timeZone}
                    />
                  </dd>
                </div>
                {source.history && (
                  <div>
                    <dt>Histórico oficial</dt>
                    <dd>
                      {history?.error ?? (
                        <DateText
                          at={history?.success}
                          zone={settings.timeZone}
                        />
                      )}
                    </dd>
                  </div>
                )}
              </dl>
              {row?.error && (
                <p className="amber">
                  {row.error}
                  {row.next > now && (
                    <>
                      {" "}
                      · tentar após{" "}
                      <DateText at={row.next} zone={settings.timeZone} />
                    </>
                  )}
                </p>
              )}
              {row?.log?.length ? (
                <details>
                  <summary>Registros de coleta</summary>
                  {row.log.map((item) => (
                    <p key={item.at}>
                      <DateText at={item.at} zone={settings.timeZone} /> ·{" "}
                      {item.result}
                    </p>
                  ))}
                </details>
              ) : null}
              <div className="actions">
                <button
                  className="button"
                  onClick={() =>
                    void save({
                      disabled: disabled
                        ? settings.disabled.filter((id) => id !== source.id)
                        : [...settings.disabled, source.id],
                    })
                  }
                >
                  {disabled ? "Ativar" : "Pausar"}
                </button>
                {source.fixed ? (
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      const data = formData(e);
                      void save({
                        intervals: {
                          ...settings.intervals,
                          [source.id]: number(data, "minutes"),
                        },
                      });
                    }}
                  >
                    <input
                      aria-label={"Intervalo de " + source.name}
                      name="minutes"
                      type="number"
                      min={source.minutes}
                      max="1440"
                      defaultValue={minutes}
                      required
                    />
                    <button className="button">Salvar intervalo</button>
                  </form>
                ) : (
                  source.kind === "rss" && (
                    <>
                      <button
                        className="button"
                        onClick={() => {
                          void chrome.permissions
                            .request({
                              origins: [permissionPattern(source.url)],
                            })
                            .then((allowed) =>
                              setMessage(
                                allowed
                                  ? "Acesso concedido."
                                  : "Permissão recusada.",
                              ),
                            )
                            .catch((error) => setMessage(showError(error)));
                        }}
                      >
                        Autorizar
                      </button>
                      <button
                        className="icon"
                        aria-label={"Remover " + source.name}
                        onClick={() =>
                          void save({
                            feeds: settings.feeds.filter(
                              (feed) => "feed-" + feed.id !== source.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
      <section className="card padded">
        <h2>Adicionar feed RSS/Atom</h2>
        <form className="form-grid" onSubmit={(e) => void addFeed(e)}>
          <label>
            Nome
            <input name="name" maxLength={100} required />
          </label>
          <label>
            URL pública do feed
            <input name="url" type="url" required />
          </label>
          <label>
            Intervalo (min)
            <input
              name="minutes"
              type="number"
              min="10"
              max="1440"
              defaultValue="15"
              required
            />
          </label>
          <button className="button primary">
            <Plus size={16} />
            Autorizar e adicionar
          </button>
        </form>
      </section>
      <section className="card padded">
        <h2>Cobertura pendente</h2>
        <dl>
          {pending.map(([name, description]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
