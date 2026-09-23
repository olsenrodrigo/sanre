"""
Reconstrói a logomarca SANRÊ ÓTICAS em vetor.

Fonte da verdade: insumos/PHOTO-2026-07-27-21-33-07.jpg (arte enviada pela loja)
e o manual da marca (tipografia oficial: Montserrat). A foto é raster de 1280 px;
aqui cada letra vem do contorno REAL da Montserrat (variável, eixo wght) e é
posicionada pelas medidas da foto — a marca não depende de webfont carregar.

Medidas tiradas da foto (px):
  SANRÊ   altura de caixa 132 (E: 311→442), haste do E 16  → wght ≈ 440
          esquerda de cada letra: S 239, A 393, N 588, R 774, E 942
  ÓTICAS  altura de caixa 50 (T: 498→547), haste do T 7   → wght ≈ 500
          esquerda: Ó 440, T 526, I 603, C 648, A 726, S 807
  fios    239→406 e 877→1040, espessura 5, centro y 523

Uso: python3 script/marca/gerar_logo.py <Montserrat[wght].ttf> <saida_dir>
"""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

VF, OUT = sys.argv[1], sys.argv[2]

def instancia(w):
    return instantiateVariableFont(TTFont(VF), {"wght": w})

def glifo(font, ch):
    gs = font.getGlyphSet(); nome = font.getBestCmap()[ord(ch)]
    bp = BoundsPen(gs); gs[nome].draw(bp)
    return gs, nome, bp.bounds

def caminho(font, ch, x_esq, base_y, escala):
    """Contorno do glifo com a borda esquerda do desenho em x_esq e a linha de base em base_y."""
    gs, nome, (xmin, ymin, xmax, ymax) = glifo(font, ch)
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    # y do font cresce para cima; no SVG para baixo
    t = TransformPen(pen, (escala, 0, 0, -escala, x_esq - xmin * escala, base_y))
    gs[nome].draw(t)
    return pen.getCommands(), (x_esq, base_y - ymax * escala, x_esq + (xmax - xmin) * escala, base_y - ymin * escala)

f1, f2 = instancia(440), instancia(500)
CAP = 700  # sCapHeight da Montserrat
s1 = 132 / CAP
s2 = 50 / CAP
base1, base2 = 442, 548

partes, caixas = [], []
for ch, x in zip("SANRÊ", [239, 393, 588, 774, 942]):
    d, bb = caminho(f1, ch, x, base1, s1); partes.append(d); caixas.append((ch, bb))
for ch, x in zip("ÓTICAS", [440, 526, 603, 648, 726, 807]):
    d, bb = caminho(f2, ch, x, base2, s2); partes.append(d); caixas.append((ch, bb))

# Fios laterais do "ÓTICAS" (retângulos)
fio_y, fio_h = 523 - 2.5, 5
fios = [(239, 406), (877, 1040)]
for (a, b) in fios:
    partes.append(f"M{a} {fio_y}H{b}V{fio_y + fio_h}H{a}Z")

# Caixa total e normalização para a origem com margem zero
xs = [bb[0] for _, bb in caixas] + [bb[2] for _, bb in caixas] + [239, 1040]
ys = [bb[1] for _, bb in caixas] + [bb[3] for _, bb in caixas]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
W, H = x1 - x0, y1 - y0
print("caixas:", json.dumps([(c, [round(v, 1) for v in bb]) for c, bb in caixas], ensure_ascii=False))
print(f"viewBox 0 0 {W:.1f} {H:.1f}")

d_total = " ".join(partes)

def svg(cor, arquivo, titulo="Óticas Sanrê"):
    conteudo = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {W:.2f} {H:.2f}" '
        f'role="img" aria-label="{titulo}"><title>{titulo}</title>'
        f'<path fill="{cor}" d="{d_total}"/></svg>'
    )
    open(f"{OUT}/{arquivo}", "w").write(conteudo)

svg("#141414", "logo-sanre.svg")
svg("#ffffff", "logo-sanre-branco.svg")
svg("#998f7c", "logo-sanre-nude.svg")

# Só a palavra SANRÊ (espaços apertados, ex.: selo)
d_palavra = " ".join(partes[:5])
bb5 = [bb for c, bb in caixas[:5]]
px0, py0 = min(b[0] for b in bb5), min(b[1] for b in bb5)
px1, py1 = max(b[2] for b in bb5), max(b[3] for b in bb5)
open(f"{OUT}/palavra-sanre.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{px0:.2f} {py0:.2f} {px1-px0:.2f} {py1-py0:.2f}" role="img" aria-label="Sanrê">'
    f'<title>Sanrê</title><path fill="#141414" d="{d_palavra}"/></svg>')

# Dados para o componente React (paths inline com currentColor)
json.dump({"viewBox": [round(x0, 2), round(y0, 2), round(W, 2), round(H, 2)], "d": d_total,
           "palavra": {"viewBox": [round(px0, 2), round(py0, 2), round(px1 - px0, 2), round(py1 - py0, 2)], "d": d_palavra}},
          open(f"{OUT}/logo.json", "w"))

# Ícone: "S" da marca em branco sobre quadrado preto, com o fio nude embaixo
# Peso maior só no ícone: em 16–32 px a haste de 440 some.
f_ic = instancia(600)
gsS, nomeS, (sx0, sy0, sx1, sy1) = glifo(f_ic, "S")
esc = 330 / CAP
larg = (sx1 - sx0) * esc
dS, _ = caminho(f_ic, "S", 256 - larg / 2, 256 + 165 - 24, esc)
icone = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
    '<rect width="512" height="512" fill="#141414"/>'
    f'<path fill="#ffffff" d="{dS}"/>'
    '<rect x="176" y="414" width="160" height="18" fill="#b8a98f"/>'
    '</svg>'
)
open(f"{OUT}/icone-sanre.svg", "w").write(icone)
print("ok")
