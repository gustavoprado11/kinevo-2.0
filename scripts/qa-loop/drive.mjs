// CDP driver: one login, then capture each route's screenshot + console errors.
// Usage: node drive.mjs '<jsonAccount>' [baseUrl]
// Emits manifest JSON to stdout and PNGs to ./shots/.
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(__dirname, "shots");
mkdirSync(SHOTS, { recursive: true });

const account = JSON.parse(process.argv[2]);
const BASE = process.argv[3] || "http://localhost:3000";

// Trainer-side surfaces worth a visual smoke. Extend freely.
// `intent` = ground-truth do que a tela É e comportamentos INTENCIONAIS conhecidos.
// É o maior alavancador de precisão do loop: sem isso o analisador inventa
// "melhorias" genéricas e re-reporta design intencional como regressão.
const ROUTES = [
  {
    key: "dashboard",
    path: "/dashboard",
    intent:
      "Visão geral do treinador: KPIs (alunos, receita, treinos), widget 'Primeiros Passos' (onboarding) e banners do topo. BY DESIGN: KPIs em 0 são estado inicial de conta nova (não é erro); banners de onboarding podem aparecer pra conta nova.",
  },
  {
    key: "students",
    path: "/students",
    intent:
      "Lista de alunos do treinador. BY DESIGN: a própria conta do treinador aparece na lista com badge 'Eu' (suporte a auto-treino, is_trainer_profile) e é EXCLUÍDA dos contadores — divergência contador×linhas é intencional. Células '—'/'Nunca' = aluno sem atividade ainda.",
  },
  {
    key: "programs",
    path: "/programs",
    intent:
      "Biblioteca de programas de treino (entidade = program_templates, exibida como 'Programas'). Empty-state quando o treinador não criou nenhum.",
  },
  {
    key: "financial",
    path: "/financial",
    intent:
      "Onboarding do módulo financeiro (integração Asaas). Tela de boas-vindas com 1 CTA que avança o passo. Para conta sem financeiro configurado mostra o passo inicial — é o fluxo esperado.",
  },
  {
    key: "marketing",
    path: "/marketing/landing",
    intent:
      "Editor da landing page do treinador. BY DESIGN: o preview ao vivo (iframe) só renderiza quando há slug publicado; sem slug cai num empty-state explicativo — não é bug. Badge de seção é tri-estado (Sem URL/Publicada/Rascunho).",
  },
  {
    key: "schedule",
    path: "/schedule",
    intent:
      "Agenda semanal de agendamentos. BY DESIGN: a grade de horas abre em ~05h e faz scroll de painel INTERNO pro horário útil — posição 05h/00h no topo NÃO é bug. Criação de agendamento é por clique em slot. Atalhos de navegação por teclado no header.",
  },
  {
    key: "forms",
    path: "/forms",
    intent:
      "Dashboard de formulários/check-ins. Card 'Todos os feedbacks em dia' = estado saudável (nada pendente). Header tem ações de criar template e enviar para aluno.",
  },
  // /messages é redirect('/dashboard') — não é página navegável (chat é drawer na UI).
  {
    key: "exercises",
    path: "/exercises",
    intent:
      "Catálogo de exercícios (~568 itens + os do treinador). Cards com nome, grupo muscular e selo de vídeo. BY DESIGN: diferencia 'Meu vídeo' de 'Vídeo'; sem vídeo não exibe selo. Filtros com badge contador e 'Limpar filtros'.",
  },
  {
    key: "settings",
    path: "/settings",
    intent:
      "Configurações: perfil (e-mail é disabled por vir do auth), card de conexão de IA/developer link, branding com selo 'PRO'. Espaços vazios em cards podem ser propositais.",
  },
];

// Captura a página em SEGMENTOS de viewport (não fullPage: costurar página alta
// com lista virtualizada/animada duplica conteúdo). Cada segmento é um screenshot
// limpo de uma faixa rolada — dá ao analisador a página inteira sem artefato.
// Para se a página não rolar (scroll interno proposital, ex. /schedule): evita
// shots idênticos. maxSegments limita páginas muito longas.
async function captureSegments(page, key, maxSegments = 4) {
  const shots = [];
  const vh = page.viewportSize().height;
  let lastY = -1;
  for (let i = 0; i < maxSegments; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vh);
    await page.waitForTimeout(250);
    const reachedY = await page.evaluate(() => Math.round(window.scrollY));
    if (i > 0 && reachedY === lastY) break; // não rolou mais: fim do conteúdo (ou scroll interno)
    lastY = reachedY;
    const p = resolve(SHOTS, i === 0 ? `${key}.png` : `${key}-${i + 1}.png`);
    await page.screenshot({ path: p });
    shots.push(p);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  return shots;
}

