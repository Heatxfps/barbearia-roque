"""
Remove o letreiro da foto da parede preenchendo a área com tijolos clonados
da própria parede (deslocando por múltiplos do comprimento do tijolo, para
manter o encaixe das fiadas). Assim a logo animada "acende" no lugar dele.

Uso: python tools/limpar_parede.py
"""
import numpy as np
from PIL import Image, ImageFilter

im = np.array(Image.open('originais/fachada-interna.png').convert('RGB')).astype(float)
H, W, _ = im.shape
x0, x1, y0, y1 = 132, 404, 68, 452   # área do letreiro (com folga)
meio = 262
P_ESQ, P_DIR = 62, 68                # comprimento do tijolo (perspectiva)

# preenchimento A: clonado da esquerda; B: clonado da direita
A = im.copy()
for x in range(x0, x1):
    A[y0:y1, x] = A[y0:y1, x - P_ESQ]
B = im.copy()
for x in range(x1 - 1, x0 - 1, -1):
    B[y0:y1, x] = B[y0:y1, x + P_DIR] if x + P_DIR < W else B[y0:y1, x - P_DIR]
# mistura A/B numa faixa suave no meio, para não aparecer emenda
t = np.clip((np.arange(W) - (meio - 20)) / 40, 0, 1)[None, :, None]
out = A * (1 - t) + B * t

# luz: troca a "luz de baixa frequência" do clone pela interpolação das bordas
def blur(a, r):
    return np.stack([np.array(Image.fromarray(np.clip(a[..., c], 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(float) for c in range(3)], -1)
lo_out = blur(out, 18)
L = im[:, x0 - 14:x0 - 2].mean(1)
R = im[:, x1 + 2:x1 + 14].mean(1)
alvo = np.zeros((H, x1 - x0, 3))
for i in range(x1 - x0):
    t = i / (x1 - x0 - 1)
    alvo[:, i] = L * (1 - t) + R * t
alvo = blur(np.pad(alvo, ((0, 0), (0, 0), (0, 0))), 10)
reg = out[:, x0:x1] * np.clip(alvo / np.maximum(lo_out[:, x0:x1], 1), 0.5, 2.0)
out[y0:y1, x0:x1] = reg[y0:y1]

m = np.zeros((H, W)); m[y0:y1, x0:x1] = 255
a = np.array(Image.fromarray(m.astype(np.uint8)).filter(ImageFilter.GaussianBlur(5)))[..., None] / 255
final = im * (1 - a) + out * a
Image.fromarray(np.clip(final, 0, 255).astype(np.uint8)).save('public/img/parede-sem-letreiro.jpg', quality=90)
print('ok')
