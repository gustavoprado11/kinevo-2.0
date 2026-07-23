/* Origem: port fiel de Kinevo.dc.html (Claude Design, projeto Kinevo, jul/2026).
 * O gerador não existe mais — este arquivo É a fonte (editado à mão).
 *
 * SSR: hero (marca + headline + CTAs), Recursos e o cabeçalho de Planos são HTML
 * (crawlers leem sem JS). Os visuais do hero (dashboard + celular do Assistente)
 * e o bloco de PREÇOS são slots preenchidos por React no cliente:
 *   #kvlp-hero-dash    → <HeroDashMock/>   (assistant-mocks.tsx)
 *   #kvlp-hero-phone   → <HeroPhoneMock/>
 *   #kvlp-pricing-slot → <PricingV2/>      (fonte única: TIER_DISPLAY + STUDIO_TIERS)
 * Ícones = SVG inline (CSP proíbe o script do lucide). Animações dos cards são CSS
 * puro (kvbuild/kvbar/kvlive); reveal-on-scroll via [data-reveal] no client. */
export const LANDING_HTML = `<div style="width:100%;overflow-x:hidden">

<!-- ░░░ HERO ░░░ -->
<section id="topo" class="kv-hero" style="position:relative;height:100vh;min-height:780px;overflow:hidden;background:#08060f">
  <div class="kv-hero-desktop" style="position:absolute;top:58px;left:0;right:0;bottom:-40px">
    <div id="kvlp-hero-dash" style="width:100%;height:100%"></div>
  </div>
  <div class="kv-hero-ov" style="position:absolute;inset:0;background:linear-gradient(103deg, rgba(9,7,20,.85) 0%, rgba(9,7,20,.55) 30%, rgba(9,7,20,.22) 56%, rgba(9,7,20,.12) 100%)"></div>
  <div class="kv-hero-ov" style="position:absolute;inset:0;background:linear-gradient(0deg, rgba(9,7,20,.74) 0%, rgba(9,7,20,.16) 24%, transparent 44%)"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:100px;background:linear-gradient(180deg, rgba(9,7,20,.78) 0%, rgba(9,7,20,.5) 55%, transparent 100%);pointer-events:none"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(115% 75% at 12% 92%, rgba(124,58,237,.42) 0%, transparent 52%);mix-blend-mode:screen;pointer-events:none"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 95% 8%, rgba(168,85,247,.22) 0%, transparent 55%);mix-blend-mode:screen;pointer-events:none"></div>

  <nav class="kv-nav" style="position:absolute;top:0;left:0;right:0;z-index:4;display:flex;align-items:center;gap:36px;padding:26px 48px">
    <a href="#topo" style="display:flex;align-items:center;gap:10px">
      <img src="/logo-icon.png" alt="Kinevo" style="width:28px;height:28px;border-radius:8px">
      <span style="font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#fff">Kinevo</span>
    </a>
    <div style="flex:1"></div>
    <div class="kv-navlinks" style="display:flex;align-items:center;gap:30px">
      <a href="#recursos" class="kv-navlink">Recursos</a>
      <a href="#planos" class="kv-navlink">Planos</a>
      <a href="#recursos" class="kv-navlink">Sala de Treino</a>
      <a href="#planos" class="kv-navlink">Para estúdios</a>
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;align-items:center;gap:14px">
      <a href="/login" class="kv-navlink" style="font-weight:600">Entrar</a>
      <a href="/signup" class="kv-pill-cta" style="display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(8px);color:#fff;font-size:14px;font-weight:600;padding:10px 18px;border-radius:9999px">Começar grátis</a>
    </div>
  </nav>

  <div class="kv-hero-content" style="position:absolute;left:48px;right:48px;bottom:13vh;z-index:3;max-width:660px">
    <div style="display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);backdrop-filter:blur(8px);padding:7px 14px;border-radius:9999px;margin-bottom:26px">
      <span style="width:7px;height:7px;border-radius:50%;background:var(--kv-brand-400);display:inline-block"></span>
      <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,.92)">Plataforma para personal trainers</span>
    </div>
    <h1 style="font-family:var(--kv-font-display);font-size:clamp(40px,5.6vw,66px);line-height:1.02;font-weight:800;letter-spacing:-0.03em;color:#fff;margin:0;text-wrap:balance;text-shadow:0 2px 24px rgba(0,0,0,.4)">Um jeito mais inteligente<br>de treinar seus alunos</h1>
    <p style="font-size:18px;line-height:1.5;color:rgba(255,255,255,.85);margin:22px 0 0;max-width:500px;text-shadow:0 1px 16px rgba(0,0,0,.4)">Prescreva programas com IA, acompanhe cada treino e receba sem taxas — do primeiro cadastro ao pagamento, num só lugar.</p>
    <div style="display:flex;align-items:center;gap:14px;margin-top:32px">
      <a href="/signup" class="kv-pill-cta" style="display:inline-flex;align-items:center;gap:8px;background:var(--kv-brand-600);color:#fff;font-size:15px;font-weight:700;padding:14px 26px;border-radius:9999px;box-shadow:0 8px 24px rgba(124,58,237,.4)">Começar grátis</a>
      <a href="#recursos" class="kv-pill-cta" style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(8px);color:#fff;font-size:15px;font-weight:600;padding:14px 22px;border-radius:9999px">Ver como funciona
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:26px;font-size:13.5px;color:rgba(255,255,255,.62);font-weight:500">
      <span>Plano grátis pra sempre</span><span style="opacity:.5">·</span><span>Sem cartão</span><span style="opacity:.5">·</span><span>Setup em 2 min</span>
    </div>
  </div>
  <div class="kv-hero-phone" style="display:none">
    <div id="kvlp-hero-phone"></div>
  </div>
</section>

<!-- ░░░ RECURSOS ░░░ -->
<section id="recursos" style="background:var(--kv-surface-canvas);color:var(--kv-text-primary);padding:104px 48px">
  <div style="max-width:1200px;margin:0 auto">
    <div style="max-width:640px;margin-bottom:56px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--kv-brand-600);margin-bottom:14px">Recursos</div>
      <h2 style="font-size:clamp(30px,3.4vw,42px);font-weight:800;letter-spacing:-0.025em;line-height:1.08;margin:0">Tudo que o personal precisa, num só lugar</h2>
      <p style="font-size:17px;line-height:1.55;color:var(--kv-text-secondary);margin:18px 0 0">Do programa ao pagamento. A IA adianta o trabalho chato — você mantém a palavra final.</p>
    </div>
    <div class="kv-recgrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:stretch">

      <div class="kv-featwide" data-reveal style="grid-column:span 2;transition-delay:0s">
        <div class="kv-feat kv-featrow" style="height:100%;display:flex;gap:26px;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:22px;padding:28px;box-shadow:var(--kv-shadow-sm)">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
              <div class="kv-tile" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#F5F3FF,#EDE9FE);color:var(--kv-brand-700);display:flex;align-items:center;justify-content:center;border:1px solid rgba(124,58,237,.14)"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg></div>
              <span style="font-family:var(--kv-font-mono);font-size:12px;color:var(--kv-text-quaternary);letter-spacing:0.04em">01</span>
            </div>
            <h3 style="font-size:20px;font-weight:700;letter-spacing:-0.015em;margin:0">Prescrição com IA</h3>
            <p style="font-size:14.5px;line-height:1.6;color:var(--kv-text-secondary);margin:10px 0 0;max-width:380px">Descreva o objetivo do aluno e a IA rascunha o programa. Você ajusta arrastando, aprova e manda pro app. O domingo montando treino no PDF acabou.</p>
            <div style="margin-top:auto;padding-top:20px"><span class="kv-arrow" style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:var(--kv-brand-700)">Rascunhar com IA <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span></div>
          </div>
          <div class="kv-vis" style="width:290px;flex-shrink:0;align-self:center;background:var(--kv-neutral-50);border:1px solid var(--kv-border-subtle);border-radius:16px;padding:14px">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:13px">
              <div style="width:26px;height:26px;border-radius:8px;background:var(--kv-gradient-brand);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg></div>
              <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700">Hipertrofia 3x · Raquel</div><div style="font-family:var(--kv-font-mono);font-size:8.5px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#B45309">Prévia</div></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;animation:kvbuild 5s 0s infinite"><span>Supino reto c/ halteres</span><span style="font-family:var(--kv-font-mono);color:var(--kv-text-secondary)">4×8-12</span></div>
              <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;animation:kvbuild 5s .55s infinite"><span>Puxada frontal</span><span style="font-family:var(--kv-font-mono);color:var(--kv-text-secondary)">4×8-10</span></div>
              <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;animation:kvbuild 5s 1.1s infinite"><span>Agachamento livre</span><span style="font-family:var(--kv-font-mono);color:var(--kv-text-secondary)">4×6-8</span></div>
            </div>
          </div>
        </div>
      </div>

      <div data-reveal style="transition-delay:.08s">
        <div class="kv-feat" style="height:100%;display:flex;flex-direction:column;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:22px;padding:28px;box-shadow:var(--kv-shadow-sm)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div class="kv-tile" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#F5F3FF,#EDE9FE);color:var(--kv-brand-700);display:flex;align-items:center;justify-content:center;border:1px solid rgba(124,58,237,.14)"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg></div>
            <span style="font-family:var(--kv-font-mono);font-size:12px;color:var(--kv-text-quaternary)">02</span>
          </div>
          <h3 style="font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:0">Assistente que você aprova</h3>
          <p style="font-size:14px;line-height:1.6;color:var(--kv-text-secondary);margin:9px 0 0">Ele te avisa quem faltou, quem estagnou e quem já pode subir carga, e sugere o que fazer. Nada vai pro aluno sem o seu OK.</p>
          <div style="margin-top:auto;padding-top:18px"><span style="display:inline-flex;align-items:center;gap:8px;background:var(--kv-brand-soft);border-radius:9px;padding:7px 11px;font-size:12px;font-weight:600;color:var(--kv-brand-700)"><span style="width:7px;height:7px;border-radius:999px;background:var(--kv-brand-600);animation:kvlive 2s infinite"></span>2 estagnados · 1 pronto p/ evoluir</span></div>
        </div>
      </div>

      <div data-reveal style="transition-delay:.12s">
        <div class="kv-feat" style="height:100%;display:flex;flex-direction:column;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:22px;padding:28px;box-shadow:var(--kv-shadow-sm)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div class="kv-tile" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);color:#2563EB;display:flex;align-items:center;justify-content:center;border:1px solid rgba(37,99,235,.12)"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></div>
            <span style="font-family:var(--kv-font-mono);font-size:12px;color:var(--kv-text-quaternary)">03</span>
          </div>
          <h3 style="font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:0">Sala de Treino ao vivo</h3>
          <p style="font-size:14px;line-height:1.6;color:var(--kv-text-secondary);margin:9px 0 0">Acompanhe vários alunos na sala ao mesmo tempo, veja quem está em qual série e registre a carga na hora. Sem caderninho, sem planilha.</p>
          <div style="margin-top:auto;padding-top:18px"><span style="display:inline-flex;align-items:center;gap:8px;background:#EFF6FF;border-radius:9px;padding:7px 11px;font-size:12px;font-weight:600;color:#2563EB"><span style="display:inline-flex;gap:3px"><span style="width:6px;height:6px;border-radius:999px;background:#16A34A;animation:kvlive 1.8s 0s infinite"></span><span style="width:6px;height:6px;border-radius:999px;background:#16A34A;animation:kvlive 1.8s .3s infinite"></span><span style="width:6px;height:6px;border-radius:999px;background:#16A34A;animation:kvlive 1.8s .6s infinite"></span></span>3 alunos ao vivo</span></div>
        </div>
      </div>

      <div data-reveal style="transition-delay:.16s">
        <div class="kv-feat" style="height:100%;display:flex;flex-direction:column;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:22px;padding:28px;box-shadow:var(--kv-shadow-sm)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div class="kv-tile" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#F0FDF4,#DCFCE7);color:#16A34A;display:flex;align-items:center;justify-content:center;border:1px solid rgba(22,163,74,.12)"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><polyline points="12 10 12 12 13 13"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m9.87 16.34.81 4.05a2 2 0 0 0 2 1.61h2.68a2 2 0 0 0 2-1.61l.78-4.05"/></svg></div>
            <span style="font-family:var(--kv-font-mono);font-size:12px;color:var(--kv-text-quaternary)">04</span>
          </div>
          <h3 style="font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:0">App + Apple Watch</h3>
          <p style="font-size:14px;line-height:1.6;color:var(--kv-text-secondary);margin:9px 0 0">O treino no pulso do aluno. Ele marca cada série sem tirar o celular do bolso, e você recebe tudo do lado de cá.</p>
          <div style="margin-top:auto;padding-top:18px"><span style="display:inline-flex;align-items:center;gap:7px;background:#F0FDF4;border-radius:9px;padding:7px 11px;font-size:12px;font-weight:600;color:#16A34A"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Série marcada no relógio</span></div>
        </div>
      </div>

      <div data-reveal style="transition-delay:.2s">
        <div class="kv-feat" style="height:100%;display:flex;flex-direction:column;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:22px;padding:28px;box-shadow:var(--kv-shadow-sm)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div class="kv-tile" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#FFFBEB,#FEF3C7);color:#B45309;display:flex;align-items:center;justify-content:center;border:1px solid rgba(180,83,9,.12)"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg></div>
            <span style="font-family:var(--kv-font-mono);font-size:12px;color:var(--kv-text-quaternary)">05</span>
          </div>
          <h3 style="font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:0">Cobrança integrada, sem comissão</h3>
          <p style="font-size:14px;line-height:1.6;color:var(--kv-text-secondary);margin:9px 0 0">Cobre por PIX, cartão ou boleto direto pelo Kinevo. A gente não tira nenhum percentual do que você recebe do seu aluno.</p>
          <div style="margin-top:auto;padding-top:18px"><span style="display:inline-flex;align-items:center;gap:7px;background:#FFFBEB;border-radius:9px;padding:7px 11px;font-size:12px;font-weight:600;color:#B45309"><span style="font-family:var(--kv-font-mono);font-weight:800;font-size:13px">0%</span> de comissão do Kinevo</span></div>
        </div>
      </div>

      <div class="kv-featwide" data-reveal style="grid-column:span 3;transition-delay:.1s">
        <div class="kv-feat kv-featrow" style="display:flex;gap:32px;align-items:center;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:22px;padding:30px 32px;box-shadow:var(--kv-shadow-sm)">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
              <div class="kv-tile" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#F5F3FF,#EDE9FE);color:var(--kv-brand-700);display:flex;align-items:center;justify-content:center;border:1px solid rgba(124,58,237,.14)"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
              <span style="font-family:var(--kv-font-mono);font-size:12px;color:var(--kv-text-quaternary)">06</span>
            </div>
            <h3 style="font-size:20px;font-weight:700;letter-spacing:-0.015em;margin:0">Você vê quem treinou</h3>
            <p style="font-size:14.5px;line-height:1.6;color:var(--kv-text-secondary);margin:10px 0 0;max-width:520px">Aderência, carga registrada e evolução de cada aluno. A sua próxima prescrição deixa de ser chute e vira ajuste em cima de dado real.</p>
          </div>
          <div class="kv-vis" style="width:340px;flex-shrink:0;background:var(--kv-neutral-50);border:1px solid var(--kv-border-subtle);border-radius:16px;padding:18px">
            <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:14px">
              <div><div style="font-size:10.5px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--kv-text-tertiary)">Aderência · 7 dias</div><div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;margin-top:2px">92%</div></div>
              <div style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--kv-success)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>+8pp</div>
            </div>
            <div style="display:flex;align-items:flex-end;gap:8px;height:60px">
              <div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:5px 5px 0 0;background:var(--kv-brand-200);transform-origin:bottom;--h:.45;animation:kvbar 4.5s 0s infinite"></div></div>
              <div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:5px 5px 0 0;background:var(--kv-brand-200);transform-origin:bottom;--h:.62;animation:kvbar 4.5s .12s infinite"></div></div>
              <div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:5px 5px 0 0;background:var(--kv-brand-300);transform-origin:bottom;--h:.5;animation:kvbar 4.5s .24s infinite"></div></div>
              <div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:5px 5px 0 0;background:var(--kv-brand-300);transform-origin:bottom;--h:.76;animation:kvbar 4.5s .36s infinite"></div></div>
              <div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:5px 5px 0 0;background:var(--kv-brand-400);transform-origin:bottom;--h:.66;animation:kvbar 4.5s .48s infinite"></div></div>
              <div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:5px 5px 0 0;background:var(--kv-brand-500);transform-origin:bottom;--h:.85;animation:kvbar 4.5s .6s infinite"></div></div>
              <div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:5px 5px 0 0;background:var(--kv-brand-600);transform-origin:bottom;--h:.96;animation:kvbar 4.5s .72s infinite"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ PLANOS ░░░ -->
<section id="planos" style="background:#fff;color:var(--kv-text-primary);padding:104px 48px;border-top:1px solid var(--kv-border-subtle)">
  <div style="max-width:1200px;margin:0 auto">
    <div style="text-align:center;max-width:640px;margin:0 auto 40px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--kv-brand-600);margin-bottom:14px">Planos</div>
      <h2 style="font-size:clamp(30px,3.4vw,42px);font-weight:800;letter-spacing:-0.025em;line-height:1.08;margin:0">Comece grátis. Cresça com IA.</h2>
      <p style="font-size:17px;line-height:1.55;color:var(--kv-text-secondary);margin:18px 0 0">Sem comissão sobre o que você recebe. 7 dias grátis em qualquer plano pago — cancele quando quiser.</p>
    </div>
    <div id="kvlp-pricing-slot"></div>
  </div>
</section>

<!-- ░░░ FOOTER ░░░ -->
<footer class="kv-footer" style="background:#08060f;color:#fff;padding:72px 48px 40px">
  <div style="max-width:1200px;margin:0 auto">
    <div class="kv-footgrid" style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:40px">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <img src="/logo-icon.png" alt="Kinevo" style="width:28px;height:28px;border-radius:8px">
          <span style="font-weight:800;font-size:20px;letter-spacing:-0.02em">Kinevo</span>
        </div>
        <p style="font-size:14px;line-height:1.55;color:rgba(255,255,255,.6);max-width:280px;margin:0">Prescreva, acompanhe e receba sem taxas. O sistema completo para personal trainers — do programa ao pagamento.</p>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:16px">Produto</div>
        <div style="display:flex;flex-direction:column;gap:11px">
          <a href="#recursos" class="kv-foot-link">Recursos</a>
          <a href="#planos" class="kv-foot-link">Planos</a>
          <a href="#recursos" class="kv-foot-link">Sala de Treino</a>
          <a href="#recursos" class="kv-foot-link">Apple Watch</a>
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:16px">Empresa</div>
        <div style="display:flex;flex-direction:column;gap:11px">
          <a href="#recursos" class="kv-foot-link">Sobre</a>
          <a href="#planos" class="kv-foot-link">Para estúdios</a>
          <a href="/login" class="kv-foot-link">Entrar</a>
          <a href="/signup" class="kv-foot-link">Criar conta</a>
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:16px">Legal</div>
        <div style="display:flex;flex-direction:column;gap:11px">
          <a href="/privacy" class="kv-foot-link">Privacidade</a>
          <a href="/terms" class="kv-foot-link">Termos</a>
          <a href="/privacy" class="kv-foot-link">LGPD</a>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-top:48px;padding-top:26px;border-top:1px solid rgba(255,255,255,.1)">
      <span style="font-size:13px;color:rgba(255,255,255,.45)">© 2026 Kinevo. Feito no Brasil.</span>
      <a href="/signup" class="kv-pill-cta" style="display:inline-flex;align-items:center;gap:7px;background:var(--kv-brand-600);color:#fff;font-size:13.5px;font-weight:700;padding:10px 20px;border-radius:9999px">Começar grátis</a>
    </div>
  </div>
</footer>
</div>`
