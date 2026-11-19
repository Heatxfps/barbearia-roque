"""Gera as fotos da equipe usadas no app a partir de originais/equipe/.

Para cada pessoa sai um retrato 3:4 (cartões) e um quadrado (avatares),
com um leve tom quente para combinar com a luz da barbearia.

    python tools/preparar_fotos.py
"""
from pathlib import Path
from PIL import Image, ImageEnhance

RAIZ = Path(__file__).resolve().parent.parent
ORIG = RAIZ / 'originais' / 'equipe'
SAIDA = RAIZ / 'public' / 'img' / 'equipe'

# recorte do retrato (x, y, largura) no original 2048x2048; altura = largura * 4/3
# e centro do rosto (x, y, lado) para o avatar quadrado
FOTOS = {
    'daniel-andrade': {'retrato': (1060, 120, 960), 'rosto': (1560, 640, 780)},
    'guilherme-moreira': {'retrato': (224, 0, 1536), 'rosto': (955, 1060, 1150)},
    'luciano-roque': {'retrato': (130, 40, 1000), 'rosto': (670, 420, 480)},
}


def tom_quente(im: Image.Image) -> Image.Image:
    im = ImageEnhance.Color(im).enhance(0.9)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * 1.03)))
    b = b.point(lambda v: int(v * 0.95))
    return Image.merge('RGB', (r, g, b))


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    for nome, c in FOTOS.items():
        im = tom_quente(Image.open(ORIG / f'{nome}.jpg').convert('RGB'))
        x, y, w = c['retrato']
        h = round(w * 4 / 3)
        im.crop((x, y, x + w, min(y + h, im.height))).resize((720, 960), Image.LANCZOS) \
            .save(SAIDA / f'{nome}.jpg', quality=82, optimize=True, progressive=True)
        cx, cy, lado = c['rosto']
        m = lado // 2
        im.crop((cx - m, cy - m, cx + m, cy + m)).resize((240, 240), Image.LANCZOS) \
            .save(SAIDA / f'{nome}-avatar.jpg', quality=82, optimize=True)
        print('ok', nome)


if __name__ == '__main__':
    main()
