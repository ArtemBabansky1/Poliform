/* Product information and RFQ actions remain usable independently of animation CDNs. */
(() => {
  'use strict';
  const cards = [...document.querySelectorAll('#popular .prcard')];
  const products = new Map(cards.map(card => [card.dataset.product, {
    name: card.querySelector('.prcard__name').textContent,
    volume: card.dataset.volume,
    closure: card.dataset.closure,
    image: card.querySelector('img').getAttribute('src'),
    alt: card.querySelector('img').alt
  }]));
  const form = document.getElementById('requestForm');
  const productDialog = document.getElementById('productDialog');
  let selectedProduct = '';
  let returnFocus;
  function openDialog(dialog, trigger) {
    returnFocus = trigger;
    dialog.showModal();
  }
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); });
    dialog.addEventListener('click', event => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
  });
  document.querySelectorAll('[data-details]').forEach(button => {
    button.addEventListener('click', () => {
      selectedProduct = button.dataset.details;
      const item = products.get(selectedProduct);
      document.getElementById('productTitle').textContent = item.name;
      const img = document.getElementById('productImage');
      img.src = item.image; img.alt = item.alt;
      const specs = document.getElementById('productSpecs');
      specs.replaceChildren();
      [['Объём', `${item.volume} мл`], ['Материал', 'ПНД / HDPE'], ['Укупорка', item.closure]].forEach(([label, value]) => {
        const row = document.createElement('div');
        const dt = document.createElement('dt'); const dd = document.createElement('dd');
        dt.textContent = label; dd.textContent = value; row.append(dt, dd); specs.append(row);
      });
      openDialog(productDialog, button);
    });
  });
  function request(type, key) {
    if (productDialog.open) productDialog.close();
    form.elements.request.value = type;
    const item = products.get(key);
    form.elements.product.value = item?.name || '';
    if (item) form.elements.volume.value = item.volume;
    // Preserve any user-written brief; product context travels in its own field.
    form.querySelector('.field__label').textContent = item ? `Запрос: ${item.name}` : 'Что требуется?';
    form.scrollIntoView({behavior:'instant', block:'start'});
    form.elements.request.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-request]').forEach(button => button.addEventListener('click', () => request(button.dataset.request, button.dataset.item)));
  document.getElementById('productQuote').addEventListener('click', () => request('Расчёт партии', selectedProduct));
  document.getElementById('productSample').addEventListener('click', () => request('Образцы', selectedProduct));

  const requestDialog = document.getElementById('requestDialog');
  let draft = '';
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const lines = [
      `Запрос: ${data.get('request')}`,
      data.get('product') && `Изделие: ${data.get('product')}`,
      data.get('volume') && `Объём: ${data.get('volume')} мл`,
      data.get('quantity') && `Тираж: ${data.get('quantity')} шт.`,
      data.get('name') && `Имя: ${data.get('name')}`,
      `Контакт: ${data.get('contact')}`,
      data.get('message') && `Задача: ${data.get('message')}`,
      'Пожалуйста, уточните минимальную партию, срок, горловину и совместимость укупорки, стоимость и условия НДС.'
    ];
    draft = lines.filter(Boolean).join('\n');
    document.getElementById('requestPreview').textContent = draft;
    document.getElementById('requestEmail').href = `mailto:hello@polyform.pro?subject=${encodeURIComponent('ПОЛИФОРМ — '+data.get('request'))}&body=${encodeURIComponent(draft)}`;
    document.getElementById('copyStatus').textContent = 'Адрес получателя: hello@polyform.pro. Запрос ещё не отправлен.';
    openDialog(requestDialog, form.querySelector('[type="submit"]'));
  });
  document.getElementById('copyRequest').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(draft);
      document.getElementById('copyStatus').textContent = 'Текст скопирован. Можно отправить его на hello@polyform.pro.';
    } catch {
      document.getElementById('copyStatus').textContent = 'Выделите текст запроса выше и скопируйте его вручную.';
    }
  });
})();
