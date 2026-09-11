/* One mobile navigation behavior for all pages; independent of animation scripts. */
(() => {
  const header = document.getElementById('nav');
  if (!header) return;
  const toggle = header.querySelector('.nav__toggle');
  const panel = header.querySelector('.nav__panel');
  const links = header.querySelector('.nav__links').cloneNode(true);
  links.className = 'nav__panel-links';
  links.setAttribute('aria-label', 'Мобильная навигация');
  links.querySelectorAll('a').forEach(link => link.classList.remove('nav__link'));
  const contacts = document.createElement('div');
  contacts.className = 'nav__panel-contacts';
  contacts.append(header.querySelector('.nav__phone').cloneNode(true));
  const icons = document.createElement('div');
  icons.className = 'nav__panel-icons';
  header.querySelectorAll('.nav__contacts .msgr').forEach(icon => icons.append(icon.cloneNode(true)));
  contacts.append(icons);
  panel.append(links, contacts);
  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    header.classList.toggle('is-menu-open', open);
    if (restoreFocus) toggle.focus({preventScroll: true});
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('click', event => { if (!panel.hidden && !header.contains(event.target)) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { setOpen(false, true); event.preventDefault(); }
  });
  header.addEventListener('focusout', () => {
    requestAnimationFrame(() => { if (!panel.hidden && !header.contains(document.activeElement)) setOpen(false); });
  });
  window.matchMedia('(min-width: 1201px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
})();
