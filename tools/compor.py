"""Arte da loja do Balneabilidade Praias SP (1920×2100) sobre a arte do Balneabilidade Represas SP:
mantém o gradiente, o selo "available on ZeppOS", o "Instale AGORA!", os relógios e as listas de
aparelhos; refaz cabeçalho, 4 telas, legendas, rodapé e marca os QR como espaço reservado.
  python3 tools/compor.py arte_represas.png capturas_480/ icon.png saida.png"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
REF, CAP, ICON, OUT = sys.argv[1:5]
I = '/usr/share/fonts/opentype/inter/'
F = lambda n, s: ImageFont.truetype(I + n, s)
TXT, MUTED, RODAPE = (232, 244, 246), (122, 154, 163), (79, 106, 114)

ref = Image.open(REF).convert('RGBA')
W, H = ref.size
out = ref.copy()
# Fundo da metade de cima: o gradiente é vertical → copia a coluna x=30 (preserva o selo)
col = ref.crop((30, 0, 31, 940)).resize((W, 940))
selo = ref.crop((1380, 120, 1760, 300))
out.paste(col, (0, 0))
out.alpha_composite(selo, (1380, 120))
g = ImageDraw.Draw(out)

# Cabeçalho
ic = Image.open(ICON).convert('RGBA').resize((184, 184), Image.LANCZOS)
out.alpha_composite(ic, (113, 118))
# título no maior tamanho (até 96) que termina antes do selo (x 1400)
for tam in range(96, 60, -2):
    ft, fl = F('Inter-SemiBold.otf', tam), F('Inter-Light.otf', tam)
    if 330 + g.textlength('Balneabilidade', font=ft) + g.textlength(' Praias SP', font=fl) <= 1400: break
g.text((330, 196), 'Balneabilidade', font=ft, fill=TXT, anchor='ls')
g.text((330 + g.textlength('Balneabilidade', font=ft), 196), ' Praias SP', font=fl, fill=TXT, anchor='ls')
g.text((334, 268), 'As praias do litoral de SP no seu pulso', font=F('Inter-Regular.otf', 36), fill=MUTED, anchor='ls')

# 4 telas
telas = [
    ('01_ubatuba_resumo.png', 'Próprias e impróprias'),
    ('02_lista_municipios.png', '15 municípios do litoral'),
    ('03_ubatuba_praias.png', 'Praia a praia'),
    ('08_criterio.png', 'Critério da CETESB'),
]
fc = F('Inter-Regular.otf', 36)
for i, (arq, leg) in enumerate(telas):
    cx, cy = 300 + i * 440, 630
    g.ellipse([cx - 222, cy - 222, cx + 222, cy + 222], fill=(9, 25, 31))
    g.ellipse([cx - 212, cy - 212, cx + 212, cy + 212], fill=(30, 48, 54))
    t = Image.open(os.path.join(CAP, arq)).convert('RGBA').resize((396, 396), Image.LANCZOS)
    out.alpha_composite(t, (cx - 198, cy - 198))
    g.text((cx, 900), leg, font=fc, fill=TXT, anchor='ms')

# QR: espaço reservado dentro das molduras brancas (os QR do Represas não servem para este app)
for k, (x0, y0, x1, y1) in enumerate(((500, 1376, 739, 1615), (1112, 1376, 1351, 1615))):
    g.rectangle([x0, y0, x1, y1], fill=(255, 255, 255))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    g.text((cx, cy - 20), 'QR', font=F('Inter-Bold.otf', 64), fill=(170, 180, 184), anchor='mm')
    g.text((cx, cy + 45), ('NXP', 'ZPS')[k], font=F('Inter-Regular.otf', 32), fill=(170, 180, 184), anchor='mm')

# Rodapé
g.rectangle([0, 1985, W, H], fill=(13, 37, 44))
g.text((W // 2, 2058), 'Dados públicos da Qualidade das Praias Litorâneas (CETESB) · app independente, sem vínculo com a CETESB',
       font=F('Inter-Regular.otf', 28), fill=RODAPE, anchor='ms')
out.convert('RGB').save(OUT)
print('ok', OUT, out.size)