async function killAnimations(page) {
  // Animations (Framer Motion) + a long page make playwright's fullPage stitching
  // duplicate/ghost content. Freeze them before the screenshot.
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important;
      animation-duration:0s!important;scroll-behavior:auto!important}`,
  }).catch(() => {});
}

async function stripOverlays(page) {
  // Skip the prescription preferences wizard if it popped, then nuke the tour.
  try {
    const skip = page.getByRole("button", { name: /Pular|Skip/i }).first();
    if (await skip.isVisible({ timeout: 500 }).catch(() => false)) await skip.click().catch(() => {});
  } catch {}
  await page.evaluate(() => {
    // Hide (don't remove) overlays — removing React-managed nodes triggers
    // spurious removeChild errors that would pollute the console-error signal.
    const hide = (el) => {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("pointer-events", "none", "important");
    };
    document.querySelectorAll('.z-onboarding, [class*="z-onboarding"]').forEach(hide);
    document.querySelectorAll('[aria-labelledby="preferences-wizard-title"]').forEach((e) => {
      const dlg = e.closest('[role="dialog"]') || e;
      hide(dlg);
      const ov = dlg.previousElementSibling;
      if (ov && ov.getAttribute("data-state")) hide(ov);
    });
    // Reset only the WINDOW scroll (auto-hide header). Do NOT zero inner
    // scroll containers — pages like /schedule intentionally scroll an inner
    // pane (calendar starts at 05h); zeroing it produced a fake "00:00" finding.
    window.scrollTo(0, 0);
  });
}

const cdp = await fetch(`${BASE.replace("3000", "9222")}/json/version`).then((r) => r.json());
const browser = await chromium.connectOverCDP("http://localhost:9222");
// Use the dedicated Chrome's default context — newContext() over CDP is rejected
// by some Chrome builds ("Browser context management is not supported"). Safe here
// because this is a throwaway profile, not Gustavo's session.
const ctx = browser.contexts()[0] || (await browser.newContext());
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize({ width: 1440, height: 900 });

const manifest = { base: BASE, chrome: cdp.Browser, routes: [], login: null };

// ---- login ----
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('input[type="email"]').first().pressSequentially(account.email, { delay: 8 });
  await page.locator('input[type="password"]').first().pressSequentially(account.password, { delay: 8 });
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|students|programs)/, { timeout: 30000 });
  manifest.login = "ok";
} catch (e) {
  manifest.login = "FAILED: " + e.message;
  manifest.loginShot = resolve(SHOTS, "login-failed.png");
  await page.screenshot({ path: manifest.loginShot, fullPage: true }).catch(() => {});
  writeFileSync(resolve(SHOTS, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest));
  await browser.close();
  process.exit(0);
}

// ---- per-route capture ----
for (const r of ROUTES) {
  const errors = [];
  const onConsole = (m) => m.type() === "error" && errors.push(m.text().slice(0, 300));
  const onPageErr = (e) => errors.push("pageerror: " + String(e).slice(0, 300));
  page.on("console", onConsole);
  page.on("pageerror", onPageErr);
  const entry = { key: r.key, path: r.path, intent: r.intent || "", errors, shot: null, shots: [], httpOk: true, ms: 0 };
  const t0 = Date.now();
  try {
    const resp = await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 30000 });
    entry.status = resp?.status() ?? null;
    entry.httpOk = !resp || resp.status() < 400;
    await page.waitForTimeout(900); // let client render/animations settle
    await stripOverlays(page);
    await killAnimations(page);
    await page.waitForTimeout(300);
    // Página inteira em segmentos (não fullPage) — analisador vê acima E abaixo da dobra.
    entry.shots = await captureSegments(page, r.key);
    entry.shot = entry.shots[0] || null; // compat: primeiro segmento (above-the-fold)
  } catch (e) {
    entry.error = String(e).slice(0, 300);
    const shot = resolve(SHOTS, `${r.key}-error.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    entry.shot = shot;
    entry.shots = [shot];
  }
  entry.ms = Date.now() - t0;
  page.off("console", onConsole);
  page.off("pageerror", onPageErr);
  manifest.routes.push(entry);
}

writeFileSync(resolve(SHOTS, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
// Do NOT browser.close() — this is a shared CDP connection to a long-lived Chrome.
// Closing it leaves Chrome with 0 targets and breaks the next connectOverCDP handshake.
// Just drop the page reference; process exit disconnects cleanly.
await page.goto("about:blank").catch(() => {});
process.exit(0);
