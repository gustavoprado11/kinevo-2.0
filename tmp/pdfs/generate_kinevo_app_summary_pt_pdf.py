from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUTPUT_PDF = Path("output/pdf/kinevo_app_summary_pt.pdf")
PREVIEW_PNG = Path("tmp/pdfs/kinevo_app_summary_pt_preview.png")

PAGE_WIDTH = 1654  # A4 at ~200 DPI
PAGE_HEIGHT = 2339
MARGIN_X = 95
MARGIN_TOP = 95
MARGIN_BOTTOM = 95
MAX_TEXT_WIDTH = PAGE_WIDTH - (2 * MARGIN_X)


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    if bold:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        ]

    for path in candidates:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size=size)

    return ImageFont.load_default()


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]

    for word in words[1:]:
        trial = f"{current} {word}"
        trial_width = draw.textbbox((0, 0), trial, font=font)[2]
        if trial_width <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word

    lines.append(current)
    return lines


def build_pdf() -> None:
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), "white")
    draw = ImageDraw.Draw(image)

    title_font = _load_font(56, bold=True)
    heading_font = _load_font(37, bold=True)
    body_font = _load_font(28, bold=False)

    text_color = "#111111"
    heading_color = "#1F3A56"
    title_color = "#0E2235"

    y = MARGIN_TOP

    title = "Resumo do App Kinevo (baseado no repositório)"
    draw.text((MARGIN_X, y), title, font=title_font, fill=title_color)
    y += 86

    def add_heading(text: str) -> None:
        nonlocal y
        draw.text((MARGIN_X, y), text, font=heading_font, fill=heading_color)
        y += 52

    def add_paragraph(text: str) -> None:
        nonlocal y
        lines = _wrap_text(draw, text, body_font, MAX_TEXT_WIDTH)
        for line in lines:
            draw.text((MARGIN_X, y), line, font=body_font, fill=text_color)
            y += 39

    def add_bullet(text: str) -> None:
        nonlocal y
        bullet_prefix = "- "
        bullet_indent = 42

        lines = _wrap_text(
            draw,
            text,
            body_font,
            MAX_TEXT_WIDTH - bullet_indent,
        )
        if not lines:
            return

        draw.text((MARGIN_X, y), bullet_prefix + lines[0], font=body_font, fill=text_color)
        y += 39
        for line in lines[1:]:
            draw.text((MARGIN_X + bullet_indent, y), line, font=body_font, fill=text_color)
            y += 39

    add_heading("O que é")
    add_paragraph(
        "Kinevo é um monorepo SaaS de treino com aplicação Web para treinadores e app Mobile para alunos."
    )
    add_paragraph(
        "O repositório mostra integração com Supabase, módulo financeiro com Stripe e pacote compartilhado de tipos."
    )
    y += 14

    add_heading("Para quem é")
    add_paragraph(
        "Persona primária: treinadores e personal trainers que gerenciam alunos e prescrevem treinos no painel Web."
    )
    y += 14

    add_heading("O que faz")
    for item in [
        "Autenticação e proteção de rotas no Web com Supabase Auth e middleware.",
        "Gestão de alunos, programas e biblioteca de exercícios no painel do treinador.",
        "Execução de treino em sala de treino com carga anterior e registro de séries.",
        "Módulo de formulários com templates, inbox e geração com IA com fallback heurístico.",
        "Módulo financeiro com planos, assinaturas, checkout e webhooks Stripe.",
        "App Mobile para aluno com Home, treino, histórico, inbox e perfil.",
        "Integração com Apple Watch e Live Activity no workspace mobile.",
    ]:
        add_bullet(item)
    y += 10

    add_heading("Como funciona (arquitetura compacta)")
    for item in [
        "Frontends: Next.js (web/src/app) para treinador e Expo Router (mobile/app) para aluno.",
        "Backend: Supabase (Auth + banco + RLS) evidenciado por clientes Supabase e migrações SQL em supabase/migrations.",
        "Serviços: Stripe via API routes/actions em web/src/app/api e web/src/actions/financial; OpenAI em web/src/actions/forms.",
        "Contrato compartilhado: pacote @kinevo/shared com tipos e utilitários usados por Web e Mobile.",
        "Fluxo: treinador prescreve no Web -> dados no Supabase -> aluno executa no Mobile/Watch -> logs retornam ao Supabase -> Web consulta resultados.",
        "Diagrama oficial de arquitetura end-to-end: Not found in repo.",
    ]:
        add_bullet(item)
    y += 10

    add_heading("Como rodar (mínimo)")
    for item in [
        "Na raiz do monorepo: npm install",
        "Web: cp web/.env.example web/.env.local e preencher chaves Supabase, OpenAI e outras necessárias.",
        "Banco: executar pelo menos supabase/migrations/001_initial_schema.sql no SQL Editor do Supabase (conforme web/README.md).",
        "Subir Web: npm run web (atalho para npm run dev --workspace=web).",
        "Mobile: criar mobile/.env com EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY; depois npm run mobile.",
        "Guia único oficial para bootstrap completo (web + mobile + todas as migrações): Not found in repo.",
    ]:
        add_bullet(item)

    if y > (PAGE_HEIGHT - MARGIN_BOTTOM):
        raise RuntimeError(f"Conteúdo excedeu uma página (y final={y}).")

    image.save(PREVIEW_PNG, format="PNG")
    image.save(OUTPUT_PDF, format="PDF", resolution=200.0)

    print(f"PDF gerado: {OUTPUT_PDF.resolve()}")
    print(f"Preview PNG: {PREVIEW_PNG.resolve()}")
    print(f"y final: {y}")


if __name__ == "__main__":
    build_pdf()
