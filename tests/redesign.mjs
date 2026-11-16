import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, mkdtemp, copyFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { monitoringSources } from "../src/providers/catalog.ts";

const channel = process.env.CYBERWATCH_BROWSER || "chromium";
const clipOnly = process.env.CYBERWATCH_CLIP === "1";
await mkdir("work", { recursive: true });
const profile = await mkdtemp(
  resolve("work/tato-raster-test-" + channel + "-"),
);
const offline = ["--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND"];
const context = await chromium.launchPersistentContext(profile, {
  channel,
  headless: true,
  viewport: { width: 390, height: 850 },
  recordVideo: {
    dir: resolve("work/tato-raster-video"),
    size: { width: 390, height: 850 },
  },
  ignoreDefaultArgs:
    channel === "chrome" ? ["--disable-extensions"] : undefined,
  args:
    channel === "chrome"
      ? ["--enable-unsafe-extension-debugging", ...offline]
      : [
          "--disable-extensions-except=" + resolve("dist"),
          "--load-extension=" + resolve("dist"),
          ...offline,
        ],
});
const errors = [];
const storageChunk = (await readdir(resolve("dist/assets"))).find(
  (name) => name.startsWith("notification-copy") && name.endsWith(".js"),
);
let video;
context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  if (channel === "chrome") {
    const session = await context.browser().newBrowserCDPSession();
    const installed = await session.send("Extensions.getExtensions");
    if (!installed.extensions.some((e) => resolve(e.path) === resolve("dist")))
      await session.send("Extensions.loadUnpacked", { path: resolve("dist") });
  }
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const origin = worker.url().replace("/worker.js", "");
  const page = await context.newPage();
  video = page.video();
  await page.addInitScript(() => {
    globalThis.tatoRestPoses = [];
    new globalThis.MutationObserver((changes) => {
      for (const { target } of changes) {
        if (target.dataset?.rest) {
          globalThis.tatoRestPoses.push(target.dataset.rest);
        }
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-rest"],
    });
  });
  await page.goto(origin + "/popup.html");
  await page.evaluate(async () =>
    chrome.storage.local.set({
      settings: {
        notifications: false,
        dnd: true,
        staticTato: true,
        tatoBlinkWithReducedMotion: false,
        tatoStoryWithReducedMotion: false,
      },
    }),
  );
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ type: "SYNC" });
    await chrome.alarms.clearAll();
  });
  async function fixture(count, previousCount = 0) {
    await page.evaluate(
      async ({ count, previousCount, ids, chunk }) => {
        const exported = await import(
          new URL("assets/" + chunk, location.href).href
        );
        const database = Object.values(exported).find(
          (value) =>
            value &&
            value.name === "cyberwatch" &&
            value.incidents &&
            value.health,
        );
        if (!database) throw new Error("Armazenamento Dexie não encontrado");
        const at = new Date().toISOString();
        await database.transaction(
          "rw",
          database.incidents,
          database.health,
          async () => {
            await database.incidents.clear();
            await database.health.clear();
            for (const id of ids)
              await database.health.put({
                id,
                success: at,
                attempted: at,
                failures: 0,
                next: Date.now() + 86400000,
              });
            for (let i = 0; i < Math.max(count, previousCount); i++) {
              const recovery = i >= count;
              const evidence = {
                source: "github",
                name: "Demonstração · fonte fictícia",
                url: "https://example.org/cyberwatch-demo",
                trust: "official",
              };
              await database.incidents.put({
                id: "demo-" + i,
                keys: ["id:demo-" + i],
                title: recovery
                  ? "Demonstração: serviço restabelecido no Brasil"
                  : "Demonstração: serviço " +
                    (i + 1) +
                    " com instabilidade no Brasil",
                summary: "Exemplo fictício para apresentar a atuação do Tato.",
                language: "pt-BR",
                region: "BR",
                category: recovery ? "RECOVERED" : "OUTAGE",
                organization: "Serviço de exemplo " + (i + 1),
                status: recovery ? "resolved" : "active",
                severity: "high",
                confirmation: "official",
                evidence,
                sources: [evidence],
                detected: at,
                published: at,
                checked: at,
                resolved: recovery ? at : undefined,
                timeline: [],
                transitions: [],
                read: 1,
              });
            }
          },
        );
      },
      {
        count,
        previousCount,
        ids: monitoringSources.map((s) => s.id),
        chunk: storageChunk,
      },
    );
    await page.evaluate(() => {
      document.querySelector(".wordmark span").textContent =
        "Demonstração · dados fictícios";
    });
  }
  await fixture(0);
  await page.getByRole("heading", { name: "Radar atualizado" }).waitFor();
  assert.equal(await page.locator(".pinned-services .service-tile").count(), 4);
  await page.getByRole("button", { name: /^Outlook corporativo/ }).click();
  await page
    .getByRole("heading", { name: "Outlook corporativo", exact: true })
    .waitFor();
  await page.getByRole("heading", { name: "Relatos recentes" }).waitFor();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  assert.deepEqual(
    (await page.locator(".editorial > h2").allTextContents()).slice(0, 3),
    ["Alertas agora", "Notícias e relatos", "Avisos dos favoritos"],
  );
  await page
    .getByText(
      "Nenhum incidente em andamento confirmado pelas fontes consultadas.",
      {
        exact: true,
      },
    )
    .waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".tato")
        ?.getAttribute("src")
        ?.endsWith("master.webp"),
    {},
    { timeout: 20000 },
  );
  await page.screenshot({
    path: resolve("outputs/Popup-Tranquilo.png"),
    fullPage: true,
  });
  await page.waitForTimeout(600);
  await page.waitForFunction(() =>
    document
      .querySelector(".tato")
      ?.getAttribute("src")
      ?.endsWith("master.webp"),
  );
  const master = await page.locator(".tato").getAttribute("src");
  assert.match(master, /master.webp$/);
  await page.locator(".tato-eyelids").waitFor();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".tato-eyelids")).some(
      (layer) => Number(getComputedStyle(layer).opacity) > 0.65,
    ),
  );
  if (channel === "chromium" && !clipOnly) {
    await page.locator(".tato-eyelids").evaluate((layer) => {
      const blink = layer.getAnimations()[0];
      blink.pause();
      blink.currentTime = 540;
    });
    await page.waitForTimeout(100);
    await page.locator(".tato-stage").screenshot({
      path: resolve("work/tato-piscada.png"),
      animations: "allow",
    });
    await page.locator(".tato-eyelids").evaluate((layer) => {
      layer.getAnimations()[0].play();
    });
  }
  await page.waitForTimeout(1600);
  assert.equal(await page.locator(".tato").getAttribute("src"), master);
  await fixture(1);
  await page.waitForTimeout(1400);
  assert.equal(await page.locator(".tato").getAttribute("data-phase"), "aware");
  await fixture(3);
  await page.waitForFunction(
    () =>
      document
        .querySelector(".tato")
        ?.getAttribute("src")
        ?.endsWith("frame-07.webp"),
    {},
    { timeout: 15000 },
  );
  assert.match(
    await page.locator(".tato").getAttribute("src"),
    /frame-07.webp$/,
  );
  await fixture(5);
  await page.waitForFunction(
    () =>
      document.querySelector(".tato")?.getAttribute("data-phase") === "defense",
  );
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(150);
    if (channel === "chromium" && !clipOnly)
      await page.locator(".radar-summary").screenshot({
        path: resolve(
          "outputs/Transformacao-" + String(i).padStart(2, "0") + ".png",
        ),
      });
  }
  await page.waitForFunction(
    () =>
      document
        .querySelector(".tato")
        ?.getAttribute("src")
        ?.endsWith("frame-15.webp"),
    {},
    { timeout: 15000 },
  );
  assert.match(
    await page.locator(".tato").getAttribute("src"),
    /frame-15.webp$/,
  );
  if (clipOnly) {
    await page.waitForTimeout(1250);
  } else {
    await page.screenshot({
      path: resolve("outputs/Popup-Modo-Hacker.png"),
      fullPage: true,
    });
  }
  await fixture(3, 5);
  await page.waitForFunction(() =>
    document.querySelector(".tato")?.getAttribute("src")?.includes("recover-"),
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector(".tato")
        ?.getAttribute("src")
        ?.endsWith("frame-07.webp"),
    {},
    { timeout: 15000 },
  );
  assert.match(
    await page.locator(".tato").getAttribute("src"),
    /frame-07.webp$/,
  );
  await fixture(0, 5);
  await page
    .getByRole("heading", { name: "Restabelecidos", exact: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".tato")
        ?.getAttribute("src")
        ?.endsWith("master.webp"),
    {},
    { timeout: 15000 },
  );
  assert.match(await page.locator(".tato").getAttribute("src"), /master.webp$/);
  if (clipOnly) {
    await page.waitForTimeout(1700);
  } else {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await fixture(5);
    await page.waitForFunction(
      () =>
        document
          .querySelector(".tato")
          ?.getAttribute("src")
          ?.endsWith("frame-15.webp"),
      {},
      { timeout: 15000 },
    );
    assert.match(
      await page.locator(".tato").getAttribute("src"),
      /frame-15.webp$/,
    );
    await page.waitForTimeout(250);
    assert.match(
      await page.locator(".tato").getAttribute("src"),
      /frame-15.webp$/,
    );
    for (const surface of ["sidepanel", "index"]) {
      const p = await context.newPage();
      await p.setViewportSize({ width: 320, height: 850 });
      await p.goto(origin + "/" + surface + ".html");
      await p.getByRole("button", { name: "Serviços", exact: true }).click();
      await p.getByRole("region", { name: "Serviços acompanhados" }).waitFor();
      assert.ok(
        await p
          .getByText("Outlook corporativo", { exact: true })
          .first()
          .isVisible(),
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await p.getByRole("button", { name: "Histórico", exact: true }).click();
      await p.getByRole("heading", { name: "Histórico" }).waitFor();
      await p.locator(".event-row").first().click();
      await p.getByRole("link", { name: /Abrir fonte original/ }).waitFor();
    }
    const demo = await context.newPage();
    await demo.goto(origin + "/demo.html");
    await demo
      .getByRole("button", { name: "Modo Hacker", exact: true })
      .click();
    await demo.waitForFunction(
      () =>
        document
          .querySelector(".tato")
          ?.getAttribute("src")
          ?.endsWith("frame-15.webp"),
      {},
      { timeout: 15000 },
    );
    assert.match(
      await demo.locator(".tato").getAttribute("src"),
      /frame-15.webp$/,
    );
    const settingsPage = await context.newPage();
    await settingsPage.emulateMedia({ reducedMotion: "reduce" });
    await settingsPage.goto(origin + "/index.html#settings");
    await settingsPage
      .getByRole("heading", { name: "Quando me avisar" })
      .waitFor();
    assert.equal(
      await settingsPage
        .getByRole("checkbox", { name: /Animar o Tato|Permitir só a piscada/i })
        .count(),
      0,
    );
    await settingsPage
      .getByRole("combobox", { name: "Serviço fixado 1" })
      .selectOption("default-3");
    await settingsPage
      .getByRole("combobox", { name: "Favorito para configurar notificações" })
      .selectOption("default-3");
    await settingsPage
      .getByRole("combobox", { name: "Quando notificar este favorito" })
      .selectOption("outage");
    await settingsPage.waitForFunction(async () => {
      const { settings } = await chrome.storage.local.get("settings");
      return (
        settings?.pinnedServices?.[0] === "default-3" &&
        settings.serviceAlerts?.["default-3"] === "outage"
      );
    });
    await settingsPage
      .getByText("Buscar, adicionar ou editar favoritos")
      .click();
    await settingsPage
      .getByRole("textbox", { name: "Buscar favoritos" })
      .fill("Serviço da validação");
    await settingsPage
      .getByRole("button", { name: "Adicionar", exact: true })
      .click();
    await settingsPage.getByText("Alteração salva.", { exact: true }).waitFor();
    await settingsPage.reload();
    await settingsPage
      .getByText("Buscar, adicionar ou editar favoritos")
      .click();
    await settingsPage
      .getByRole("textbox", { name: "Buscar favoritos" })
      .fill("Serviço da validação");
    await settingsPage
      .getByRole("textbox", { name: "Nome de Serviço da validação" })
      .waitFor();
    const after = await page.evaluate(() =>
      chrome.storage.local.get("settings"),
    );
    assert.equal(after.settings.dnd, true);
    await page.reload();
    await page.setViewportSize({ width: 320, height: 600 });
    await page
      .getByRole("button", { name: /^GitHub/ })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: "Ver cobertura", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Cobertura", exact: true })
      .waitFor();
    assert.deepEqual(
      await page.locator(".coverage-screen h2").allTextContents(),
      [
        "O que não pôde ser verificado?",
        "O que é uma limitação normal?",
        "O que está em dia?",
      ],
    );
    assert.equal(await page.locator(".radar-summary, .source-grid").count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.getByRole("button", { name: "Voltar ao radar" }).click();
    await page
      .getByRole("button", { name: "Ver cobertura", exact: true })
      .waitFor();
    await fixture(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const consent = page.getByRole("button", {
      name: "Permitir piscada do Tato",
      exact: true,
    });
    await page.reload();
    await page.locator(".tato-eyelids").waitFor();
    assert.equal(await consent.count(), 0);
    await page.waitForFunction(
      () => {
        const eyelids = document.querySelector(".tato-eyelids");
        return (
          eyelids?.naturalWidth > 0 &&
          Number(getComputedStyle(eyelids).opacity) > 0.95
        );
      },
      {},
      { timeout: 2000 },
    );
    assert.equal(await page.locator(".tato-shell, .tato-glance").count(), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await fixture(0);
    await page.mouse.move(0, 0);
    await page.getByRole("heading", { name: "Radar atualizado" }).waitFor();
    const sleeping = page.locator('.tato-stage[data-rest="sleeping"]');
    await sleeping.waitFor({ timeout: 16000 });
    assert.deepEqual(
      await page.evaluate(() => globalThis.tatoRestPoses.slice(-3)),
      ["dozing", "nodding", "sleeping"],
    );
    const dream = sleeping.locator(".tato-dream > span");
    assert.equal(await dream.count(), 3);
    assert.deepEqual(
      await dream.evaluateAll((letters) =>
        letters.map((letter) => getComputedStyle(letter).animationDelay),
      ),
      ["0s", "0.5s", "1s"],
    );
    await page.screenshot({
      path: resolve("outputs/CyberWatch-1.10-Tato-cochilo.png"),
    });
    await sleeping.hover();
    await page
      .locator(
        '.tato-stage[data-rest="waking"], .tato-stage[data-rest="stretching"]',
      )
      .waitFor();
    await sleeping.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Boletins de segurança", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Atualizações de segurança", exact: true })
      .waitFor();
    await page
      .getByRole("img", { name: "Tato consultando boletins" })
      .waitFor();
    const ubuntu = page.getByRole("button", { name: "Ubuntu", exact: true });
    await ubuntu.click();
    assert.equal(await ubuntu.getAttribute("aria-pressed"), "true");
    await page
      .getByRole("searchbox", { name: "Buscar boletim" })
      .fill("ZX-TESTE-SEM-RESULTADOS");
    await page
      .getByText("Nenhum boletim encontrado para essa busca.", { exact: true })
      .waitFor();
    await page.getByRole("searchbox", { name: "Buscar boletim" }).clear();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(0, 0);
    assert.match(
      await page.locator(".tato").getAttribute("src"),
      /frame-15\.webp$/,
    );
    await page.getByText("Cobertura dos boletins", { exact: true }).click();
    await page
      .locator(".security-sources")
      .getByText(/Coleta em dia/)
      .first()
      .waitFor();
    const typing = page.locator(".tato-review-paw");
    await typing.waitFor();
    assert.equal(
      await typing.evaluate((paw) => getComputedStyle(paw).animationDuration),
      "6s",
    );
    await page.waitForFunction(() => {
      const paw = document.querySelector(".tato-review-paw");
      return (
        paw?.naturalWidth > 0 && Number(getComputedStyle(paw).opacity) > 0.85
      );
    });
    await page.waitForTimeout(7250);
    assert.equal(await page.locator(".tato-stage[data-rest]").count(), 0);
    await page.screenshot({
      path: resolve("outputs/CyberWatch-1.10-consulta.png"),
    });
    await page
      .getByRole("img", { name: "Tato consultando boletins" })
      .waitFor();
    await page.evaluate(() => {
      globalThis.tatoRestPoses.length = 0;
    });
    await page
      .getByRole("button", { name: "Voltar ao radar", exact: true })
      .click();
    await sleeping.waitFor({ timeout: 12000 });
    assert.deepEqual(await page.evaluate(() => globalThis.tatoRestPoses), [
      "dozing",
      "nodding",
      "sleeping",
    ]);
    assert.equal(
      await dream
        .first()
        .evaluate((letter) => getComputedStyle(letter).animationDuration),
      "3.2s",
    );
    assert.equal(
      await dream
        .first()
        .evaluate((letter) => getComputedStyle(letter).animationName),
      "tato-dream-quiet",
    );
    await sleeping.hover();
    await page
      .locator(
        '.tato-stage[data-rest="waking"], .tato-stage[data-rest="stretching"], .tato-stage[data-rest="settling"]',
      )
      .waitFor();
    assert.equal(
      (await page.evaluate(() => chrome.storage.local.get("settings"))).settings
        .notifications,
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "APROVADO",
      channel,
      "arte raster, capuz, recuperação, movimento reduzido, popup, painel 320px, detalhe e preferências.",
    );
  }
} finally {
  await context.close();
  if (video && channel === "chromium")
    await copyFile(
      await video.path(),
      resolve("outputs/CyberWatch-1.5-alerta-e-recuperacao.webm"),
    );
}
