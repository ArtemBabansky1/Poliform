"""Rebuild the two landing collections after editing catalog-selections.json."""
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'assets/catalog-data.json').read_text())
selections = json.loads((ROOT / 'assets/catalog-selections.json').read_text())
products = {str(p['id']): p for p in data['products'] if p['status'] == 'publish'}
page = ROOT / 'index.html'
source = page.read_text()
escape = lambda value: html.escape(str(value), quote=True)
for section, key in [('popular', 'popular'), ('new-products', 'new')]:
    selection = selections[key]
    cards = []
    for product_id in selection['productIds']:
        p = products[str(product_id)]
        neck = (p['attributes'].get('pa_neck-type') or [''])[0]
        specs = [('Объём', p['volume']), ('Материал', p['material']), ('Горловина', neck)]
        spec_html = ''.join(f'<div><dt>{label}</dt><dd>{escape(value)}</dd></div>' for label, value in specs if value)
        cards.append(f'''<article class="prcard" data-reveal data-product="{p['id']}" data-volume="{p['volumeMl'] or ''}" data-material="{escape(p['material'])}" data-closure="{escape(neck)}">
            <a class="prcard__media" href="product.html?id={p['id']}" aria-label="{escape(p['name'])}"><div class="photo-placeholder"><span>Фото уточняется</span></div></a>
            <div class="prcard__body"><h3 class="prcard__name"><a href="product.html?id={p['id']}">{escape(p['name'])}</a></h3>
              <dl class="prcard__specs">{spec_html}</dl><p class="prcard__price">Стоимость по запросу</p>
              <div class="prcard__links"><a href="product.html?id={p['id']}" class="btn btn--paper button-wipe">Подробнее</a><button type="button" class="btn btn--lime button-wipe" data-request="Образцы" data-item="{p['id']}">Образец</button></div>
            </div></article>''')
    pattern = rf'(<section[^>]*id="{section}"[\s\S]*?<div class="popular__grid catalog-landing-grid">)[\s\S]*?(\n        </div>\n      </div>\n    </section>)'
    source, count = re.subn(pattern, lambda m: m[1] + '\n          ' + '\n          '.join(cards) + m[2], source, count=1)
    if count != 1:
        raise ValueError(f'Collection {section} not found; no files written')
    link_pattern = rf'(<section[^>]*id="{section}"[\s\S]*?class="popular__heading">[\s\S]*?<a )href="[^"]*"'
    source = re.sub(link_pattern, lambda m: m[1] + 'href="catalog.html?' + escape(selection['catalogQuery']) + '"', source, count=1)
page.write_text(source)
print('Updated popular and new product collections.')
