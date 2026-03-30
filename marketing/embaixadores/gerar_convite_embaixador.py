"""
Kinevo Ambassador Invitation — Premium PDF
Design: "Violet Gravity" — dark, premium, geometric precision with a bold violet accent system.
"""

import math
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, Color, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import sys

# ── CONFIG ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AMBASSADOR_NAME = sys.argv[1] if len(sys.argv) > 1 else "Nome do Treinador"
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SCRIPT_DIR, "convites", "Convite_Embaixador_Kinevo.pdf")

# ── COLORS ──────────────────────────────────────────────
DARK_BG        = HexColor("#0D0B14")
DARK_CARD      = HexColor("#13111C")
VIOLET_PRIMARY = HexColor("#8B5CF6")
VIOLET_LIGHT   = HexColor("#A855F7")
VIOLET_GLOW    = HexColor("#C084FC")
VIOLET_SUBTLE  = HexColor("#2D2640")
GOLD_ACCENT    = HexColor("#D4AF37")
TEXT_WHITE      = HexColor("#F8F8FC")
TEXT_MUTED      = HexColor("#9B97A8")
TEXT_DIM        = HexColor("#6B6780")
BORDER_SUBTLE  = HexColor("#1E1A2E")

# ── FONTS ───────────────────────────────────────────────
# Fontes — ajuste este path para o diretório com as fontes .ttf no seu sistema
FONT_DIR = os.environ.get("KINEVO_FONTS_DIR", os.path.join(SCRIPT_DIR, "assets", "fonts")) + "/"

