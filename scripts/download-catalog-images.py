"""Cache original catalog photos locally. Run again when source hosting is reachable."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'assets/catalog-data.json').read_text())
target = ROOT / 'assets/img/catalog'
target.mkdir(parents=True, exist_ok=True)
manifest_path = ROOT / 'assets/catalog-images.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
urls = set()
for product in data['products']:
    if product['status'] != 'publish':
        continue
    urls.add(product['image'])
    urls.update(v['image'] for v in product['variants'])

def download(url):
    if not url or url in manifest:
        return None
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            mime = response.headers.get_content_type()
            if mime not in ['image/png', 'image/jpeg', 'image/webp']:
                raise ValueError('Not a product image')
            content = response.read()
        ext = {'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[mime]
        path = target / (hashlib.sha256(url.encode()).hexdigest()[:16] + ext)
        path.write_bytes(content)
        return url, str(path.relative_to(ROOT))
    except Exception:
        return None

with ThreadPoolExecutor(max_workers=10) as pool:
    for result in pool.map(download, sorted(urls)):
        if result:
            manifest[result[0]] = result[1]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'Cached {len(manifest)} of {len(urls - {""})} original images.')
