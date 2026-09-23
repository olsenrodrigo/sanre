"""
Prepara o catálogo-semente de óculos para o seed.

Entrada: a pesquisa de produtos reais (fora do repo, em ../insumos/catalogo-web/):
  catalogo.json  — um item por produto/cor (marca, código, formato, material,
                   lente, medidas, preço de referência, fontes)
  imagens/       — vistas "frente", "tres-quartos" e "modelo" baixadas das
                   fontes (CDNs de fabricante e varejistas)

Saída (no repo):
  uploads/produtos/oc-<slug>-<n>.webp    fotos da vitrine (fundo branco,
                                          funde no pedestal por multiply)
  uploads/produtos/oc-<slug>-modelo.webp  foto no rosto (ocupa o pedestal)
  uploads/produtos/oc-<slug>-tryon.png   vista frontal SEM sombra de estúdio,
                                          recortada — é o que o provador em RA
                                          desenha no rosto
  script/catalogo-oculos.json            o que o script/seed.ts grava no banco

Uso: python3 script/marca/preparar_catalogo.py ../insumos/catalogo-web
"""
import json
import sys
import unicodedata
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = Path(sys.argv[1]).resolve()
DESTINO_IMG = RAIZ / "uploads" / "produtos"
DESTINO_JSON = RAIZ / "script" / "catalogo-oculos.json"
DESTINO_IMG.mkdir(parents=True, exist_ok=True)

FORMATOS = {"aviador", "redondo", "quadrado", "retangular", "gatinho", "hexagonal", "oval",
            "mascara", "esportivo", "browline", "geometrico"}
SINONIMOS_FORMATO = {
    "piloto": "aviador", "aviator": "aviador", "gota": "aviador",
    "cat-eye": "gatinho", "cat eye": "gatinho", "gatinho/cat-eye": "gatinho",
    "wayfarer": "quadrado", "quadrada": "quadrado", "retangulo": "retangular",
    "clubmaster": "browline", "escudo": "mascara", "máscara": "mascara", "shield": "mascara",
    "wrap": "esportivo", "envolvente": "esportivo", "sport": "esportivo",
    "octogonal": "geometrico", "geométrico": "geometrico", "irregular": "geometrico",
    "borboleta": "gatinho", "oversized": "quadrado", "panto": "redondo", "pantos": "redondo",
}
MATERIAIS = {"acetato", "metal", "titanio", "injetado", "tr90", "misto", "policarbonato"}
SINONIMOS_MATERIAL = {
    "titânio": "titanio", "tr-90": "tr90", "tr 90": "tr90", "nylon": "injetado", "propionato": "injetado",
    "plástico": "injetado", "plastico": "injetado", "o matter": "injetado", "o-matter": "injetado",
    "acetato e metal": "misto", "metal e acetato": "misto", "aço": "metal", "aco": "metal",
    "bio-acetato": "acetato", "bioacetato": "acetato", "nylon/injetado": "injetado",
}
PUBLICOS = {"feminino", "masculino", "unissex", "infantil"}

# Curadoria da home: um "rosto" de cada grife forte, na ordem em que aparecem.
MARCAS_DESTAQUE = ["Ray-Ban", "Prada", "Gucci", "Tom Ford", "Oakley", "Valentino", "Carrera", "Ana Hickmann",
                   "Michael Kors", "Ferragamo"]


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()


def normalizar(valor, validos, sinonimos):
    if not valor:
        return None
    v = str(valor).lower().strip()
    if v in validos:
        return v
    if v in sinonimos:
        return sinonimos[v]
    va = sem_acento(v)
    if va in validos:
        return va
    for k, alvo in sinonimos.items():
        if sem_acento(k) in va:
            return alvo
    for alvo in validos:
        if alvo in va:
            return alvo
    return None


def abrir_rgba(caminho: Path) -> Image.Image:
    im = Image.open(caminho)
    im.load()
    return im.convert("RGBA")


def tem_transparencia(im: Image.Image) -> bool:
    return im.getchannel("A").getextrema()[0] < 250


