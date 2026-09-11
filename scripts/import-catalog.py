"""Import product data only from a WordPress WXR; never execute exported content.

Usage: python3 scripts/import-catalog.py /path/to/export.xml
Images retain their source URLs; download-catalog-images.py can cache them locally.
"""
import collections
import html
import json
from pathlib import Path
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {'wp': 'http://wordpress.org/export/1.2/'}

def get(item, name):
    return item.findtext('wp:' + name, default='', namespaces=NS) or ''

def meta(item):
    return {get(m, 'meta_key'): get(m, 'meta_value') for m in item.findall('wp:postmeta', NS)}

def run(source):
    channel = ET.parse(source).getroot().find('channel')
    items = channel.findall('item')
    attachments = {get(i, 'post_id'): get(i, 'attachment_url') for i in items if get(i, 'post_type') == 'attachment'}
    terms = {}
    for term in channel.findall('wp:term', NS):
        terms[(get(term, 'term_taxonomy'), get(term, 'term_slug'))] = get(term, 'term_name')
    variants = collections.defaultdict(list)
    for i in items:
        if get(i, 'post_type') != 'product_variation' or get(i, 'status') != 'publish':
            continue
        m = meta(i)
        attrs = {k.removeprefix('attribute_'): terms.get((k.removeprefix('attribute_'), v), urllib.parse.unquote(v)) for k, v in m.items() if k.startswith('attribute_') and v}
        variants[get(i, 'post_parent')].append({'id': get(i, 'post_id'), 'attributes': attrs, 'price': m.get('_price', ''), 'image': attachments.get(m.get('_thumbnail_id'), ''), 'stock': m.get('_stock_status', '')})
    products = []
    categories = {}
    for i in items:
        if get(i, 'post_type') != 'product':
            continue
        m = meta(i)
        attrs = collections.defaultdict(list)
        cats = []
        for c in i.findall('category'):
            domain = c.get('domain', '')
            if domain.startswith('pa_'):
                attrs[domain].append(c.text or '')
            if domain == 'product_cat':
                cats.append(c.get('nicename'))
                categories[c.get('nicename')] = c.text
        name = html.unescape(i.findtext('title', ''))
        name = re.sub(r'\s+-\s*"([^"]+)"', r' «\1»', name)
        name = name.replace(' - «', ' «')
        volume = (attrs.get('pa_volume') or [''])[0]
        match = re.search(r'[\d.,]+', volume)
        volume_ml = round(float(match[0].replace(',', '.')) * (1 if 'мл' in volume else 1000)) if match else None
        material = 'ПЭТ' if 'ПЭТ' in name.upper() else ''
        products.append({'id': get(i, 'post_id'), 'slug': get(i, 'post_name'), 'name': name, 'status': get(i, 'status'), 'categories': cats, 'attributes': dict(attrs), 'volume': volume, 'volumeMl': volume_ml, 'material': material, 'image': attachments.get(m.get('_thumbnail_id'), ''), 'sourceUrl': i.findtext('link', ''), 'price': m.get('_price', ''), 'popular': '"popular"' in m.get('_merkuriy_predefined_badges', ''), 'variants': variants[get(i, 'post_id')], 'date': get(i, 'post_date')})
    result = {'source': {'file': Path(source).name, 'site': channel.findtext('link'), 'exportedAt': channel.findtext('pubDate')}, 'categories': categories, 'products': products}
    target = ROOT / 'assets/catalog-data.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    published = [p for p in products if p['status'] == 'publish']
    print(f'Imported {len(products)} products ({len(published)} published), {sum(len(p["variants"]) for p in products)} variations.')

if __name__ == '__main__':
    run(sys.argv[1])
