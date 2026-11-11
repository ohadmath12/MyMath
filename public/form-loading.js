/* Brief branded introduction; a hard fallback prevents a stalled overlay. */
(() => {
  const root = document.documentElement;
  const started = performance.now();
  const minimumMs = 1500;
  root.classList.add('form-loading');
  let finished = false;
  let revealTimer;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove('form-loading');
    document.getElementById('form-loading-screen')?.remove();
    clearTimeout(timeout);
    clearTimeout(revealTimer);
  };
  const ready = () => {
    if (finished || revealTimer !== undefined) return;
    revealTimer = setTimeout(finish, Math.max(0, minimumMs - (performance.now() - started)));
  };
  const timeout = setTimeout(finish, 6000);
  document.addEventListener('form-step-shown', ready, { once: true });
  document.addEventListener('DOMContentLoaded', ready, { once: true });
  window.addEventListener('pageshow', event => event.persisted ? finish() : ready(), { once: true });
})();