def remover_fundo_branco(im: Image.Image) -> Image.Image:
    """Foto em fundo branco → alfa. Quase-branco e pouco saturado vira transparente, com rampa."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            if lum > 246 and sat < 12:
                px[x, y] = (r, g, b, 0)
            elif lum > 228 and sat < 18:
                px[x, y] = (r, g, b, int(a * (246 - lum) / 18))
    return im


def recortar(im: Image.Image, margem=0.0) -> Image.Image:
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bb:
        return im
    im = im.crop(bb)
    if margem:
        mx, my = int(im.width * margem), int(im.height * margem)
        novo = Image.new("RGBA", (im.width + 2 * mx, im.height + 2 * my), (255, 255, 255, 0))
        novo.paste(im, (mx, my))
        im = novo
    return im


def para_tryon(src: Path, destino: Path) -> bool:
    """Vista frontal para o provador: sem sombra/reflexo de estúdio, recortada, 900 px."""
    im = abrir_rgba(src)
    if tem_transparencia(im):
        # A sombra das fotos de estúdio é semi-transparente; a armação é opaca.
        r, g, b, a = im.split()
        a = a.point(lambda v: 0 if v < 150 else (255 if v >= 230 else int((v - 150) / 80 * 255)))
        im = Image.merge("RGBA", (r, g, b, a))
    else:
        im = remover_fundo_branco(im)
    im = recortar(im)
    if im.width < 200:
        return False
    if im.width > 900:
        im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
    im.save(destino, "PNG", optimize=True)
    return True


def para_vitrine(src: Path, destino: Path):
    """Foto de produto em fundo branco (com a sombra de estúdio), recortada com respiro."""
    im = abrir_rgba(src)
    if not tem_transparencia(im):
        # já vem em fundo (branco ou quase): só reduz
        base = im.convert("RGB")
    else:
        im = recortar(im, margem=0.04)
        fundo = Image.new("RGBA", im.size, (255, 255, 255, 255))
        fundo.alpha_composite(im)
        base = fundo.convert("RGB")
    if base.width > 1200:
        base = base.resize((1200, round(base.height * 1200 / base.width)), Image.LANCZOS)
    base.save(destino, "WEBP", quality=84, method=6)


def para_editorial(src: Path, destino: Path):
    im = Image.open(src).convert("RGB")
    if im.width > 1200:
        im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    im.save(destino, "WEBP", quality=82, method=6)


def categoria_de(item) -> str:
    tipo = sem_acento(str(item.get("tipo", "")))
    if item.get("publico") == "infantil":
        return "infantil"
    if tipo == "epi":
        return "epi"
    if tipo == "grau":
        return "oculos-de-grau"
    return "oculos-de-sol"


def main():
    itens = json.loads((ORIGEM / "catalogo.json").read_text(encoding="utf-8"))
    pasta = ORIGEM / "imagens"
    saida, problemas = [], []
    destaques_usados = set()

    for item in itens:
        slug = item["slug"]
        imgs = item.get("imagens") or []
        por_vista = {}
        for im in imgs:
            arq = pasta / im["arquivo"]
            if not arq.exists():
                problemas.append(f"{slug}: arquivo ausente {im['arquivo']}")
                continue
            por_vista.setdefault(im.get("vista", "outra"), []).append(arq)

        urls = []
        tryon = None
        frente = (por_vista.get("frente") or [None])[0]
        tres = (por_vista.get("tres-quartos") or [None])[0]
        modelo = (por_vista.get("modelo") or [None])[0]

        principal = tres or frente
        if principal:
            d = DESTINO_IMG / f"oc-{slug}-1.webp"
            para_vitrine(principal, d)
            urls.append(f"/uploads/produtos/{d.name}")
        if modelo:
            d = DESTINO_IMG / f"oc-{slug}-modelo.webp"
            para_editorial(modelo, d)
            urls.append(f"/uploads/produtos/{d.name}")
        if frente and frente != principal:
            d = DESTINO_IMG / f"oc-{slug}-2.webp"
            para_vitrine(frente, d)
            urls.append(f"/uploads/produtos/{d.name}")
        for extra in por_vista.get("lateral", [])[:1]:
            d = DESTINO_IMG / f"oc-{slug}-3.webp"
            para_vitrine(extra, d)
            urls.append(f"/uploads/produtos/{d.name}")

        if frente:
            d = DESTINO_IMG / f"oc-{slug}-tryon.png"
            if para_tryon(frente, d):
                tryon = f"/uploads/produtos/{d.name}"

        if not urls:
            problemas.append(f"{slug}: sem imagem utilizável — fora do catálogo")
            continue

        formato = normalizar(item.get("formato"), FORMATOS, SINONIMOS_FORMATO)
        material = normalizar(item.get("material"), MATERIAIS, SINONIMOS_MATERIAL)
        publico = item.get("publico") if item.get("publico") in PUBLICOS else None
        if item.get("formato") and not formato:
            problemas.append(f"{slug}: formato não reconhecido '{item.get('formato')}'")
        if item.get("material") and not material:
            problemas.append(f"{slug}: material não reconhecido '{item.get('material')}'")

        marca = item["marca"].strip()
        destaque = marca in MARCAS_DESTAQUE and marca not in destaques_usados and bool(modelo or tres)
        if destaque:
            destaques_usados.add(marca)

        lente = item.get("lente") or {}
        saida.append({
            "slug": slug,
            "marca": marca,
            "codigo": item.get("codigo"),
            "nome": item.get("nome") or item.get("codigo") or slug,
            "tipo": sem_acento(str(item.get("tipo", "sol"))),
            "categoria": categoria_de(item),
            "publico": publico,
            "formato": formato,
            "material": material,
            "cor_armacao": item.get("cor_armacao"),
            "cor_armacao_hex": item.get("cor_armacao_hex"),
            "lente": {
                "cor": lente.get("cor"),
                "polarizada": bool(lente.get("polarizada")),
                "espelhada": bool(lente.get("espelhada")),
                "degrade": bool(lente.get("degrade")),
                "fotossensivel": bool(lente.get("fotossensivel")),
                "protecao_uv": lente.get("protecao_uv"),
            },
            "medidas": item.get("medidas") or {},
            "preco_brl": round(float(item["preco_brl"]), 2),
            "preco_fonte": item.get("preco_fonte"),
            "descricao": item.get("descricao", "").strip(),
            "ca": item.get("ca"),
            "normas": item.get("normas"),
            "aceita_grau": bool(item.get("aceita_grau")),
            "destaque": destaque,
            "imagens": urls,
            "tryon": tryon,
            "fontes": [im.get("fonte_url") for im in imgs if im.get("fonte_url")],
        })

    DESTINO_JSON.write_text(json.dumps(saida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(saida)} itens → {DESTINO_JSON.relative_to(RAIZ)}")
    print(f"  com provador: {sum(1 for s in saida if s['tryon'])} · com foto no rosto: {sum(1 for s in saida if any('-modelo' in u for u in s['imagens']))} · destaques: {sum(1 for s in saida if s['destaque'])}")
    for p in problemas:
        print("  AVISO", p)


if __name__ == "__main__":
    main()
