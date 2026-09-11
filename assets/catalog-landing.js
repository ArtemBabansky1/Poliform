/* Both landing collections use the same imported catalog and cached photos. */
(async () => {
  try {
    const [data, images] = await Promise.all([
      fetch('assets/catalog-data.json').then(r => r.json()),
      fetch('assets/catalog-images.json').then(r => r.json())
    ]);
    document.querySelectorAll('.catalog-landing-grid [data-product]').forEach(card => {
      const product = data.products.find(p => p.id === card.dataset.product);
      const path = product && images[product.image];
      if (!path) return;
      const img = document.createElement('img');
      img.src = path; img.alt = product.name; img.loading = 'lazy'; img.width = 500; img.height = 500;
      img.addEventListener('error', () => { img.remove(); card.querySelector('.photo-placeholder').hidden = false; });
      card.querySelector('.photo-placeholder').hidden = true;
      card.querySelector('.prcard__media').append(img);
    });
  } catch { /* The static product links still work if optional photo loading fails. */ }
})();
