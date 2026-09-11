(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arrow = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>';
  const placeholder = '<div class="photo-placeholder"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="7" y="8" width="34" height="32" rx="4" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/><path d="m8 34 10-10 8 8 6-6 9 9" stroke="currentColor" stroke-width="1.5"/></svg><span>Фото уточняется</span></div>';
  const first = (p, key) => (p.attributes[key] || [])[0] || '';
  const productURL = p => `product.html?id=${encodeURIComponent(p.id)}`;
  const noun = n => n % 10 === 1 && n % 100 !== 11 ? 'товар' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'товара' : 'товаров';
  // Only a successfully cached image is displayed; source URLs remain in the data.
  let imageCache = {};
  const imageMarkup = (p, lazy = true, source = p.image) => imageCache[source]
    ? `<img src="${escape(imageCache[source])}" alt="${escape(p.name)}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} width="500" height="500">`
    : placeholder;
  function handleImages(root) {
    root.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      const box = document.createElement('div'); box.innerHTML = placeholder; img.replaceWith(box.firstElementChild);
    }, {once:true}));
  }
  function card(p) {
    const spec = [p.volume, p.material, first(p, 'pa_neck-type') && `Горло ${first(p, 'pa_neck-type')}`].filter(Boolean);
    return `<article class="catalog-card"><a class="catalog-card__media" href="${productURL(p)}" aria-label="${escape(p.name)}">${imageMarkup(p)}${p.popular ? '<span class="catalog-card__tag">Популярное</span>' : ''}</a><div class="catalog-card__body"><h3><a href="${productURL(p)}">${escape(p.name)}</a></h3><div class="catalog-card__specs">${spec.map(s => `<span>${escape(s)}</span>`).join('')}</div><div class="catalog-card__bottom"><p class="catalog-card__price">Стоимость по запросу</p><a class="btn" href="${productURL(p)}" aria-label="Подробнее: ${escape(p.name)}">Подробнее ${arrow}</a></div></div></article>`;
  }
  async function init() {
    const response = await fetch('assets/catalog-data.json');
    if (!response.ok) throw new Error('catalog');
    const data = await response.json();
    try { const cache = await fetch('assets/catalog-images.json'); if (cache.ok) imageCache = await cache.json(); } catch { /* A photo is optional; product details remain available. */ }
    const products = data.products.filter(p => p.status === 'publish');
    if (document.getElementById('catalogResults')) initCatalog(data, products);
    if (document.getElementById('productContent')) initProduct(data, products);
    document.querySelectorAll('[data-category-count]').forEach(el => {
      const n = products.filter(p => p.categories.includes(el.dataset.categoryCount)).length;
      el.textContent = `${n} ${noun(n)}`;
    });
  }
  function initCatalog(data, products) {
    const form = document.getElementById('catalogFilters');
    const search = document.getElementById('catalogSearch');
    const sort = document.getElementById('catalogSort');
    const results = document.getElementById('catalogResults');
    const grid = document.getElementById('catalogGrid');
    const pagination = document.getElementById('catalogPagination');
    const category = form.elements.category;
    const mainCategories = [['', 'Все товары'], ['kosmetika', 'Флаконы для косметики'], ['pet', 'ПЭТ бутылки'], ['related', 'Комплектующие']];
    const extraCats = Object.entries(data.categories).filter(([id]) => !mainCategories.some(([key]) => id === key) && products.some(p => p.categories.includes(id))).sort((a,b) => a[1].localeCompare(b[1],'ru'));
    category.innerHTML = mainCategories.map(([id, name]) => `<option value="${id}">${escape(name)}</option>`).join('') + `<optgroup label="Все разделы">${extraCats.map(([id,name]) => `<option value="${escape(id)}">${escape(name)}</option>`).join('')}</optgroup>`;
    const necks = [...new Set(products.flatMap(p => p.attributes['pa_neck-type'] || []))].sort((a,b) => parseFloat(a)-parseFloat(b));
    form.elements.neck.innerHTML += necks.map(n => `<option>${escape(n)}</option>`).join('');
    const colors = [...new Set(products.flatMap(p => p.attributes.pa_color || []))].sort((a,b) => a.localeCompare(b,'ru'));
    form.elements.color.innerHTML += colors.map(n => `<option>${escape(n)}</option>`).join('');
    const ranges = {small:[0,250], medium:[251,500], large:[501,1000], xl:[1001,5000]};
    for (const input of form.querySelectorAll('[name="volume"]')) {
      const [min,max] = ranges[input.value];
      input.closest('label').querySelector('small').textContent = products.filter(p => p.volumeMl != null && p.volumeMl >= min && p.volumeMl <= max).length;
    }
    let page = 1;
    const pageSize = 12;
    function readURL() {
      const params = new URLSearchParams(location.search);
      category.value = params.get('category') || '';
      if (category.selectedIndex < 0) category.value = '';
      form.elements.neck.value = params.get('neck') || '';
      form.elements.color.value = params.get('color') || '';
      form.elements.popular.checked = params.get('collection') === 'popular';
      form.querySelectorAll('[name="volume"]').forEach(input => { input.checked = params.getAll('volume').includes(input.value); });
      search.value = params.get('q') || '';
      sort.value = params.get('sort') || 'default';
      if (sort.selectedIndex < 0) sort.value = 'default';
      page = Math.max(1, parseInt(params.get('page'),10) || 1);
    }
    function render(sync = true, historyMode = 'replaceState') {
      const params = new URLSearchParams();
      const volumes = [...form.querySelectorAll('[name="volume"]:checked')].map(i => i.value);
      let list = products.filter(p => (!category.value || p.categories.includes(category.value)) && (!form.elements.popular.checked || p.popular) && (!form.elements.neck.value || (p.attributes['pa_neck-type'] || []).includes(form.elements.neck.value)) && (!form.elements.color.value || (p.attributes.pa_color || []).includes(form.elements.color.value)) && (!volumes.length || volumes.some(v => p.volumeMl != null && p.volumeMl >= ranges[v][0] && p.volumeMl <= ranges[v][1])));
      const query = search.value.trim().toLocaleLowerCase('ru').replaceAll('ё','е');
      const words = query.split(/\s+/).filter(Boolean);
      list = list.filter(p => {
        const text = [p.name,p.id,p.volume,p.material,...Object.values(p.attributes).flat()].join(' ').toLocaleLowerCase('ru').replaceAll('ё','е');
        return words.every(word => text.includes(word));
      });
      if (sort.value === 'name') list.sort((a,b) => a.name.localeCompare(b.name,'ru',{numeric:true}));
      if (sort.value === 'volume-asc') list.sort((a,b) => (a.volumeMl ?? Infinity) - (b.volumeMl ?? Infinity));
      if (sort.value === 'volume-desc') list.sort((a,b) => (b.volumeMl ?? -1) - (a.volumeMl ?? -1));
      if (sort.value === 'default') list.sort((a,b) => Number(b.popular)-Number(a.popular));
      const pages = Math.max(1,Math.ceil(list.length/pageSize));
      page = Math.min(page,pages);
      if (category.value) params.set('category',category.value);
      if (form.elements.popular.checked) params.set('collection','popular');
      if (form.elements.neck.value) params.set('neck',form.elements.neck.value);
      if (form.elements.color.value) params.set('color',form.elements.color.value);
      volumes.forEach(v => params.append('volume',v));
      if (search.value) params.set('q',search.value);
      if (sort.value !== 'default') params.set('sort',sort.value);
      if (page > 1) params.set('page',page);
      const url = `${location.pathname}${params.size ? '?'+params.toString() : ''}`;
      if (sync) history[historyMode](null,'',url);
      const heading = category.value ? (mainCategories.find(([id]) => id === category.value)?.[1] || data.categories[category.value]) : form.elements.popular.checked ? 'Популярные товары' : 'Все товары';
      document.getElementById('resultsTitle').textContent = heading;
      document.getElementById('resultsCount').textContent = `${list.length} ${noun(list.length)}`;
      document.getElementById('catalogStatus').textContent = `Найдено ${list.length} ${noun(list.length)}. Страница ${page} из ${pages}.`;
      document.querySelectorAll('.category-tile').forEach(a => { if (new URL(a.href).searchParams.get('category') === category.value) a.setAttribute('aria-current','true'); else a.removeAttribute('aria-current'); });
      grid.innerHTML = list.slice((page-1)*pageSize,page*pageSize).map(card).join('');
      const empty = document.getElementById('catalogEmpty');
      empty.hidden = list.length > 0;
      pagination.hidden = pages === 1;
      pagination.innerHTML = `<button type="button" data-page="${page-1}" aria-label="Предыдущая страница" ${page === 1 ? 'disabled' : ''}>←</button>${Array.from({length:pages},(_,i) => `<button type="button" data-page="${i+1}" aria-label="Страница ${i+1}" ${i+1 === page ? 'aria-current="page"' : ''}>${i+1}</button>`).join('')}<button type="button" data-page="${page+1}" aria-label="Следующая страница" ${page === pages ? 'disabled' : ''}>→</button>`;
      handleImages(grid);
    }
    readURL(); render(false);
    form.addEventListener('change', () => { page = 1; render(true,'pushState'); });
    form.addEventListener('submit', e => e.preventDefault());
    search.addEventListener('input', () => { page = 1; render(); });
    sort.addEventListener('change', () => { page = 1; render(true,'pushState'); });
    pagination.addEventListener('click', e => {
      const button = e.target.closest('[data-page]'); if (!button || button.disabled) return;
      page = Number(button.dataset.page); render(true,'pushState');
      results.scrollIntoView({block:'start'}); document.getElementById('resultsTitle').focus({preventScroll:true});
    });
    document.querySelectorAll('[data-reset-filters]').forEach(button => button.addEventListener('click', () => {
      form.reset(); search.value = ''; sort.value = 'default'; page = 1; render(true,'pushState');
    }));
    const toggle = document.getElementById('filterToggle');
    toggle.addEventListener('click', () => {
      const open = form.classList.toggle('is-open'); toggle.setAttribute('aria-expanded',String(open));
      toggle.innerHTML = `Фильтры <span aria-hidden="true">${open ? '−' : '+'}</span>`;
    });
    window.addEventListener('popstate', () => { readURL(); render(false); });
  }
  function initProduct(data, products) {
    const root = document.getElementById('productContent');
    const p = products.find(p => p.id === new URLSearchParams(location.search).get('id'));
    if (!p) { root.innerHTML = '<div class="catalog-empty"><h1>Товар не найден</h1><p>Выберите другую позицию в каталоге.</p><a class="btn btn--lime" href="catalog.html">Перейти в каталог</a></div>'; return; }
    document.title = `${p.name} — ПОЛИФОРМ`;
    const cat = p.categories.includes('kosmetika') ? 'kosmetika' : p.categories.includes('pet') ? 'pet' : 'related';
    document.getElementById('productBreadcrumb').textContent = p.name;
    const labels = {'pa_volume':'Объём','pa_neck-type':'Горловина','pa_color':'Цвета','pa_в-упаковке':'В упаковке','pa_упаковка-форма':'Упаковка','pa_liquid-type':'Назначение','pa_carbonated':'Для газированных напитков'};
    const specs = Object.entries(labels).filter(([key]) => p.attributes[key]?.length).map(([key,label]) => [label,p.attributes[key].join(', ')]);
    if (p.material) specs.splice(1,0,['Материал',p.material]);
    let variant = p.variants[0];
    const variantLabel = v => Object.values(v.attributes).join(' / ') || 'Стандартный';
    root.innerHTML = `<div class="product-layout"><div class="product-photo"><div class="product-photo__frame" id="detailImage">${imageMarkup(p,false,variant?.image || p.image)}</div></div><div class="product-info"><a class="product-info__category" href="catalog.html?category=${cat}">${escape(data.categories[cat] || 'Каталог')}</a><h1>${escape(p.name)}</h1>${p.variants.length ? `<p id="colorLabel">Вариант исполнения</p><div class="product-colors" role="group" aria-labelledby="colorLabel">${p.variants.map((v,i) => `<button type="button" data-variant="${v.id}" aria-pressed="${i===0}">${escape(variantLabel(v))}</button>`).join('')}</div>` : ''}<dl class="product-info__specs">${specs.map(([label,value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><div class="product-order"><h2>Стоимость по запросу</h2><p>Рассчитаем партию под ваш тираж. Уточним цвет, комплектацию и сроки производства.</p><div class="product-order__buttons"><a class="btn btn--lime" id="productQuoteLink">Получить расчёт</a><a class="btn btn--soft" id="productSampleLink">Запросить образец</a></div></div></div></div><section class="product-related"><h2 class="related-heading">Другие формы</h2><div class="catalog-grid">${products.filter(other => other.id !== p.id && other.categories.includes(cat)).slice(0,4).map(card).join('')}</div></section>`;
    function updateLinks() {
      const context = new URLSearchParams({product:p.name,volume:String(p.volumeMl || ''),variant:variant ? variantLabel(variant) : ''});
      document.getElementById('productQuoteLink').href = `index.html?${context}&request=quote#contact`;
      document.getElementById('productSampleLink').href = `index.html?${context}&request=sample#contact`;
    }
    root.querySelector('.product-info__specs').before(root.querySelector('.product-order'));
    updateLinks(); handleImages(root);
    root.querySelectorAll('[data-variant]').forEach(button => button.addEventListener('click', () => {
      variant = p.variants.find(v => v.id === button.dataset.variant);
      root.querySelectorAll('[data-variant]').forEach(b => b.setAttribute('aria-pressed',String(b === button)));
      document.getElementById('detailImage').innerHTML = imageMarkup(p,false,variant.image || p.image);
      handleImages(root); updateLinks();
    }));
  }
  init().catch(() => {
    const root = document.getElementById('catalogResults') || document.getElementById('productContent');
    if (root) root.innerHTML = '<div class="catalog-empty" role="alert"><h2>Не удалось загрузить каталог</h2><p>Обновите страницу или свяжитесь с нами — поможем подобрать тару.</p><button class="btn btn--lime" type="button" id="catalogRetry">Повторить</button></div>';
    document.getElementById('catalogRetry')?.addEventListener('click', () => location.reload());
  });
})();