pdfmetrics.registerFont(TTFont("Outfit", FONT_DIR + "Outfit-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Outfit-Bold", FONT_DIR + "Outfit-Bold.ttf"))
pdfmetrics.registerFont(TTFont("InstrumentSerif-Italic", FONT_DIR + "InstrumentSerif-Italic.ttf"))
pdfmetrics.registerFont(TTFont("InstrumentSerif", FONT_DIR + "InstrumentSerif-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Italiana", FONT_DIR + "Italiana-Regular.ttf"))
pdfmetrics.registerFont(TTFont("DMMono", FONT_DIR + "DMMono-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Jura-Light", FONT_DIR + "Jura-Light.ttf"))
pdfmetrics.registerFont(TTFont("WorkSans", FONT_DIR + "WorkSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("WorkSans-Bold", FONT_DIR + "WorkSans-Bold.ttf"))

W, H = A4  # 210 x 297 mm
cx, cy = W / 2, H / 2

def draw_gradient_rect(c, x, y, w, h, color_top, color_bottom, steps=60):
    """Vertical gradient fill"""
    step_h = h / steps
    for i in range(steps):
        t = i / steps
        r = color_top.red + (color_bottom.red - color_top.red) * t
        g = color_top.green + (color_bottom.green - color_top.green) * t
        b = color_top.blue + (color_bottom.blue - color_top.blue) * t
        c.setFillColor(Color(r, g, b))
        c.rect(x, y + h - (i + 1) * step_h, w, step_h + 0.5, stroke=0, fill=1)

def draw_glow_circle(c, x, y, radius, color, alpha_start=0.12, steps=20):
    """Soft radial glow effect"""
    for i in range(steps):
        t = i / steps
        r = radius * (1 - t * 0.8)
        alpha = alpha_start * (1 - t)
        c.setFillColor(Color(color.red, color.green, color.blue, alpha))
        c.circle(x, y, r, stroke=0, fill=1)

def draw_geometric_pattern(c, x_start, y_start, cols, rows, spacing, size):
    """Draw subtle geometric diamond grid"""
    for row in range(rows):
        for col in range(cols):
            px = x_start + col * spacing
            py = y_start + row * spacing
            # Diamond shape
            c.setStrokeColor(Color(0.55, 0.36, 0.96, 0.06))
            c.setLineWidth(0.3)
            half = size / 2
            p = c.beginPath()
            p.moveTo(px, py + half)
            p.lineTo(px + half, py)
            p.lineTo(px, py - half)
            p.lineTo(px - half, py)
            p.close()
            c.drawPath(p, stroke=1, fill=0)

def draw_line_accent(c, x, y, length, color, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x, y, x + length, y)

# ── CREATE PDF ──────────────────────────────────────────
c = canvas.Canvas(OUTPUT, pagesize=A4)
c.setTitle("Convite Embaixador Kinevo")
c.setAuthor("Kinevo")

# ═══════════════════════════════════════════════════════
#  PAGE 1 — COVER
# ═══════════════════════════════════════════════════════

# Background
c.setFillColor(DARK_BG)
c.rect(0, 0, W, H, stroke=0, fill=1)

# Subtle geometric pattern across the page
draw_geometric_pattern(c, 20*mm, 20*mm, 12, 18, 16*mm, 8*mm)

# Top glow
draw_glow_circle(c, cx, H - 80*mm, 120*mm, VIOLET_PRIMARY, alpha_start=0.08)

# Thin gold line at very top
draw_line_accent(c, 30*mm, H - 18*mm, W - 60*mm, GOLD_ACCENT, 0.6)

# "CONVITE EXCLUSIVO" — small caps tracking
c.setFillColor(GOLD_ACCENT)
c.setFont("DMMono", 9)
label = "C O N V I T E   E X C L U S I V O"
c.drawCentredString(cx, H - 35*mm, label)

# Small gold diamond ornament
diamond_y = H - 42*mm
c.setStrokeColor(GOLD_ACCENT)
c.setLineWidth(0.4)
p = c.beginPath()
p.moveTo(cx, diamond_y + 3*mm)
p.lineTo(cx + 3*mm, diamond_y)
p.lineTo(cx, diamond_y - 3*mm)
p.lineTo(cx - 3*mm, diamond_y)
p.close()
c.drawPath(p, stroke=1, fill=0)

# KINEVO wordmark — large
c.setFillColor(TEXT_WHITE)
c.setFont("Outfit-Bold", 52)
c.drawCentredString(cx, H - 72*mm, "KINEVO")

# Violet underline accent
draw_line_accent(c, cx - 40*mm, H - 77*mm, 80*mm, VIOLET_PRIMARY, 1.5)

# Tagline
c.setFillColor(TEXT_MUTED)
c.setFont("InstrumentSerif-Italic", 14)
c.drawCentredString(cx, H - 88*mm, "Programa de Embaixadores")

# ── Central card area ──
card_x = 25*mm
card_y = 52*mm
card_w = W - 50*mm
card_h = 140*mm

# Card background with subtle border
c.setFillColor(Color(0.075, 0.067, 0.11, 0.85))
c.roundRect(card_x, card_y, card_w, card_h, 4*mm, stroke=0, fill=1)
c.setStrokeColor(VIOLET_SUBTLE)
c.setLineWidth(0.5)
c.roundRect(card_x, card_y, card_w, card_h, 4*mm, stroke=1, fill=0)

# Glow behind card
draw_glow_circle(c, cx, card_y + card_h / 2, 70*mm, VIOLET_PRIMARY, alpha_start=0.05)

# Inside card content
inner_top = card_y + card_h - 15*mm

# "Prezado(a)" label
c.setFillColor(TEXT_DIM)
c.setFont("WorkSans", 9)
c.drawCentredString(cx, inner_top, "Prezado(a)")

# Ambassador name — hero treatment
c.setFillColor(TEXT_WHITE)
# Dynamically size the font based on name length
name_font_size = 32
if len(AMBASSADOR_NAME) > 20:
    name_font_size = 26
if len(AMBASSADOR_NAME) > 30:
    name_font_size = 22
c.setFont("Italiana", name_font_size)
c.drawCentredString(cx, inner_top - 18*mm, AMBASSADOR_NAME)

# Decorative line under name
draw_line_accent(c, cx - 30*mm, inner_top - 23*mm, 60*mm, VIOLET_LIGHT, 0.8)

# Invitation text
c.setFillColor(TEXT_MUTED)
c.setFont("WorkSans", 10.5)
lines = [
    "Voc\u00ea foi selecionado(a) para integrar o",
    "programa exclusivo de Embaixadores Kinevo.",
    "",
    "Reconhecemos seu trabalho e dedica\u00e7\u00e3o como",
    "treinador(a) e gostar\u00edamos de t\u00ea-lo(a)",
    "como parte do nosso time."
]
y_text = inner_top - 38*mm
for line in lines:
    if line:
        c.drawCentredString(cx, y_text, line)
    y_text -= 5*mm

# Seal / badge at bottom of card
seal_y = card_y + 18*mm
c.setStrokeColor(GOLD_ACCENT)
c.setLineWidth(0.6)
c.circle(cx, seal_y, 10*mm, stroke=1, fill=0)
c.circle(cx, seal_y, 8.5*mm, stroke=1, fill=0)
c.setFillColor(GOLD_ACCENT)
c.setFont("DMMono", 6.5)
c.drawCentredString(cx, seal_y + 2*mm, "EMBAIXADOR")
c.drawCentredString(cx, seal_y - 3.5*mm, "KINEVO")

# Bottom line
draw_line_accent(c, 30*mm, 35*mm, W - 60*mm, BORDER_SUBTLE, 0.4)

# Footer
c.setFillColor(TEXT_DIM)
c.setFont("DMMono", 7)
c.drawCentredString(cx, 25*mm, "CONFIDENCIAL  |  2026  |  KINEVOAPP.COM")

c.showPage()

# ═══════════════════════════════════════════════════════
#  PAGE 2 — BENEFITS & DETAILS
# ═══════════════════════════════════════════════════════

# Background
c.setFillColor(DARK_BG)
c.rect(0, 0, W, H, stroke=0, fill=1)

# Subtle pattern (lighter)
draw_geometric_pattern(c, 20*mm, 20*mm, 12, 18, 16*mm, 8*mm)

# Top accent
draw_line_accent(c, 30*mm, H - 18*mm, W - 60*mm, VIOLET_SUBTLE, 0.4)

# Header
c.setFillColor(VIOLET_LIGHT)
c.setFont("DMMono", 8)
c.drawCentredString(cx, H - 30*mm, "O  Q U E  V O C \u00ca  R E C E B E")

c.setFillColor(TEXT_WHITE)
c.setFont("Outfit-Bold", 28)
c.drawCentredString(cx, H - 44*mm, "Benef\u00edcios Exclusivos")

draw_line_accent(c, cx - 25*mm, H - 49*mm, 50*mm, VIOLET_PRIMARY, 1)

# Benefits list
benefits = [
    ("Acesso Pro Gratuito", "Plano completo do Kinevo sem custo, enquanto for embaixador"),
    ("Onboarding VIP", "Suporte direto da equipe para configurar tudo do seu jeito"),
    ("Acesso Antecipado", "Seja o primeiro a testar novos recursos antes do lan\u00e7amento"),
    ("Selo de Embaixador", "Badge exclusivo para usar no perfil e conte\u00fados"),
    ("Comunidade Fechada", "Networking com outros treinadores embaixadores"),
    ("Monetiza\u00e7\u00e3o por Indica\u00e7\u00e3o", "Ganhe comiss\u00e3o por cada treinador que assinar pelo seu link"),
]

y_pos = H - 66*mm
for i, (title, desc) in enumerate(benefits):
    item_y = y_pos - i * 23*mm

    # Number circle
    c.setFillColor(VIOLET_PRIMARY)
    c.circle(38*mm, item_y + 2*mm, 4*mm, stroke=0, fill=1)
    c.setFillColor(TEXT_WHITE)
    c.setFont("Outfit-Bold", 10)
    c.drawCentredString(38*mm, item_y, str(i + 1))

    # Title
    c.setFillColor(TEXT_WHITE)
    c.setFont("WorkSans-Bold", 12)
    c.drawString(48*mm, item_y + 2*mm, title)

    # Description
    c.setFillColor(TEXT_MUTED)
    c.setFont("WorkSans", 9.5)
    c.drawString(48*mm, item_y - 6*mm, desc)

    # Subtle separator
    if i < len(benefits) - 1:
        draw_line_accent(c, 48*mm, item_y - 10*mm, W - 78*mm, BORDER_SUBTLE, 0.3)

# ── "O que pedimos" section ──
section2_y = y_pos - len(benefits) * 23*mm - 2*mm

c.setFillColor(VIOLET_LIGHT)
c.setFont("DMMono", 8)
c.drawCentredString(cx, section2_y + 5*mm, "S E U  C O M P R O M I S S O")

c.setFillColor(TEXT_WHITE)
c.setFont("Outfit-Bold", 20)
c.drawCentredString(cx, section2_y - 10*mm, "Simples e Aut\u00eantico")

draw_line_accent(c, cx - 20*mm, section2_y - 14*mm, 40*mm, VIOLET_PRIMARY, 0.8)

commitments = [
    "2 Stories por m\u00eas mostrando o Kinevo no seu dia a dia",
    "1 Post ou Reel/TikTok por m\u00eas (liberdade criativa total)",
    "Mencionar @kinevo.app quando for natural e relevante",
]

c.setFillColor(TEXT_MUTED)
c.setFont("WorkSans", 10)
y_commit = section2_y - 26*mm
for item in commitments:
    # Violet dot
    c.setFillColor(VIOLET_PRIMARY)
    c.circle(35*mm, y_commit + 1.5*mm, 1.5*mm, stroke=0, fill=1)
    c.setFillColor(TEXT_MUTED)
    c.setFont("WorkSans", 10)
    c.drawString(42*mm, y_commit, item)
    y_commit -= 8*mm

# Emphasis note
c.setFillColor(TEXT_DIM)
c.setFont("InstrumentSerif-Italic", 10)
c.drawCentredString(cx, y_commit - 6*mm, "Sem script. Sem obriga\u00e7\u00e3o. Apenas autenticidade.")

# Bottom line
draw_line_accent(c, 30*mm, 20*mm, W - 60*mm, BORDER_SUBTLE, 0.4)

# Footer
c.setFillColor(TEXT_DIM)
c.setFont("DMMono", 7)
c.drawCentredString(cx, 12*mm, "CONFIDENCIAL  |  2026  |  KINEVOAPP.COM")

c.showPage()

# ═══════════════════════════════════════════════════════
#  PAGE 3 — CTA / ACCEPTANCE
# ═══════════════════════════════════════════════════════

# Background
c.setFillColor(DARK_BG)
c.rect(0, 0, W, H, stroke=0, fill=1)

# Pattern
draw_geometric_pattern(c, 20*mm, 20*mm, 12, 18, 16*mm, 8*mm)

# Large central glow
draw_glow_circle(c, cx, cy + 30*mm, 100*mm, VIOLET_PRIMARY, alpha_start=0.06)

# Top accent
draw_line_accent(c, 30*mm, H - 18*mm, W - 60*mm, GOLD_ACCENT, 0.5)

# Quote section
c.setFillColor(TEXT_DIM)
c.setFont("InstrumentSerif-Italic", 12)
c.drawCentredString(cx, H - 45*mm, "\"O melhor marketing \u00e9 um produto incr\u00edvel")
c.drawCentredString(cx, H - 53*mm, "nas m\u00e3os das pessoas certas.\"")

draw_line_accent(c, cx - 15*mm, H - 62*mm, 30*mm, VIOLET_SUBTLE, 0.6)

# Main CTA area
c.setFillColor(TEXT_WHITE)
c.setFont("Outfit-Bold", 36)
c.drawCentredString(cx, H - 90*mm, "Aceite o Convite")

c.setFillColor(VIOLET_LIGHT)
c.setFont("InstrumentSerif-Italic", 16)
c.drawCentredString(cx, H - 102*mm, "e fa\u00e7a parte do futuro do treino personalizado")

# CTA Button
btn_w = 70*mm
btn_h = 14*mm
btn_x = cx - btn_w / 2
btn_y = H - 130*mm

# Button glow
draw_glow_circle(c, cx, btn_y + btn_h / 2, 40*mm, VIOLET_PRIMARY, alpha_start=0.1)

# Button fill
c.setFillColor(VIOLET_PRIMARY)
c.roundRect(btn_x, btn_y, btn_w, btn_h, 3*mm, stroke=0, fill=1)

c.setFillColor(TEXT_WHITE)
c.setFont("Outfit-Bold", 13)
c.drawCentredString(cx, btn_y + 4.5*mm, "QUERO SER EMBAIXADOR")

# Instruction below button
c.setFillColor(TEXT_WHITE)
c.setFont("WorkSans", 10)
c.drawCentredString(cx, btn_y - 12*mm, "Responda a este convite para confirmar sua participa\u00e7\u00e3o")

# Divider
draw_line_accent(c, cx - 30*mm, btn_y - 28*mm, 60*mm, VIOLET_SUBTLE, 0.5)

# Next steps
steps_y = btn_y - 40*mm
c.setFillColor(TEXT_MUTED)
c.setFont("DMMono", 7.5)
c.drawCentredString(cx, steps_y + 12*mm, "P R \u00d3 X I M O S  P A S S O S")

next_steps = [
    "1. Responda confirmando seu interesse",
    "2. Agendaremos seu onboarding exclusivo",
    "3. Configuramos sua conta Pro gratuita",
    "4. Voc\u00ea come\u00e7a a usar e compartilhar!",
]

c.setFont("WorkSans", 9.5)
for i, step in enumerate(next_steps):
    c.setFillColor(TEXT_MUTED)
    c.drawCentredString(cx, steps_y - i * 7*mm, step)

# Signature area
sig_y = 60*mm
draw_line_accent(c, 30*mm, sig_y + 10*mm, W - 60*mm, BORDER_SUBTLE, 0.3)

c.setFillColor(TEXT_WHITE)
c.setFont("Italiana", 18)
c.drawCentredString(cx, sig_y - 2*mm, "Gustavo Prado")

c.setFillColor(TEXT_DIM)
c.setFont("WorkSans", 8.5)
c.drawCentredString(cx, sig_y - 11*mm, "Fundador & CEO, Kinevo")

# Logo
from reportlab.lib.utils import ImageReader
logo_path = os.path.join(SCRIPT_DIR, "assets", "logo-rounded.png")
try:
    logo_size = 14*mm
    c.drawImage(logo_path, cx - logo_size/2, 28*mm, width=logo_size, height=logo_size, mask='auto')
except:
    pass  # Fallback: skip logo if file not found

# Bottom line
draw_line_accent(c, 30*mm, 22*mm, W - 60*mm, BORDER_SUBTLE, 0.3)
c.setFillColor(TEXT_DIM)
c.setFont("DMMono", 6)
c.drawCentredString(cx, 14*mm, "KINEVOAPP.COM")

c.save()
print(f"PDF created: {OUTPUT}")
print(f"Ambassador name: {AMBASSADOR_NAME}")
