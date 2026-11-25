/* Loading presentation only. No artificial minimum and no payment/form mutations. */
(() => {
  const root = document.documentElement;
  const embedded = window.parent !== window && new URLSearchParams(location.search).get('family_embed') === '1';
  let finished = embedded, domReady = false, holds = 0, closing = false;
  let fallback, closeTimer;
  function finish() {
    finished = true;
    clearTimeout(fallback); clearTimeout(closeTimer);
    root.classList.remove('form-loading', 'form-loading-complete');
    document.getElementById('form-loading-screen')?.remove();
  }
  function ready() {
    if (finished || closing || !domReady || holds) return;
    closing = true;
    root.classList.add('form-loading-complete');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else closeTimer = setTimeout(finish, 180);
  }
  window.FormLoading = {
    hold() {
      if (finished || closing) return () => {};
      holds++;
      let released = false;
      return () => { if (!released) { released = true; holds--; ready(); } };
    }
  };
  function documentReady() { domReady = true; if (embedded) finish(); else ready(); }
  if (!embedded) {
    root.classList.add('form-loading');
    fallback = setTimeout(finish, 6000); // A failed dependency must never strand the overlay.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', documentReady, {once:true});
  else documentReady();
  window.addEventListener('pageshow', e => { if (e.persisted) finish(); });
})();
