"""
Separa a logo da Barbearia Roque em camadas PNG transparentes (mesmo tamanho do
original), recolorindo o preto para um tom metálico claro e mantendo o
vermelho/azul do poste de barbeiro. Usado pela animação da tela de abertura.

Uso: python tools/separar_logo.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'originais/logo.png'
OUT = 'public/logo-partes'
METAL = np.array([236, 230, 218])  # creme/prata do letreiro

im = np.array(Image.open(SRC).convert('RGB')).astype(float)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
sat = im.max(-1) - im.min(-1)
colorido = sat > 60

# alpha suave (antialias) a partir da luminância
alpha = np.clip((235 - lum) / 235 * 1.25, 0, 1)
alpha[colorido] = 1.0
rgb = np.where(colorido[..., None], im, METAL)

mask = alpha > 0.05
lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
objs = ndimage.find_objects(lab)
H, W = lab.shape
yy, xx = np.mgrid[0:H, 0:W]

def centro(i):
    sl = objs[i - 1]
    return ((sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2)

# grupos -> lista de rótulos (definidos analisando as bounding boxes)
grupos = {}
def add(nome, m):
    grupos[nome] = grupos.get(nome, np.zeros_like(mask)) | m

for i in range(1, n + 1):
    comp = lab == i
    cy, cx = centro(i)
    sl = objs[i - 1]
    w = sl[1].stop - sl[1].start
    if cy < 90 and 190 < cx < 310:
        add('navalhas', comp)
    elif w > 300 and cy > 150:          # laterais do escudo + tesoura (conectados)
        add('escudo', comp & (yy < 418))
        add('tesoura', comp & (yy >= 418))
    elif cy < 160 and (cx < 210 or cx > 290) and w > 100:
        add('escudo', comp)              # arcos superiores
    elif cy < 195 and not (165 < cx < 340 and cy > 158):
        add('letra-barbearia', comp)
    elif cy < 400 and colorido[comp].mean() > 0.3:
        add('poste', comp)
    elif cy < 400:
        add('r', comp)
    elif cy < 485:
        add('tesoura', comp)
    else:
        add('roque', comp)

def salvar(nome, m):
    a = (alpha * m * 255).astype(np.uint8)
    out = np.dstack([rgb.astype(np.uint8), a])
    Image.fromarray(out, 'RGBA').save(f'{OUT}/{nome}.png', optimize=True)

# letras individuais de BARBEARIA e ROQUE (ordenadas pela posição x)
def separar_letras(m, prefixo, limiar=0.5):
    # rotula com o contorno "forte" para não grudar letras vizinhas,
    # depois devolve cada pixel suave para a letra mais próxima
    forte = m & (alpha > limiar)
    l2, k = ndimage.label(forte, structure=np.ones((3, 3)))
    sl2 = ndimage.find_objects(l2)
    letras = []  # (x0, x1, rótulos)
    for j, sl in enumerate(sl2, 1):
        if (l2[sl] == j).sum() < 15: continue
        x0, x1 = sl[1].start, sl[1].stop
        for L in letras:  # pontinhos/detalhes dentro de outra letra
            if x0 >= L[0] - 2 and x1 <= L[1] + 2:
                L[2].append(j); break
        else:
            letras.append([x0, x1, [j]])
    letras.sort(key=lambda L: L[0])
    marcado = np.isin(l2, [j for L in letras for j in L[2]])
    _, idx = ndimage.distance_transform_edt(~marcado, return_indices=True)
    dono = l2[idx[0], idx[1]]
    for i, L in enumerate(letras):
        salvar(f'{prefixo}-{i + 1}', m & np.isin(dono, L[2]))
    return len(letras)

nb = separar_letras(grupos.pop('letra-barbearia'), 'barbearia')
nr = separar_letras(grupos.pop('roque'), 'roque')
for nome, m in grupos.items():
    salvar(nome, m)
salvar('logo-completa', mask)
print('barbearia letras:', nb, '| roque letras:', nr, '| grupos:', list(grupos))

# Ícones PWA: logo sobre fundo escuro
full = Image.open(f'{OUT}/logo-completa.png')
for s in (192, 512):
    bg = Image.new('RGBA', (s, s), (17, 14, 12, 255))
    lg = full.copy(); lg.thumbnail((int(s * 0.82), int(s * 0.82)), Image.LANCZOS)
    bg.alpha_composite(lg, ((s - lg.width) // 2, (s - lg.height) // 2))
    bg.convert('RGB').save(f'public/img/icone-{s}.png', optimize=True)

# Fundo: foto interna
Image.open('originais/fachada-interna.png').convert('RGB').save('public/img/fundo-parede.jpg', quality=88)

# Recorte só do "R" com o poste (selos do cartão fidelidade)
r = Image.open(f'{OUT}/r.png'); p = Image.open(f'{OUT}/poste.png')
r.alpha_composite(p)
r.crop(r.getbbox()).save(f'{OUT}/r-recorte.png', optimize=True)
