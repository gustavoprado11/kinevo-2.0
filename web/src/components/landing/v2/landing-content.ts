/* Origem: port de Landing Page.dc.html (Claude Design); o gerador não existe mais —
 * este arquivo agora É a fonte (editado à mão). Redesign jul/2026: pílulas→10px,
 * gradientes→sólidos, orbes/float removidos, dark neutro.
 * Correções de fidelidade/promessa aplicadas no build. O bloco de PREÇOS é um slot
 * (#kvlp-pricing-slot) onde o React faz portal de <PricingV2/> (fonte única = TIER_DISPLAY). */
export const LANDING_HTML = `<div style="position:relative;width:100%;overflow:hidden">

<!-- ░░░ NAVBAR ░░░ -->
<header style="position:sticky;top:0;z-index:20;backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);background:rgba(255,255,255,0.78);border-bottom:1px solid var(--kv-border-subtle)">
  <nav style="max-width:1180px;margin:0 auto;padding:0 24px;height:66px;display:flex;align-items:center;justify-content:space-between;gap:24px">
    <a href="#topo" style="display:flex;align-items:center;gap:10px">
      <span style="width:34px;height:34px;border-radius:9px;background:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:var(--kv-shadow-brand-sm)"><img src="/logo-icon.png" alt="Kinevo" style="width:100%;height:100%;object-fit:cover"></span>
      <span style="font-weight:800;font-size:19px;letter-spacing:-0.02em;color:var(--kv-text-primary)">Kinevo</span>
    </a>
    <div id="nav-links" style="display:flex;align-items:center;gap:30px;font-size:14.5px;font-weight:500;color:var(--kv-text-secondary)">
      <a href="#como-funciona" style="transition:color .2s" onmouseover="this.style.color='var(--kv-text-primary)'" onmouseout="this.style.color=''">Como funciona</a>
      <a href="#recursos" onmouseover="this.style.color='var(--kv-text-primary)'" onmouseout="this.style.color=''">Recursos</a>
      <a href="#para-aluno" onmouseover="this.style.color='var(--kv-text-primary)'" onmouseout="this.style.color=''">Para o aluno</a>
      <a href="#precos" onmouseover="this.style.color='var(--kv-text-primary)'" onmouseout="this.style.color=''">Preços</a>
      <a href="#faq" onmouseover="this.style.color='var(--kv-text-primary)'" onmouseout="this.style.color=''">FAQ</a>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <a href="/login" style="padding:9px 16px;font-size:14px;font-weight:600;color:var(--kv-text-secondary);border-radius:10px;transition:background .2s" onmouseover="this.style.background='var(--kv-neutral-100)'" onmouseout="this.style.background=''">Entrar</a>
      <a href="/signup" style="padding:10px 20px;font-size:14px;font-weight:600;color:#fff;background:var(--kv-brand-600);border-radius:10px;box-shadow:var(--kv-shadow-brand-sm);transition:transform .15s,box-shadow .2s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='var(--kv-shadow-brand)'" onmouseout="this.style.transform='';this.style.boxShadow='var(--kv-shadow-brand-sm)'">Começar grátis</a>
    </div>
  </nav>
</header>

<!-- ░░░ HERO ░░░ -->
<section id="topo" style="position:relative;padding:84px 0 72px;background:var(--kv-surface-canvas)">
  <div id="hero-grid" style="position:relative;max-width:1180px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1.04fr 1fr;gap:56px;align-items:center">
    <div>
      <div id="hero-eyebrow" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;background:rgba(255,255,255,0.7);border:1px solid var(--kv-border-subtle);border-radius:10px;box-shadow:var(--kv-shadow-xs);margin-bottom:22px">
        <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 9px;background:var(--kv-brand-600);color:#fff;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg>Assistente de IA</span>
        <span style="font-size:13px;font-weight:600;color:var(--kv-text-secondary)">Prescreve, acompanha e recebe — num lugar só</span>
      </div>
      <h1 class="display-xl" style="font-size:56px;font-weight:800;line-height:1.06;letter-spacing:-0.03em;margin:0 0 20px;color:var(--kv-text-primary)">Tudo que o personal precisa pra trabalhar — <span style="color:var(--kv-brand-600)">num lugar só.</span></h1>
      <p style="font-size:19px;line-height:1.55;color:var(--kv-text-secondary);margin:0 0 30px;max-width:560px">Monte programas com a IA que <strong style="color:var(--kv-text-primary);font-weight:600">você aprova</strong>, acompanhe cada treino na hora e receba dos seus alunos <strong style="color:var(--kv-text-primary);font-weight:600">sem comissão do Kinevo</strong>. No iPhone, no Android e até no Apple Watch.</p>
      <div style="display:inline-flex;align-items:center;gap:9px;margin-bottom:22px;padding:8px 14px 8px 10px;background:var(--kv-success-soft);border:1px solid #BBE7C8;border-radius:10px">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--kv-success);color:#fff"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m15 9-6 6"/><path d="M9 9h.01"/><path d="M15 15h.01"/></svg></span>
        <span style="font-size:13.5px;font-weight:700;color:#14803A">0% de comissão do Kinevo</span>
        <span style="font-size:12.5px;color:#1A8C44">— a gente não tira uma fatia do que você recebe</span>
      </div>
      <div id="hero-cta" style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:18px">
        <a href="/signup" style="display:inline-flex;align-items:center;gap:9px;padding:15px 28px;font-size:16px;font-weight:700;color:#fff;background:var(--kv-brand-600);border-radius:10px;box-shadow:var(--kv-shadow-brand);transition:transform .15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">Começar grátis<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>
        <a href="#como-funciona" style="display:inline-flex;align-items:center;gap:9px;padding:15px 24px;font-size:16px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-default);border-radius:10px;transition:background .2s" onmouseover="this.style.background='var(--kv-neutral-100)'" onmouseout="this.style.background='#fff'"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-brand-600)"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>Ver como funciona</a>
      </div>
      <p id="hero-micro" style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--kv-text-tertiary);margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-success)"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>Grátis pra começar · sem cartão · cancele quando quiser</p>
    </div>

    <!-- HERO VISUAL -->
    <div id="hero-visual" style="position:relative;min-height:440px">
      <!-- Dashboard window -->
      <div style="position:relative;z-index:2;width:100%;background:#fff;border:1px solid var(--kv-border-subtle);border-radius:18px;box-shadow:0 24px 60px rgba(28,25,23,0.10),0 4px 14px rgba(0,0,0,0.04);overflow:hidden">
        <div style="display:flex;align-items:center;gap:7px;padding:11px 14px;border-bottom:1px solid var(--kv-border-subtle);background:var(--kv-neutral-50)">
          <span style="width:11px;height:11px;border-radius:50%;background:#FF5F57"></span><span style="width:11px;height:11px;border-radius:50%;background:#FEBC2E"></span><span style="width:11px;height:11px;border-radius:50%;background:#28C840"></span>
          <span style="margin-left:10px;font-size:11px;color:var(--kv-text-tertiary);background:#fff;border:1px solid var(--kv-border-subtle);padding:3px 12px;border-radius:10px">kinevoapp.com/dashboard</span>
        </div>
        <div style="padding:16px">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:13px">
            <div style="flex:1">
              <div style="font-weight:800;font-size:16px;letter-spacing:-0.01em;color:var(--kv-text-primary)">Boa tarde, treinador</div>
              <div style="display:flex;gap:6px;margin-top:5px">
                <span style="font-size:10px;font-weight:600;color:var(--kv-success);background:var(--kv-success-soft);padding:2px 8px;border-radius:10px">● 12 alunos ativos</span>
                <span style="font-size:10px;font-weight:600;color:var(--kv-text-secondary);background:var(--kv-neutral-100);padding:2px 8px;border-radius:10px">Hoje · 5 sessões</span>
              </div>
            </div>
            <span style="font-size:11px;font-weight:600;color:#fff;background:var(--kv-brand-600);padding:7px 12px;border-radius:9px">+ Agendar</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:13px">
            <div style="border:1px solid var(--kv-border-subtle);border-radius:11px;padding:10px"><div style="font-size:9px;font-weight:700;letter-spacing:0.06em;color:var(--kv-text-tertiary)">ADERÊNCIA</div><div style="font-size:19px;font-weight:800;color:var(--kv-success);margin-top:2px;font-variant-numeric:tabular-nums">87%</div></div>
            <div style="border:1px solid var(--kv-border-subtle);border-radius:11px;padding:10px"><div style="font-size:9px;font-weight:700;letter-spacing:0.06em;color:var(--kv-text-tertiary)">ESTE MÊS</div><div style="font-size:19px;font-weight:800;color:var(--kv-text-primary);margin-top:2px;font-variant-numeric:tabular-nums">R$ 4.200</div></div>
            <div style="border:1px solid var(--kv-border-subtle);border-radius:11px;padding:10px"><div style="font-size:9px;font-weight:700;letter-spacing:0.06em;color:var(--kv-text-tertiary)">TREINOS</div><div style="font-size:19px;font-weight:800;color:var(--kv-text-primary);margin-top:2px;font-variant-numeric:tabular-nums">38</div></div>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start;background:var(--kv-brand-50);border:1px solid var(--kv-brand-200);border-radius:12px;padding:11px 12px;margin-bottom:10px">
            <span style="width:26px;height:26px;border-radius:8px;background:var(--kv-brand-600);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg></span>
            <div>
              <div style="font-size:10px;font-weight:700;letter-spacing:0.05em;color:var(--kv-brand-700)">PRECISA DA SUA ATENÇÃO</div>
              <div style="font-size:12.5px;font-weight:700;color:var(--kv-brand-900);margin-top:2px">Marina está pronta pra evoluir a carga no agachamento</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--kv-border-subtle);border-radius:12px;padding:11px 12px">
            <span style="width:26px;height:26px;border-radius:8px;background:var(--kv-warning-soft);color:var(--kv-warning);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg></span>
            <div style="flex:1">
              <div style="font-size:12.5px;font-weight:700;color:var(--kv-text-primary)">Rafael não treina há 4 dias</div>
              <div style="font-size:11px;color:var(--kv-text-tertiary);margin-top:1px">Quer que eu mande um lembrete?</div>
            </div>
            <span style="font-size:10.5px;font-weight:600;color:var(--kv-brand-700);background:var(--kv-brand-50);padding:6px 10px;border-radius:8px;white-space:nowrap">Enviar</span>
          </div>
        </div>
      </div>
      <!-- Phone -->
      <div style="position:absolute;z-index:3;bottom:-46px;left:-34px"><div id="kvlp-hero-phone"></div></div>
      <!-- Watch -->
      <div style="position:absolute;z-index:4;top:-12px;right:-24px"><div id="kvlp-hero-watch"></div></div>
    </div>
  </div>
</section>

<!-- ░░░ BADGE MARQUEE ░░░ -->
<div style="border-top:1px solid var(--kv-border-subtle);border-bottom:1px solid var(--kv-border-subtle);background:#fff;padding:18px 0;overflow:hidden;position:relative">
  <div style="position:absolute;left:0;top:0;bottom:0;width:90px;background:linear-gradient(90deg,#fff,transparent);z-index:2;pointer-events:none"></div>
  <div style="position:absolute;right:0;top:0;bottom:0;width:90px;background:linear-gradient(270deg,#fff,transparent);z-index:2;pointer-events:none"></div>
  <div class="kvmq" style="display:flex;gap:14px;width:max-content">
    <div style="display:flex;gap:14px;flex-shrink:0;padding-right:14px">
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>Prescrição em minutos</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M12 10v2.2l1.6 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/><circle cx="12" cy="12" r="6"/></svg>Apple Watch no pulso do aluno</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg>IA que aprende seu estilo</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>iPhone e Android</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>Funciona offline</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>Receba direto na sua conta</span>
    </div>
    <div style="display:flex;gap:14px;flex-shrink:0;padding-right:14px" aria-hidden="true">
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>Prescrição em minutos</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M12 10v2.2l1.6 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/><circle cx="12" cy="12" r="6"/></svg>Apple Watch no pulso do aluno</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg>IA que aprende seu estilo</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>iPhone e Android</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>Funciona offline</span>
      <span style="display:inline-flex;align-items:center;gap:9px;flex-shrink:0;white-space:nowrap;font-size:14px;font-weight:600;color:var(--kv-text-primary);background:var(--kv-neutral-100);border:1px solid var(--kv-border-subtle);padding:9px 16px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-brand-600)"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>Receba direto na sua conta</span>
    </div>
  </div>
</div>

<!-- ░░░ PROBLEMA ░░░ -->
<section class="sec" style="padding:92px 0">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="text-align:center;max-width:720px;margin:0 auto 48px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">O problema</div>
      <h2 class="display-xl" style="font-size:40px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0;color:var(--kv-text-primary)">Você é profissional. Suas ferramentas também deveriam ser.</h2>
    </div>
    <div class="three-col" data-reveal="" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:20px;padding:30px 26px;box-shadow:var(--kv-shadow-sm)">
        <div style="font-size:48px;font-weight:800;letter-spacing:-0.03em;color:var(--kv-text-primary);line-height:1;font-variant-numeric:tabular-nums">2h<span style="color:var(--kv-brand-600)">+</span></div>
        <div style="font-size:15.5px;color:var(--kv-text-secondary);margin-top:12px;line-height:1.5">perdidas toda semana montando treino na planilha e mandando PDF no WhatsApp.</div>
      </div>
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:20px;padding:30px 26px;box-shadow:var(--kv-shadow-sm)">
        <div style="font-size:48px;font-weight:800;letter-spacing:-0.03em;color:var(--kv-text-primary);line-height:1;font-variant-numeric:tabular-nums">0<span style="color:var(--kv-brand-600)">%</span></div>
        <div style="font-size:15.5px;color:var(--kv-text-secondary);margin-top:12px;line-height:1.5">de visibilidade de quem realmente treinou — você só descobre quando o aluno some.</div>
      </div>
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:20px;padding:30px 26px;box-shadow:var(--kv-shadow-sm)">
        <div style="font-size:48px;font-weight:800;letter-spacing:-0.03em;color:var(--kv-text-primary);line-height:1;font-variant-numeric:tabular-nums">3<span style="color:var(--kv-brand-600)">+</span></div>
        <div style="font-size:15.5px;color:var(--kv-text-secondary);margin-top:12px;line-height:1.5">apps e planilhas separados pra treino, cobrança e agenda — e nada conversa entre si.</div>
      </div>
    </div>
    <div data-reveal="" style="text-align:center;margin-top:34px;font-size:20px;font-weight:700;color:var(--kv-text-primary)">O Kinevo resolve isso. <span style="color:var(--kv-brand-600)">↓</span></div>
  </div>
</section>

<!-- ░░░ COMO FUNCIONA ░░░ -->
<section id="como-funciona" class="sec" style="padding:92px 0;background:#fff;border-top:1px solid var(--kv-border-subtle);border-bottom:1px solid var(--kv-border-subtle)">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="text-align:center;max-width:680px;margin:0 auto 50px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">Como funciona</div>
      <h2 class="display-xl" style="font-size:40px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0">Do cadastro ao pagamento em 3 passos.</h2>
    </div>
    <div class="three-col" data-reveal="" style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px">
      <div style="position:relative;background:var(--kv-neutral-50);border:1px solid var(--kv-border-subtle);border-radius:20px;padding:28px">
        <div style="position:absolute;top:24px;right:26px;font-size:44px;font-weight:800;color:var(--kv-brand-100);line-height:1">1</div>
        <span style="width:48px;height:48px;border-radius:13px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg></span>
        <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">Crie sua conta</h3>
        <p style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.55;margin:0">Setup em 2 minutos. Adicione seus alunos e pronto pra começar.</p>
      </div>
      <div style="position:relative;background:var(--kv-neutral-50);border:1px solid var(--kv-border-subtle);border-radius:20px;padding:28px">
        <div style="position:absolute;top:24px;right:26px;font-size:44px;font-weight:800;color:var(--kv-brand-100);line-height:1">2</div>
        <span style="width:48px;height:48px;border-radius:13px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/></svg></span>
        <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">Monte o programa</h3>
        <p style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.55;margin:0">Construtor visual + IA. Cole um treino em texto e ela monta pra você.</p>
      </div>
      <div style="position:relative;background:var(--kv-neutral-50);border:1px solid var(--kv-border-subtle);border-radius:20px;padding:28px">
        <div style="position:absolute;top:24px;right:26px;font-size:44px;font-weight:800;color:var(--kv-brand-100);line-height:1">3</div>
        <span style="width:48px;height:48px;border-radius:13px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg></span>
        <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">Acompanhe e receba</h3>
        <p style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.55;margin:0">Veja a aderência real de cada aluno e receba sem comissão do Kinevo.</p>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ PILAR 2 — ASSISTENTE DE IA (PROTAGONISTA) ░░░ -->
<section class="sec" style="padding:96px 0;background:#111113;color:#fff;position:relative;overflow:hidden">
  <div style="position:relative;max-width:1180px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="text-align:center;max-width:820px;margin:0 auto 14px">
      <div style="display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c4b5fd;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:6px 14px;border-radius:10px;margin-bottom:20px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg>O assistente que executa</div>
      <h2 class="display-xl" style="font-size:46px;font-weight:800;letter-spacing:-0.03em;line-height:1.08;margin:0;color:#fff">Você conversa. <span style="background:var(--kv-brand-300);-webkit-background-clip:text;background-clip:text;color:transparent">Ele faz o trabalho.</span></h2>
    </div>
    <p data-reveal="" style="text-align:center;max-width:620px;margin:0 auto 44px;color:rgba(255,255,255,0.62);font-size:17px;line-height:1.55">Peça do seu jeito e o Assistente de IA executa de verdade dentro do Kinevo monta treino, remarca sessão, escreve a mensagem. <strong style="color: rgb(255, 255, 255); font-weight: 600;">Você só dá o OK.</strong></p>

    <!-- featured: animated agent demo -->
    <div data-reveal="" style="max-width:680px;margin:0 auto 36px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:22px;padding:8px;backdrop-filter:blur(8px);box-shadow:0 30px 70px rgba(0,0,0,0.4)">
      <div style="display:flex;align-items:center;gap:9px;padding:13px 16px 12px">
        <span style="width:28px;height:28px;border-radius:8px;background:var(--kv-brand-600);display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:#fff"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg></span>
        <div style="flex:1"><div style="font-size:13px;font-weight:700;color:#fff">Assistente Kinevo</div></div>
        <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#c4b5fd"><span style="width:7px;height:7px;border-radius:50%;background:#34d399;animation:kvpulse 2s ease infinite"></span><span data-kv="agentStatus">ouvindo…</span></span>
      </div>
      <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;min-height:264px;display:flex;flex-direction:column;gap:12px">
        <!-- user prompt -->
        <div style="align-self:flex-end;max-width:88%;background:var(--kv-brand-600);color:#fff;border-radius:14px 14px 4px 14px;padding:11px 14px;font-size:13.5px;line-height:1.5"><span data-kv="agentTyped"></span><span style="display:inline-block;width:6px;height:14px;background:#fff;vertical-align:-2px;margin-left:1px;animation:kvblink 1s step-end infinite;opacity:1" data-kv="agentCaret"></span></div>
        <!-- thinking -->
        <div data-kv="agThink" class="kvhide" style="align-self:flex-start;display:flex;align-items:center;gap:9px;background:rgba(255,255,255,0.06);border-radius:14px;padding:10px 14px">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:#a78bfa"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg><span style="font-size:13px;color:rgba(255,255,255,0.75)">Entendi. Executando…</span>
        </div>
        <!-- step 1 -->
        <div data-kv="agStep1" class="kvhide" style="align-self:flex-start;display:flex;align-items:flex-start;gap:9px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:11px 14px;max-width:92%">
          <span style="width:22px;height:22px;border-radius:7px;background:rgba(52,211,153,0.18);color:#34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M20 6 9 17l-5-5"/></svg></span>
          <span style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.45">Remarquei <strong style="color:#fff">Treino A e B</strong> para terça e quinta</span>
        </div>
        <!-- step 2 -->
        <div data-kv="agStep2" class="kvhide" style="align-self:flex-start;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:11px 14px;max-width:92%">
          <div style="display:flex;align-items:flex-start;gap:9px">
            <span style="width:22px;height:22px;border-radius:7px;background:rgba(52,211,153,0.18);color:#34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M20 6 9 17l-5-5"/></svg></span>
            <span style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.45">Escrevi esta mensagem para a Marina:</span>
          </div>
          <div style="margin:9px 0 0 31px;background:rgba(124,58,237,0.16);border:1px solid rgba(167,139,250,0.3);border-radius:10px;padding:9px 12px;font-size:12.5px;color:#e9deff;line-height:1.5;font-style:italic">"Oi Marina! Que bom que voltou 😊 Já deixei seu treino remarcado pra terça e quinta. Bora retomar com tudo!"</div>
          <div style="display:flex;gap:8px;margin:11px 0 0 31px">
            <span style="font-size:12px;font-weight:700;color:#fff;background:var(--kv-brand-600);padding:8px 14px;border-radius:9px;box-shadow:var(--kv-shadow-brand-sm)">Enviar mensagem</span>
            <span style="font-size:12px;font-weight:600;color:#fff;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);padding:8px 14px;border-radius:9px">Revisar</span>
          </div>
        </div>
        <!-- done -->
        <div data-kv="agDone" class="kvhide" style="align-self:flex-start;display:flex;align-items:center;gap:8px;font-size:13.5px;color:#fff;padding:2px 4px">
          <span style="color:#a78bfa">Feito!</span><span style="color:rgba(255,255,255,0.7)">Quer que eu envie agora?</span>
        </div>
      </div>
    </div>

    <div class="four-col" data-reveal="" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:22px">
        <span style="width:44px;height:44px;border-radius:12px;background:rgba(124,58,237,0.2);color:#c4b5fd;display:flex;align-items:center;justify-content:center;margin-bottom:15px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg></span>
        <div style="display:flex;align-items:center;gap:8px;margin:0 0 8px"><h3 style="font-size:16.5px;font-weight:700;margin:0;color:#fff">Resumo da manhã</h3><span style="font-size:9.5px;font-weight:700;letter-spacing:0.04em;color:#c4b5fd;border:1px solid rgba(255,255,255,0.2);padding:2px 7px;border-radius:10px">Pro</span></div>
        <p style="font-size:13.5px;color:rgba(255,255,255,0.6);line-height:1.55;margin:0">Todo dia de manhã, no seu celular: quem precisa de atenção e quem já está pronto pra evoluir.</p>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:22px">
        <span style="width:44px;height:44px;border-radius:12px;background:rgba(124,58,237,0.2);color:#c4b5fd;display:flex;align-items:center;justify-content:center;margin-bottom:15px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/></svg></span>
        <h3 style="font-size:16.5px;font-weight:700;margin:0 0 8px;color:#fff">Prescrição</h3>
        <p style="font-size:13.5px;color:rgba(255,255,255,0.6);line-height:1.55;margin:0">Monta o rascunho do programa no seu estilo. Você aprova antes de chegar no aluno.</p>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:22px">
        <span style="width:44px;height:44px;border-radius:12px;background:rgba(124,58,237,0.2);color:#c4b5fd;display:flex;align-items:center;justify-content:center;margin-bottom:15px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M7 11h10"/><path d="M7 15h6"/><path d="M7 7h8"/></svg></span>
        <h3 style="font-size:16.5px;font-weight:700;margin:0 0 8px;color:#fff">É só pedir</h3>
        <p style="font-size:13.5px;color:rgba(255,255,255,0.6);line-height:1.55;margin:0">Escreva em português o que quer e ele faz. O que é importante, ele confirma com você antes.</p>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:22px">
        <span style="width:44px;height:44px;border-radius:12px;background:rgba(124,58,237,0.2);color:#c4b5fd;display:flex;align-items:center;justify-content:center;margin-bottom:15px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg></span>
        <div style="display:flex;align-items:center;gap:8px;margin:0 0 8px"><h3 style="font-size:16.5px;font-weight:700;margin:0;color:#fff">Por voz</h3></div>
        <p style="font-size:13.5px;color:rgba(255,255,255,0.6);line-height:1.55;margin:0">Fale o que precisa e ele resolve, sem digitar. Pra usar com o aluno na sua frente.</p>
      </div>
    </div>
    <div data-reveal="" style="display:flex;align-items:flex-start;gap:10px;max-width:720px;margin:28px auto 0;padding:14px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:14px">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#a78bfa;flex-shrink:0;margin-top:1px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
      <p style="font-size:13.5px;color:rgba(255,255,255,0.6);line-height:1.5;margin:0">O Assistente de IA é ferramenta, não substituto. Ele sugere e adianta o trabalho — <strong style="color:#fff;font-weight:600">você sempre tem a palavra final.</strong></p>
    </div>
  </div>
</section>

<!-- ░░░ PILAR 1 — PRESCRIÇÃO + DEMO ░░░ -->
<section id="recursos" class="sec" style="padding:92px 0">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div class="two-col" style="display:grid;grid-template-columns:1fr 1.1fr;gap:52px;align-items:center">
      <div data-reveal="">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">Prescrição de verdade</div>
        <h2 class="display-xl" style="font-size:38px;font-weight:800;letter-spacing:-0.03em;line-height:1.12;margin:0 0 18px">Prescrição avançada que os apps gringos não fazem direito.</h2>
        <p style="font-size:16.5px;color:var(--kv-text-secondary);line-height:1.6;margin:0 0 22px">Drop-set, pirâmide, cluster, 5×5, top + back-off e supersets. Carga por série em kg ou em % da carga máxima. A semana inteira montada, com lembrete automático pro aluno.</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <span style="font-size:13px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-subtle);padding:7px 13px;border-radius:10px;box-shadow:var(--kv-shadow-xs)">Drop-set</span>
          <span style="font-size:13px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-subtle);padding:7px 13px;border-radius:10px;box-shadow:var(--kv-shadow-xs)">Pirâmide</span>
          <span style="font-size:13px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-subtle);padding:7px 13px;border-radius:10px;box-shadow:var(--kv-shadow-xs)">Cluster</span>
          <span style="font-size:13px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-subtle);padding:7px 13px;border-radius:10px;box-shadow:var(--kv-shadow-xs)">5×5</span>
          <span style="font-size:13px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-subtle);padding:7px 13px;border-radius:10px;box-shadow:var(--kv-shadow-xs)">Top + back-off</span>
          <span style="font-size:13px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-subtle);padding:7px 13px;border-radius:10px;box-shadow:var(--kv-shadow-xs)">Supersets</span>
          <span style="font-size:13px;font-weight:600;color:var(--kv-text-primary);background:#fff;border:1px solid var(--kv-border-subtle);padding:7px 13px;border-radius:10px;box-shadow:var(--kv-shadow-xs)">Carga por série</span>
        </div>
      </div>
      <!-- Demo "Cole seu treino" -->
      <div data-reveal="" style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:22px;box-shadow:var(--kv-shadow-lg);overflow:hidden">
        <div style="display:flex;align-items:center;gap:9px;padding:14px 18px;border-bottom:1px solid var(--kv-border-subtle);background:var(--kv-neutral-50)">
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--kv-brand-700);background:var(--kv-brand-50);padding:5px 11px;border-radius:10px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z"/></svg>Cole seu treino</span>
          <span style="font-size:12.5px;color:var(--kv-text-tertiary)">cole o texto → a IA monta o programa</span>
        </div>
        <div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:0">
          <div style="padding:16px 16px;border-right:1px solid var(--kv-border-subtle);background:var(--kv-neutral-50);min-height:248px">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--kv-text-tertiary);margin-bottom:9px">TEXTO COLADO</div>
            <div style="font-family:var(--kv-font-mono);font-size:12.5px;line-height:1.7;color:var(--kv-text-primary);white-space:pre-wrap;min-height:170px"><span data-kv="typed"></span><span style="display:inline-block;width:7px;height:15px;background:var(--kv-brand-600);vertical-align:-2px;animation:kvblink 1s step-end infinite"></span></div>
          </div>
          <div style="padding:16px;min-height:248px">
            <div style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--kv-brand-700);margin-bottom:11px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>IA RECONHECEU</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div data-kv="ex" data-kv-ex="0" style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:12px;box-shadow:var(--kv-shadow-xs);transition:opacity .45s var(--kv-ease-out),transform .45s var(--kv-ease-out);opacity:0;transform:translateY(10px)"><span style="width:26px;height:26px;border-radius:8px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700">1</span><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--kv-text-primary)">Stiff</div><div style="font-size:10.5px;color:var(--kv-text-tertiary)">4 × 10 · posterior</div></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
              <div data-kv="ex" data-kv-ex="1" style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:12px;box-shadow:var(--kv-shadow-xs);transition:opacity .45s var(--kv-ease-out),transform .45s var(--kv-ease-out);opacity:0;transform:translateY(10px)"><span style="width:26px;height:26px;border-radius:8px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700">2</span><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--kv-text-primary)">Mesa flexora</div><div style="font-size:10.5px;color:var(--kv-text-tertiary)">3 × 12 · posterior</div></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
              <div data-kv="ex" data-kv-ex="2" style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:12px;box-shadow:var(--kv-shadow-xs);transition:opacity .45s var(--kv-ease-out),transform .45s var(--kv-ease-out);opacity:0;transform:translateY(10px)"><span style="width:26px;height:26px;border-radius:8px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700">3</span><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--kv-text-primary)">Cadeira flexora</div><div style="font-size:10.5px;color:var(--kv-text-tertiary)">3 × 15 · posterior</div></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
              <div data-kv="ex" data-kv-ex="3" style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:12px;box-shadow:var(--kv-shadow-xs);transition:opacity .45s var(--kv-ease-out),transform .45s var(--kv-ease-out);opacity:0;transform:translateY(10px)"><span style="width:26px;height:26px;border-radius:8px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700">4</span><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--kv-text-primary)">Panturrilha em pé</div><div style="font-size:10.5px;color:var(--kv-text-tertiary)">4 × 20 · panturrilha</div></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ PILAR 3 — SALA DE TREINO ░░░ -->
<section class="sec" style="padding:92px 0">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div class="two-col" style="display:grid;grid-template-columns:1.05fr 1fr;gap:52px;align-items:center">
      <!-- mock: multi-aluno -->
      <div data-reveal="" style="order:0;background:#fff;border:1px solid var(--kv-border-subtle);border-radius:22px;box-shadow:var(--kv-shadow-lg);padding:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:var(--kv-error);animation:kvpulse 2s ease infinite"></span><span style="font-size:13px;font-weight:700;color:var(--kv-text-primary)">Sala de Treino · ao vivo</span></div>
          <span style="font-size:11px;font-weight:600;color:var(--kv-text-tertiary);background:var(--kv-neutral-100);padding:4px 10px;border-radius:10px">4 alunos</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;gap:12px;border:1.5px solid var(--kv-brand-300);background:var(--kv-brand-50);border-radius:14px;padding:12px 14px">
            <span style="width:38px;height:38px;border-radius:10px;background:var(--kv-brand-600);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">ML</span>
            <div style="flex:1"><div style="font-size:13.5px;font-weight:700">Marina Lanza</div><div style="font-size:11px;color:var(--kv-text-secondary)">Supino reto · série 3 de 4</div></div>
            <div style="text-align:right"><div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums">60 kg</div><div style="font-size:10px;color:var(--kv-text-tertiary)">12 reps</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;border:1px solid var(--kv-border-subtle);border-radius:14px;padding:12px 14px">
            <span style="width:38px;height:38px;border-radius:10px;background:var(--kv-neutral-150);color:var(--kv-text-secondary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">RF</span>
            <div style="flex:1"><div style="font-size:13.5px;font-weight:700">Raquel Faria</div><div style="font-size:11px;color:var(--kv-warning)">⏱ descanso · 0:42</div></div>
            <div style="text-align:right"><div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums">40 kg</div><div style="font-size:10px;color:var(--kv-text-tertiary)">10 reps</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;border:1px solid var(--kv-border-subtle);border-radius:14px;padding:12px 14px">
            <span style="width:38px;height:38px;border-radius:10px;background:var(--kv-neutral-150);color:var(--kv-text-secondary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">PT</span>
            <div style="flex:1"><div style="font-size:13.5px;font-weight:700">Pedro Tavares</div><div style="font-size:11px;color:var(--kv-success)">✓ concluiu o treino</div></div>
            <div style="text-align:right"><div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums">8/8</div><div style="font-size:10px;color:var(--kv-text-tertiary)">exercícios</div></div>
          </div>
        </div>
      </div>
      <div data-reveal="">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">Sala de Treino · presencial</div>
        <h2 class="display-xl" style="font-size:38px;font-weight:800;letter-spacing:-0.03em;line-height:1.12;margin:0 0 18px">Acompanhe vários alunos na academia sem trocar de tela.</h2>
        <p style="font-size:16.5px;color:var(--kv-text-secondary);line-height:1.6;margin:0 0 22px">Lance carga, repetição e descanso por aluno. Alterne entre eles num toque e veja, na hora, quem precisa de você.</p>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:13px">
          <li style="display:flex;align-items:center;gap:11px;font-size:15.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600)"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>Lance carga e reps por aluno em segundos</li>
          <li style="display:flex;align-items:center;gap:11px;font-size:15.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600)"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>Alterne entre alunos num único toque</li>
          <li style="display:flex;align-items:center;gap:11px;font-size:15.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600)"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>Veja quem terminou e quem precisa de atenção</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ PILAR 4 — APP DO ALUNO + WATCH ░░░ -->
<section id="para-aluno" class="sec" style="padding:92px 0;background:#fff;border-top:1px solid var(--kv-border-subtle);border-bottom:1px solid var(--kv-border-subtle)">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:52px;align-items:center">
      <div data-reveal="">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">Para o aluno</div>
        <h2 class="display-xl" style="font-size:38px;font-weight:800;letter-spacing:-0.03em;line-height:1.12;margin:0 0 18px">Pro seu aluno, uma experiência premium no bolso e no pulso.</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px">
          <div style="display:flex;gap:10px;align-items:flex-start"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600);flex-shrink:0;margin-top:2px"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg><span style="font-size:14.5px;color:var(--kv-text-primary);line-height:1.4">Cronômetro automático de descanso</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600);flex-shrink:0;margin-top:2px"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg><span style="font-size:14.5px;color:var(--kv-text-primary);line-height:1.4">Cargas já preenchidas do último treino</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600);flex-shrink:0;margin-top:2px"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg><span style="font-size:14.5px;color:var(--kv-text-primary);line-height:1.4">Lembrete de treino no dia certo</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600);flex-shrink:0;margin-top:2px"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg><span style="font-size:14.5px;color:var(--kv-text-primary);line-height:1.4">Funciona sem internet</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600);flex-shrink:0;margin-top:2px"><path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/></svg><span style="font-size:14.5px;color:var(--kv-text-primary);line-height:1.4">Recordes pessoais registrados</span></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--kv-brand-600);flex-shrink:0;margin-top:2px"><path d="M12 10v2.2l1.6 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/><circle cx="12" cy="12" r="6"/></svg><span style="font-size:14.5px;color:var(--kv-text-primary);line-height:1.4">O treino aparece direto no Apple Watch</span></div>
        </div>
        <!-- Strava + Oura -->
        <div style="background:var(--kv-brand-50);border:1px solid var(--kv-brand-200);border-radius:16px;padding:16px 18px;margin-bottom:22px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-brand-700)"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg><span style="font-size:13.5px;font-weight:700;color:var(--kv-brand-800)">Conecta com Strava e Oura</span><span style="font-size:9.5px;font-weight:700;color:#fff;background:var(--kv-brand-600);padding:2px 7px;border-radius:10px">NOVO</span></div>
          <p style="font-size:13.5px;color:var(--kv-brand-900);opacity:0.8;line-height:1.5;margin:0">Puxa os treinos de corrida e os dados de sono e descanso do aluno, pra você enxergar a recuperação dele.</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
          <a href="https://apps.apple.com/br/app/kinevo/id6759053587" style="display:inline-flex;align-items:center;gap:9px;background:#000;color:#fff;padding:10px 18px;border-radius:12px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/></svg><span style="line-height:1.1"><span style="font-size:9px;display:block;opacity:0.8">Baixe na</span><span style="font-size:15px;font-weight:600">App Store</span></span></a>
          <a href="https://play.google.com/store/apps/details?id=com.kinevo.mobile" style="display:inline-flex;align-items:center;gap:9px;background:#000;color:#fff;padding:10px 18px;border-radius:12px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg><span style="line-height:1.1"><span style="font-size:9px;display:block;opacity:0.8">Disponível no</span><span style="font-size:15px;font-weight:600">Google Play</span></span></a>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:16px;font-size:13px;color:var(--kv-text-tertiary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-brand-600)"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>Cards prontos pra Stories: o aluno posta e marca você = divulgação grátis.</div>
      </div>
      <!-- phone + watch mock -->
      <div data-reveal="" style="position:relative;display:flex;justify-content:center;align-items:center;min-height:440px">
        <div id="kvlp-aluno-phone"></div>
        <!-- watch -->
        <div style="position:absolute;right:-16px;bottom:14px"><div id="kvlp-aluno-watch"></div></div>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ GESTÃO DO NEGÓCIO ░░░ -->
<section class="sec" style="padding:92px 0">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="text-align:center;max-width:680px;margin:0 auto 48px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">Sistema completo</div>
      <h2 class="display-xl" style="font-size:40px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0">Não é só treino. É o seu negócio inteiro.</h2>
    </div>
    <div class="biz-grid" data-reveal="" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:20px;padding:28px;box-shadow:var(--kv-shadow-sm)">
        <span style="width:50px;height:50px;border-radius:14px;background:var(--kv-success-soft);color:var(--kv-success);display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:25px;height:25px"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg></span>
        <h3 style="font-size:19px;font-weight:700;margin:0 0 6px">Financeiro sem comissão</h3>
        <div style="display:inline-block;font-size:11px;font-weight:700;color:var(--kv-success);background:var(--kv-success-soft);padding:3px 10px;border-radius:10px;margin-bottom:12px">Kinevo não tira %</div>
        <p style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;margin:0 0 14px">Crie planos, venda assinaturas e cobre por PIX, cartão ou boleto. O Kinevo não cobra comissão — você paga só a tarifa padrão do processador (Asaas).</p>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px">
          <li style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg>Carteira e chaves PIX</li>
          <li style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg>Cobrança recorrente automática</li>
        </ul>
      </div>
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:20px;padding:28px;box-shadow:var(--kv-shadow-sm)">
        <span style="width:50px;height:50px;border-radius:14px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:25px;height:25px"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg></span>
        <h3 style="font-size:19px;font-weight:700;margin:0 0 6px">Agenda</h3>
        <div style="display:inline-block;font-size:11px;font-weight:700;color:var(--kv-brand-700);background:var(--kv-brand-50);padding:3px 10px;border-radius:10px;margin-bottom:12px">Sincroniza com o Google</div>
        <p style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;margin:0 0 14px">Marque sessões e sincronize com o Google Calendar. Tudo num calendário só.</p>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px">
          <li style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-brand-600)"><path d="M20 6 9 17l-5-5"/></svg>Sessões presenciais e online</li>
          <li style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-brand-600)"><path d="M20 6 9 17l-5-5"/></svg>Lembrete automático pro aluno</li>
        </ul>
      </div>
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:20px;padding:28px;box-shadow:var(--kv-shadow-sm)">
        <span style="width:50px;height:50px;border-radius:14px;background:var(--kv-accent-blue-soft);color:var(--kv-accent-blue);display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:25px;height:25px"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg></span>
        <h3 style="font-size:19px;font-weight:700;margin:0 0 6px">Formulários &amp; Avaliações</h3>
        <div style="display:inline-block;font-size:11px;font-weight:700;color:var(--kv-accent-blue);background:var(--kv-accent-blue-soft);padding:3px 10px;border-radius:10px;margin-bottom:12px">Gerados por IA</div>
        <p style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;margin:0 0 14px">Anamnese e check-ins em segundos. Avaliação física com captura de medidas e resultado pro aluno acompanhar.</p>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px">
          <li style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-accent-blue)"><path d="M20 6 9 17l-5-5"/></svg>Anamnese e check-ins</li>
          <li style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--kv-text-primary)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--kv-accent-blue)"><path d="M20 6 9 17l-5-5"/></svg>Evolução de medidas no tempo</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ HISTÓRIA DO FUNDADOR ░░░ -->
<section class="sec" style="padding:92px 0;background:#fff;border-top:1px solid var(--kv-border-subtle)">
  <div style="max-width:1080px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="position:relative;background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:28px;box-shadow:0 24px 60px rgba(80,40,160,0.10);overflow:hidden">
      <div class="biz-grid" style="position:relative;display:grid;grid-template-columns:0.78fr 1.22fr;gap:0;align-items:stretch">
        <div style="position:relative;min-height:380px;background:#18181B">
          <img src="/landing/founder-gustavo.png" alt="Gustavo, personal e fundador do Kinevo" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top"></image-slot>
          <div style="position:absolute;left:20px;bottom:18px;display:flex;align-items:center;gap:10px;background:rgba(13,13,23,0.62);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:7px 14px 7px 8px;z-index:2">
            <span style="width:30px;height:30px;border-radius:50%;background:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff">G</span>
            <span style="font-size:12.5px;font-weight:600;color:#fff">Gustavo · personal &amp; fundador</span>
          </div>
        </div>
        <div style="padding:44px 44px 40px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:16px">Quem faz o Kinevo</div>
          <h2 style="font-size:27px;font-weight:800;letter-spacing:-0.02em;line-height:1.22;margin:0 0 20px;color:var(--kv-text-primary);text-wrap:pretty">"Eu construí o Kinevo porque nenhum sistema dava conta."</h2>
          <div style="display:flex;flex-direction:column;gap:14px;font-size:15.5px;line-height:1.62;color:var(--kv-text-secondary)">
            <p style="margin:0">Sou personal, igual você. Já testei planilha, PDF e vários apps&nbsp; e nunca achei um que me deixasse satisfeito e que de verdade facilitasse o meu dia. Sempre faltava alguma coisa, ou era complicado demais e eu acabava perdendo tempo em vez de ganhar.</p>
            <p style="margin:0">Cansei de me adaptar a ferramenta ruim e resolvi construir a que eu sempre quis usar: que monta o treino rápido, me mostra quem treinou de verdade e me deixa receber sem um app tirando comissão por cima.</p>
            <p style="margin:0">O Kinevo é isso, o sistema que eu queria ter quando comecei. <strong style="color: var(--kv-text-primary); font-weight: 600;">Se ele facilita o meu trabalho, vai facilitar o seu também.</strong></p>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:24px;padding-top:22px;border-top:1px solid var(--kv-border-subtle)">
            <span style="font-family:var(--kv-font-display);font-size:26px;font-weight:800;font-style:italic;letter-spacing:-0.01em;color:var(--kv-brand-700)">Gustavo Prado</span>
            <span style="font-size:13.5px;color:var(--kv-text-tertiary)">fundador do Kinevo <span style="color:var(--kv-text-quaternary)">(e personal, como você)</span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- early adopter band -->
    <div data-reveal="" style="display:flex;flex-wrap:wrap;align-items:center;gap:20px;justify-content:space-between;margin-top:22px;background:var(--kv-brand-50);border:1px solid var(--kv-brand-200);border-radius:22px;padding:24px 28px">
      <div style="display:flex;align-items:flex-start;gap:14px;flex:1;min-width:280px">
        <span style="width:42px;height:42px;border-radius:12px;background:var(--kv-brand-600);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/><path d="M5 21h14"/></svg></span>
        <p style="margin:0;font-size:15.5px;line-height:1.5;color:var(--kv-brand-900)">O Kinevo é novo e está crescendo com os primeiros personais que entraram. <strong style="font-weight:700">Seja um deles</strong> — e ajude a moldar a ferramenta com a gente.</p>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <a href="/signup" style="display:inline-flex;align-items:center;gap:8px;padding:13px 22px;font-size:15px;font-weight:700;color:#fff;background:var(--kv-brand-600);border-radius:10px;box-shadow:var(--kv-shadow-brand-sm);transition:transform .15s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">Começar grátis<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>
        <a href="https://wa.me/" style="display:inline-flex;align-items:center;gap:8px;padding:13px 20px;font-size:15px;font-weight:600;color:var(--kv-brand-700);background:#fff;border:1px solid var(--kv-brand-200);border-radius:10px;transition:background .2s" onmouseover="this.style.background='var(--kv-brand-50)'" onmouseout="this.style.background='#fff'"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>Falar com o Gustavo no WhatsApp</a>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ PREÇOS ░░░ -->
<section id="precos" class="sec" style="padding:92px 0;background:#fff;border-top:1px solid var(--kv-border-subtle);border-bottom:1px solid var(--kv-border-subtle)">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="text-align:center;max-width:680px;margin:0 auto 14px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">Preços</div>
      <h2 class="display-xl" style="font-size:40px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0">Comece de graça. Cresça quando quiser.</h2>
    </div>
    <p data-reveal="" style="text-align:center;color:var(--kv-text-secondary);font-size:16px;line-height:1.55;max-width:620px;margin:0 auto 8px">Todos os planos pagos já vêm com o Assistente de IA completo. O que muda entre eles é quantos créditos de IA você usa por mês.</p>
    <p data-reveal="" style="text-align:center;color:var(--kv-text-tertiary);font-size:14px;margin:0 0 44px">Mensal · comece de graça · cancele quando quiser</p>

    <!-- pricing cards -->
    <div id="kvlp-pricing-slot"></div><p data-reveal="" style="display:flex;align-items:flex-start;gap:8px;max-width:620px;margin:20px auto 0;font-size:12.5px;color:var(--kv-text-tertiary);line-height:1.5;text-align:left"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>Cada ação da IA (montar um treino, analisar um aluno) consome alguns créditos. Renovam todo mês e não acumulam.</p>

    <!-- comparison table -->
    <div class="comp-wrap" data-reveal="" style="margin-top:48px;max-width:920px;margin-left:auto;margin-right:auto">
      <h3 style="text-align:center;font-size:20px;font-weight:700;margin:0 0 22px">Como o Kinevo se compara</h3>
      <div style="border:1px solid var(--kv-border-subtle);border-radius:18px;overflow:hidden;background:#fff;min-width:620px">
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;background:var(--kv-neutral-50);border-bottom:1px solid var(--kv-border-subtle)">
          <div style="padding:14px 18px;font-size:13px;font-weight:600;color:var(--kv-text-tertiary)">Recurso</div>
          <div style="padding:14px;font-size:13px;font-weight:800;color:var(--kv-brand-700);text-align:center;background:var(--kv-brand-50)">Kinevo</div>
          <div style="padding:14px;font-size:13px;font-weight:600;color:var(--kv-text-secondary);text-align:center">Outros apps</div>
          <div style="padding:14px;font-size:13px;font-weight:600;color:var(--kv-text-secondary);text-align:center">Planilha + PDF</div>
        </div>
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;align-items:center">
          <div style="padding:13px 18px;font-size:13.5px;color:var(--kv-text-primary);font-weight:500">Prescrição avançada (drop-set, cluster, 5×5)</div>
          <div style="padding:13px;display:flex;justify-content:center;background:var(--kv-brand-50)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><span style="font-size:12px;color:var(--kv-text-tertiary)">parcial</span></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
        </div>
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;align-items:center;border-top:1px solid var(--kv-border-subtle)">
          <div style="padding:13px 18px;font-size:13.5px;color:var(--kv-text-primary);font-weight:500">Assistente de IA que monta e você aprova</div>
          <div style="padding:13px;display:flex;justify-content:center;background:var(--kv-brand-50)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
        </div>
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;align-items:center;border-top:1px solid var(--kv-border-subtle)">
          <div style="padding:13px 18px;font-size:13.5px;color:var(--kv-text-primary);font-weight:500">Apple Watch no pulso do aluno</div>
          <div style="padding:13px;display:flex;justify-content:center;background:var(--kv-brand-50)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><span style="font-size:12px;color:var(--kv-text-tertiary)">parcial</span></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
        </div>
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;align-items:center;border-top:1px solid var(--kv-border-subtle)">
          <div style="padding:13px 18px;font-size:13.5px;color:var(--kv-text-primary);font-weight:500">Receber sem comissão do Kinevo</div>
          <div style="padding:13px;display:flex;justify-content:center;background:var(--kv-brand-50)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
        </div>
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;align-items:center;border-top:1px solid var(--kv-border-subtle)">
          <div style="padding:13px 18px;font-size:13.5px;color:var(--kv-text-primary);font-weight:500">Funciona sem internet</div>
          <div style="padding:13px;display:flex;justify-content:center;background:var(--kv-brand-50)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><span style="font-size:12px;color:var(--kv-text-tertiary)">parcial</span></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
        </div>
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;align-items:center;border-top:1px solid var(--kv-border-subtle)">
          <div style="padding:13px 18px;font-size:13.5px;color:var(--kv-text-primary);font-weight:500">Conecta com Strava e Oura</div>
          <div style="padding:13px;display:flex;justify-content:center;background:var(--kv-brand-50)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--kv-neutral-300)"><path d="M5 12h14"/></svg></div>
        </div>
        <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;align-items:center;border-top:1px solid var(--kv-border-subtle)">
          <div style="padding:13px 18px;font-size:13.5px;color:var(--kv-text-primary);font-weight:500">Tudo em português, suporte no WhatsApp</div>
          <div style="padding:13px;display:flex;justify-content:center;background:var(--kv-brand-50)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--kv-success)"><path d="M20 6 9 17l-5-5"/></svg></div>
          <div style="padding:13px;display:flex;justify-content:center"><span style="font-size:12px;color:var(--kv-text-tertiary)">parcial</span></div>
          <div style="padding:13px;display:flex;justify-content:center"><span style="font-size:12px;color:var(--kv-text-tertiary)">parcial</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ PROVA QUALITATIVA ░░░ -->
<section class="sec" style="padding:80px 0">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div class="four-col" data-reveal="" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:18px;padding:22px;box-shadow:var(--kv-shadow-xs)"><span style="width:42px;height:42px;border-radius:12px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:13px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:21px;height:21px"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></span><div style="font-size:15px;font-weight:700;margin-bottom:4px">Feito no Brasil</div><div style="font-size:13px;color:var(--kv-text-secondary);line-height:1.5">Em português, pensado pra rotina do personal brasileiro.</div></div>
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:18px;padding:22px;box-shadow:var(--kv-shadow-xs)"><span style="width:42px;height:42px;border-radius:12px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:13px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:21px;height:21px"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg></span><div style="font-size:15px;font-weight:700;margin-bottom:4px">Suporte de gente de verdade</div><div style="font-size:13px;color:var(--kv-text-secondary);line-height:1.5">Fala com a gente direto no WhatsApp.</div></div>
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:18px;padding:22px;box-shadow:var(--kv-shadow-xs)"><span style="width:42px;height:42px;border-radius:12px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:13px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:21px;height:21px"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg></span><div style="font-size:15px;font-weight:700;margin-bottom:4px">Seus dados são seus</div><div style="font-size:13px;color:var(--kv-text-secondary);line-height:1.5">Exporte tudo em CSV quando quiser. Protegidos pela LGPD.</div></div>
      <div style="background:#fff;border:1px solid var(--kv-border-subtle);border-radius:18px;padding:22px;box-shadow:var(--kv-shadow-xs)"><span style="width:42px;height:42px;border-radius:12px;background:var(--kv-brand-50);color:var(--kv-brand-600);display:flex;align-items:center;justify-content:center;margin-bottom:13px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:21px;height:21px"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></span><div style="font-size:15px;font-weight:700;margin-bottom:4px">Sem fidelidade</div><div style="font-size:13px;color:var(--kv-text-secondary);line-height:1.5">Cancele quando quiser, sem multa e sem letra miúda.</div></div>
    </div>
  </div>
</section>

<!-- ░░░ CTA FINAL ░░░ -->
<section class="sec" style="padding:40px 0 96px">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="position:relative;overflow:hidden;background:var(--kv-brand-700);border-radius:32px;padding:64px 32px;text-align:center;color:#fff;box-shadow:var(--kv-shadow-brand)">
      <h2 class="display-xl" style="position:relative;font-size:42px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0 0 14px;color:#fff">Seus alunos merecem mais que uma planilha.</h2>
      <p style="position:relative;font-size:18px;color:rgba(255,255,255,0.85);margin:0 0 30px">E você merece uma ferramenta à altura do seu trabalho.</p>
      <a href="/signup" style="position:relative;display:inline-flex;align-items:center;gap:9px;padding:16px 34px;font-size:17px;font-weight:700;color:var(--kv-brand-700);background:#fff;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,0.18);transition:transform .15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">Criar minha conta grátis<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>
      <p style="position:relative;font-size:13.5px;color:rgba(255,255,255,0.8);margin:18px 0 0">Grátis pra começar · pronto em 1 min · sem fidelidade</p>
      <div style="position:relative;display:flex;justify-content:center;flex-wrap:wrap;gap:20px;margin-top:24px;font-size:13px;color:rgba(255,255,255,0.78)">
        <span style="display:flex;align-items:center;gap:6px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>Pagamento seguro</span>
        <span style="display:flex;align-items:center;gap:6px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>iPhone e Android</span>
        <span style="display:flex;align-items:center;gap:6px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M12 10v2.2l1.6 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/><circle cx="12" cy="12" r="6"/></svg>Apple Watch</span>
      </div>
    </div>
  </div>
</section>

<!-- ░░░ FAQ ░░░ -->
<section id="faq" class="sec" style="padding:40px 0 96px">
  <div style="max-width:780px;margin:0 auto;padding:0 24px">
    <div data-reveal="" style="text-align:center;margin-bottom:40px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--kv-brand-700);margin-bottom:14px">Perguntas frequentes</div>
      <h2 class="display-xl" style="font-size:36px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0">Ainda com dúvida? A gente é honesto.</h2>
    </div>
    <div data-reveal="" style="display:flex;flex-direction:column;gap:12px">
      <details style="background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:14px;padding:0 18px;box-shadow:var(--kv-shadow-xs)">
        <summary style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 0;font-size:15.5px;font-weight:600;color:var(--kv-text-primary)"><span>O Kinevo cobra comissão sobre os pagamentos?</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px;color:var(--kv-text-tertiary);flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;padding:0 0 18px">O Kinevo não cobra comissão sobre o que você recebe dos seus alunos — só a assinatura do plano. A única tarifa que incide é a padrão do processador de pagamentos (Asaas) ao cobrar por PIX, cartão ou boleto — a mesma que você pagaria usando o Asaas direto.</div>
      </details>
      <details style="background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:14px;padding:0 18px;box-shadow:var(--kv-shadow-xs)">
        <summary style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 0;font-size:15.5px;font-weight:600;color:var(--kv-text-primary)"><span>A IA substitui o meu trabalho?</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px;color:var(--kv-text-tertiary);flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;padding:0 0 18px">Não. O Assistente de IA é ferramenta, não substituto. Ele monta rascunhos e adianta o trabalho chato, mas nada vai pro aluno sem o seu OK. Você sempre tem a palavra final.</div>
      </details>
      <details style="background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:14px;padding:0 18px;box-shadow:var(--kv-shadow-xs)">
        <summary style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 0;font-size:15.5px;font-weight:600;color:var(--kv-text-primary)"><span>Funciona pra quem atende presencial e online?</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px;color:var(--kv-text-tertiary);flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;padding:0 0 18px">Sim. Pra presencial tem a Sala de Treino (acompanha vários alunos ao mesmo tempo). Pra online o aluno treina pelo app, com tudo preenchido e lembrete no dia certo.</div>
      </details>
      <details style="background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:14px;padding:0 18px;box-shadow:var(--kv-shadow-xs)">
        <summary style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 0;font-size:15.5px;font-weight:600;color:var(--kv-text-primary)"><span>O Apple Watch funciona de verdade?</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px;color:var(--kv-text-tertiary);flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;padding:0 0 18px">Funciona. O treino aparece direto no relógio do aluno — ele marca a série e vê os batimentos sem precisar tirar o celular do bolso.</div>
      </details>
      <details style="background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:14px;padding:0 18px;box-shadow:var(--kv-shadow-xs)">
        <summary style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 0;font-size:15.5px;font-weight:600;color:var(--kv-text-primary)"><span>E se faltar internet na academia?</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px;color:var(--kv-text-tertiary);flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;padding:0 0 18px">O app funciona sem internet. O aluno treina normalmente e tudo sincroniza sozinho quando a conexão voltar.</div>
      </details>
      <details style="background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:14px;padding:0 18px;box-shadow:var(--kv-shadow-xs)">
        <summary style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 0;font-size:15.5px;font-weight:600;color:var(--kv-text-primary)"><span>Meus dados ficam presos no Kinevo?</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px;color:var(--kv-text-tertiary);flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;padding:0 0 18px">Não. Seus dados são seus: você exporta tudo em CSV quando quiser. Tratamos os dados conforme a LGPD.</div>
      </details>
      <details style="background:var(--kv-surface-card);border:1px solid var(--kv-border-subtle);border-radius:14px;padding:0 18px;box-shadow:var(--kv-shadow-xs)">
        <summary style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 0;font-size:15.5px;font-weight:600;color:var(--kv-text-primary)"><span>Como o Kinevo se compara ao MFIT, Tecnofit ou Trainerize?</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px;color:var(--kv-text-tertiary);flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div style="font-size:14.5px;color:var(--kv-text-secondary);line-height:1.6;padding:0 0 18px">A diferença está na prescrição avançada de verdade, no Assistente de IA que você aprova, no Apple Watch nativo e no recebimento sem taxa — tudo em português e com suporte de gente de verdade.</div>
      </details>
    </div>
  </div>
</section>

<!-- ░░░ FOOTER ░░░ -->
<footer style="background:#111113;color:rgba(255,255,255,0.7);padding:56px 0 32px">
  <div style="max-width:1180px;margin:0 auto;padding:0 24px">
    <div class="two-col" style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:32px;margin-bottom:40px">
      <div>
        <a href="#topo" style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span style="width:34px;height:34px;border-radius:9px;overflow:hidden;display:block"><img src="/logo-icon.png" alt="Kinevo" style="width:100%;height:100%;object-fit:cover"></span>
          <span style="font-weight:800;font-size:19px;color:#fff">Kinevo</span>
        </a>
        <p style="font-size:14px;line-height:1.6;margin:0;max-width:300px;color:rgba(255,255,255,0.55)">O sistema completo para personal trainers — do programa ao pagamento, num lugar só.</p>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:rgba(255,255,255,0.45);text-transform:uppercase;margin-bottom:14px">Produto</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px"><a href="#recursos" style="color:rgba(255,255,255,0.7)">Recursos</a><a href="#precos" style="color:rgba(255,255,255,0.7)">Preços</a><a href="#para-aluno" style="color:rgba(255,255,255,0.7)">Para o aluno</a><a href="#como-funciona" style="color:rgba(255,255,255,0.7)">Como funciona</a></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:rgba(255,255,255,0.45);text-transform:uppercase;margin-bottom:14px">Empresa</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px"><a href="#faq" style="color:rgba(255,255,255,0.7)">FAQ</a><a href="https://wa.me/" style="color:rgba(255,255,255,0.7)">Suporte (WhatsApp)</a><a href="https://instagram.com/kinevo.app" style="color:rgba(255,255,255,0.7)">@kinevo.app</a></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:rgba(255,255,255,0.45);text-transform:uppercase;margin-bottom:14px">Legal</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px"><a href="#" style="color:rgba(255,255,255,0.7)">Termos de uso</a><a href="#" style="color:rgba(255,255,255,0.7)">Privacidade</a><a href="#" style="color:rgba(255,255,255,0.7)">LGPD</a></div>
      </div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;font-size:13px;color:rgba(255,255,255,0.45)">
      <span>© 2026 Kinevo. Feito no Brasil. 🇧🇷</span>
      <div style="display:flex;gap:18px"><a href="https://wa.me/" style="color:rgba(255,255,255,0.6)">WhatsApp</a><a href="https://instagram.com/kinevo.app" style="color:rgba(255,255,255,0.6)">Instagram</a></div>
    </div>
  </div>
</footer>

</div>`
