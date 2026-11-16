import { useRef, useState } from "react";
import type { Incident, Category } from "../domain/model";
import {
  getSettings,
  settingsSchema,
  maxPinnedServices,
  serviceAlertModes,
  type Settings,
  type ServiceAlertMode,
} from "../domain/settings";
import { serviceChoices } from "../domain/favorite-services";
import { Preferences, Watchlist, SourceList } from "./Management";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../storage/db";
export function UserSettings({
  settings,
  records,
}: {
  settings: Settings;
  records: Incident[];
}) {
  const [query, setQuery] = useState(""),
    [alertServiceId, setAlertServiceId] = useState(""),
    [message, setMessage] = useState("");
  const health = useLiveQuery(() => db.health.toArray(), [], []);
  const services = serviceChoices(settings.watch);
  const pins = [...new Set(settings.pinnedServices)].filter((id) =>
    services.some((item) => item.id === id),
  );
  const alertService =
    services.find((item) => item.id === alertServiceId) ?? services[0];
  const pendingSave = useRef(Promise.resolve());
  function save(patch: Partial<Settings>) {
    pendingSave.current = pendingSave.current
      .then(async () => {
        await chrome.storage.local.set({
          settings: settingsSchema.parse({
            ...(await getSettings()),
            ...patch,
          }),
        });
        setMessage("Alteração salva.");
      })
      .catch(() => setMessage("Não foi possível salvar. Tente novamente."));
  }
  const groups: [string, string, Category[]][] = [
    [
      "Quedas e instabilidades",
      "Falhas observadas e comunicados oficiais de indisponibilidade.",
      ["OUTAGE", "DEGRADED"],
    ],
    [
      "Restabelecimentos",
      "Recuperação oficial ou acesso restabelecido pela sua rede.",
      ["RECOVERED"],
    ],
    [
      "Ataques e vazamentos confirmados",
      "Registros com evidência oficial ou verificável.",
      ["SECURITY_BREACH", "DATA_LEAK", "RANSOMWARE", "DDOS"],
    ],
    [
      "Notícias e relatos",
      "Publicações jornalísticas e suspeitas identificadas como relatos.",
      ["CYBER_NEWS", "SUSPECTED_BREACH"],
    ],
  ];
  return (
    <div className="user-settings">
      <section>
        <h2>Serviços na tela inicial</h2>
        <p className="muted">
          Escolha até quatro favoritos e a ordem em que aparecem.
        </p>
        <div className="pin-picker">
          {Array.from({ length: maxPinnedServices }, (_, index) => (
            <label key={index}>
              <span>Posição {index + 1}</span>
              <select
                aria-label={"Serviço fixado " + (index + 1)}
                value={pins[index] ?? ""}
                disabled={index > pins.length || !services.length}
                onChange={(event) => {
                  const next = [...pins];
                  const value = event.target.value;
                  const previous = next.indexOf(value);
                  if (!value) next.splice(index, 1);
                  else if (previous >= 0 && index === next.length) {
                    next.splice(previous, 1);
                    next.push(value);
                  } else {
                    if (previous >= 0) next[previous] = next[index];
                    next[index] = value;
                  }
                  void save({ pinnedServices: next });
                }}
              >
                <option value="">Sem serviço</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>
      <section>
        <h2>O que acompanhar</h2>
        <p>
          {settings.watch.filter((w) => w.priority).length} favoritos
          priorizados
        </p>
        <details className="favorite-picker">
          <summary>Buscar, adicionar ou editar favoritos</summary>
          <form
            className="toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              const name = query.trim();
              if (
                !name ||
                settings.watch.some(
                  (item) => item.name.toLowerCase() === name.toLowerCase(),
                )
              )
                return;
              void save({
                watch: [
                  ...settings.watch,
                  {
                    id: "custom-" + crypto.randomUUID(),
                    name,
                    kind: "service",
                    keywords: [name],
                    priority: true,
                    alerts: true,
                    categories: [],
                  },
                ],
              });
            }}
          >
            <input
              aria-label="Buscar favoritos"
              placeholder="Buscar serviço ou empresa…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              className="button"
              disabled={
                !query.trim() ||
                settings.watch.some(
                  (item) =>
                    item.name.toLowerCase() === query.trim().toLowerCase(),
                )
              }
            >
              Adicionar
            </button>
          </form>
          <div className="favorite-results">
            {settings.watch
              .filter((w) => w.name.toLowerCase().includes(query.toLowerCase()))
              .map((w) => (
                <label className="favorite-choice" key={w.id}>
                  <input
                    type="checkbox"
                    checked={w.priority}
                    onChange={(e) =>
                      void save({
                        watch: settings.watch.map((item) =>
                          item.id === w.id
                            ? { ...item, priority: e.target.checked }
                            : item,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={"Nome de " + w.name}
                    defaultValue={w.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== w.name)
                        void save({
                          watch: settings.watch.map((item) =>
                            item.id === w.id
                              ? { ...item, name: e.target.value.trim() }
                              : item,
                          ),
                        });
                    }}
                  />
                </label>
              ))}
          </div>
        </details>
      </section>
      <section>
        <h2>Quando me avisar</h2>
        {alertService && (
          <div className="favorite-alert-picker">
            <label>
              <span>Notificações de disponibilidade por favorito</span>
              <select
                aria-label="Favorito para configurar notificações"
                value={alertService.id}
                onChange={(event) => setAlertServiceId(event.target.value)}
              >
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Quando notificar</span>
              <select
                aria-label="Quando notificar este favorito"
                value={settings.serviceAlerts[alertService.id] ?? ""}
                onChange={(event) => {
                  const serviceAlerts = { ...settings.serviceAlerts };
                  if (event.target.value)
                    serviceAlerts[alertService.id] = event.target
                      .value as ServiceAlertMode;
                  else delete serviceAlerts[alertService.id];
                  void save({ serviceAlerts });
                }}
              >
                <option value="">Usar preferências gerais</option>
                {Object.entries(serviceAlertModes).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
            <small>
              As preferências gerais continuam valendo para o recorte e as
              categorias habilitadas.
            </small>
          </div>
        )}
        <label className="setting-choice">
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => void save({ notifications: e.target.checked })}
          />
          Ativar notificações
        </label>
        {groups.map(([label, help, categories]) => (
          <label className="setting-choice" key={label}>
            <input
              type="checkbox"
              checked={categories.some((c) =>
                settings.alertCategories.includes(c),
              )}
              onChange={(e) =>
                void save({
                  alertCategories: e.target.checked
                    ? [...new Set([...settings.alertCategories, ...categories])]
                    : settings.alertCategories.filter(
                        (c) => !categories.includes(c),
                      ),
                })
              }
            />
            <span>
              <strong>{label}</strong>
              <small>{help}</small>
            </span>
          </label>
        ))}
        <label className="setting-choice">
          <input
            type="checkbox"
            checked={settings.notifyGlobal}
            onChange={(e) => void save({ notifyGlobal: e.target.checked })}
          />
          Avisos de favoritos sem confirmação de impacto no Brasil
        </label>
        <label className="setting-choice">
          <input
            type="checkbox"
            checked={settings.dnd}
            onChange={(e) => void save({ dnd: e.target.checked })}
          />
          Não perturbe
        </label>
      </section>
      <p role="status">{message}</p>
      <details>
        <summary>Avançado</summary>
        <Preferences settings={settings} />
        <Watchlist settings={settings} records={records} />
        <SourceList
          settings={settings}
          health={new Map(health.map((h) => [h.id, h]))}
          now={Date.now()}
        />
      </details>
    </div>
  );
}
