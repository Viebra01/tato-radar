import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";

const workspace = resolve("work");
await mkdir(workspace, { recursive: true });
const profile = await mkdtemp(join(workspace, "e2e-profile-"));
const extension = resolve("dist");
const errors = [];
const watchName = "CyberWatch E2E " + Date.now();
const browserChannel = process.env.CYBERWATCH_BROWSER || "chromium";
console.log("Navegador de teste", browserChannel);
let context;
function onPage(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|Refused to execute/.test(message.text())
    )
      errors.push(message.text());
  });
  return page;
}
async function launch() {
  const useDevTools = browserChannel === "chrome";
  context = await chromium.launchPersistentContext(profile, {
    channel: browserChannel,
    headless: true,
    viewport: { width: 1440, height: 960 },
    ignoreDefaultArgs: useDevTools ? ["--disable-extensions"] : undefined,
    args: useDevTools
      ? ["--enable-unsafe-extension-debugging"]
      : [
          "--disable-extensions-except=" + extension,
          "--load-extension=" + extension,
        ],
  });
  context.on("page", onPage);
  let id;
  if (useDevTools) {
    const devtools = await context.browser().newBrowserCDPSession();
    const installed = await devtools.send("Extensions.getExtensions");
    const prior = installed.extensions.find(
      (item) => resolve(item.path) === extension,
    );
    id =
      prior?.id ??
      (await devtools.send("Extensions.loadUnpacked", { path: extension })).id;
  }
  const match = (worker) =>
    id
      ? worker.url() === "chrome-extension://" + id + "/worker.js"
      : worker.url().endsWith("/worker.js");
  const worker =
    context.serviceWorkers().find(match) ??
    (await context.waitForEvent("serviceworker", {
      predicate: match,
      timeout: 25000,
    }));
  return {
    worker,
    origin: await worker.evaluate(() =>
      chrome.runtime.getURL("").replace(/\/$/, ""),
    ),
  };
}
async function check(page, locator) {
  await page
    .locator(locator)
    .first()
    .waitFor({ state: "visible", timeout: 45000 });
}
async function storage(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open("cyberwatch");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      const read = (store, method) =>
        new Promise((resolve, reject) => {
          const request = db.transaction(store).objectStore(store)[method]();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      return {
        health: await read("health", "getAll"),
        services: await read("services", "count"),
        incidents: await read("incidents", "count"),
      };
    } finally {
      db.close();
    }
  });
}
try {
  let { worker, origin } = await launch();
  const dashboard = await context.newPage();
  await dashboard.goto(origin + "/index.html");
  await check(dashboard, "h1");
  assert.equal(await dashboard.locator("h1").innerText(), "Visão geral");
  await dashboard
    .getByText("Microsoft Outlook", { exact: true })
    .first()
    .waitFor();
  const deadline = Date.now() + 65000;
  let data = await storage(dashboard);
  while (
    data.health.filter((row) => row.success).length < 12 &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    data = await storage(dashboard);
  }
  assert.ok(
    data.health.filter((row) => row.success).length >= 9,
    JSON.stringify(data.health),
  );
  assert.ok(data.services > 0);
  assert.ok(data.incidents > 0);
  await dashboard.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("cyberwatch");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    const base = {
      id: "e2e:br",
      keys: ["e2e:br"],
      read: 1,
      detected: now,
      checked: now,
      published: now,
      title: "GitHub service disruption in Brazil",
      summary: "Investigating impact.",
      organization: "GitHub",
      category: "DEGRADED",
      confirmation: "official",
      severity: "high",
      status: "active",
      timeline: [],
      transitions: [],
      evidence: {
        source: "github",
        name: "GitHub Status",
        url: "https://www.githubstatus.com/",
        trust: "official",
      },
    };
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("incidents", "readwrite");
        const store = tx.objectStore("incidents");
        store.put({ ...base, sources: [base.evidence] });
        store.put({
          ...base,
          id: "e2e:foreign",
          keys: ["e2e:foreign"],
          title: "Unrelated outage in Canada",
          organization: "Empresa estrangeira de teste",
          sources: [base.evidence],
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await dashboard.reload();
  await dashboard
    .getByRole("button", { name: /GitHub informa instabilidade/ })
    .first()
    .waitFor();
  assert.equal(
    await dashboard
      .getByRole("button", { name: /Empresa estrangeira de teste/ })
      .count(),
    0,
  );
  await dashboard.screenshot({
    path: join(workspace, browserChannel + "-dashboard.png"),
  });
  console.log(
    "Página completa com dados reais",
    data.incidents,
    "registros e",
    data.services,
    "componentes.",
  );
  await dashboard.getByRole("button", { name: "Ao vivo" }).click();
  await dashboard.locator(".event-row").first().click();
  await check(dashboard, "dialog[open] a");
  const evidence = await dashboard
    .locator("dialog[open] a")
    .first()
    .getAttribute("href");
  assert.match(evidence, /^https?:\/\//);
  await dashboard.keyboard.press("Escape");
  await dashboard.getByRole("button", { name: "Filtros", exact: true }).click();
  await dashboard
    .getByPlaceholder("Buscar incidente, empresa ou serviço…")
    .fill("codex-e2e-sem-registros-776131");
  await check(dashboard, ".event-list .empty");
  await dashboard.getByRole("button", { name: "Meus favoritos" }).click();
  await dashboard.getByLabel("Nome", { exact: true }).first().fill(watchName);
  await dashboard.getByRole("button", { name: "Adicionar favorito" }).click();
  await dashboard.getByText(watchName, { exact: true }).waitFor();
  await dashboard.getByRole("button", { name: "Configurações" }).click();
  await dashboard.getByLabel("Não perturbe").click();
  await dashboard.getByText("Preferências salvas.").waitFor();
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 390, height: 600 });
  await popup.goto(origin + "/popup.html");
  await check(popup, ".popup .event-row");
  await popup.screenshot({
    path: join(workspace, browserChannel + "-popup.png"),
  });
  const side = await context.newPage();
  await side.setViewportSize({ width: 340, height: 900 });
  await side.goto(origin + "/sidepanel.html");
  await check(side, ".side .event-row");
  await side
    .getByRole("region", { name: "Serviços acompanhados" })
    .getByText("Microsoft Outlook", { exact: true })
    .waitFor();
  assert.equal(
    await side.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const panelPath = await worker.evaluate(
    async () => (await chrome.sidePanel.getOptions({})).path,
  );
  assert.equal(panelPath, "sidepanel.html");
  await side.screenshot({
    path: join(workspace, browserChannel + "-sidepanel.png"),
  });
  console.log(
    "Popup, página do painel lateral e rota configurada no navegador verificados.",
  );
  await popup.evaluate(() => {
    const open = chrome.sidePanel.open.bind(chrome.sidePanel);
    chrome.sidePanel.open = async (options) => {
      try {
        await open(options);
        globalThis.cyberWatchE2ePanel = "ok";
      } catch (error) {
        globalThis.cyberWatchE2ePanel = String(error);
        throw error;
      }
    };
  });
  await popup.bringToFront();
  await popup.getByRole("button", { name: "Painel lateral" }).click();
  await popup.waitForFunction(
    () => globalThis.cyberWatchE2ePanel,
    {},
    { timeout: 10000 },
  );
  const panelResult = await popup.evaluate(() => globalThis.cyberWatchE2ePanel);
  assert.equal(panelResult, "ok");
  console.log("Pedido de abertura do painel aceito pela API nativa.");
  const probe = await worker.evaluate(async () => {
    const id = "e2e-test";
    try {
      const created = await chrome.notifications.create(id, {
        type: "basic",
        title: "CyberWatch E2E",
        message: "Teste automatizado em perfil temporário",
        iconUrl: chrome.runtime.getURL("icon-128.png"),
      });
      const listed = Object.hasOwn(await chrome.notifications.getAll(), id);
      await chrome.notifications.clear(id);
      return { created, listed };
    } catch (error) {
      return { error: String(error) };
    }
  });
  assert.equal(probe.created, "e2e-test", JSON.stringify(probe));
  assert.ok(probe.listed, JSON.stringify(probe));
  console.log("Criação e remoção de notificação verificadas pela API nativa.");
  const alarm = await worker.evaluate(() =>
    chrome.alarms.get("cyberwatch:sync"),
  );
  assert.equal(alarm.periodInMinutes, 1);
  await worker.evaluate(() => {
    globalThis.cyberWatchE2eMarker = true;
  });
  const internals = await context.newPage();
  await internals.goto("chrome://serviceworker-internals");
  const registration = internals
    .locator(".serviceworker-registration")
    .filter({ hasText: origin + "/" });
  await registration.locator('[data-command="stop"]').click();
  await registration
    .getByText("STOPPED", { exact: true })
    .waitFor({ timeout: 15000 });
  const badge = await dashboard.evaluate(() =>
    chrome.runtime.sendMessage({ type: "BADGE" }),
  );
  assert.equal(badge.ok, true);
  worker =
    context.serviceWorkers().find((item) => item.url().startsWith(origin)) ??
    worker;
  const restarted = await worker.evaluate(async () => ({
    marker: typeof globalThis.cyberWatchE2eMarker,
    alarm: !!(await chrome.alarms.get("cyberwatch:sync")),
  }));
  assert.deepEqual(restarted, { marker: "undefined", alarm: true });
  console.log(
    "Worker interrompido e reativado por mensagem. Agendamento preservado.",
  );
  await context.close();
  context = undefined;
  ({ origin } = await launch());
  const reopened = await context.newPage();
  await reopened.goto(origin + "/index.html#watch");
  await reopened.getByText(watchName, { exact: true }).waitFor();
  await reopened.getByRole("button", { name: "Configurações" }).click();
  assert.equal(await reopened.getByLabel("Não perturbe").isChecked(), true);
  assert.ok((await storage(reopened)).incidents >= data.incidents);
  assert.deepEqual(errors, []);
  console.log(
    "Reinicialização completa do navegador, preferências, histórico e watchlist verificados.",
  );
} finally {
  if (context) await context.close();
  if (process.env.CYBERWATCH_KEEP_PROFILE !== "1") {
    assert.equal(
      resolve(profile).startsWith(workspace + "\\") ||
        resolve(profile).startsWith(workspace + "/"),
      true,
    );
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 250,
    });
  }
}
