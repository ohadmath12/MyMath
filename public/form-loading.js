/* Brief branded introduction; a hard fallback prevents a stalled overlay. */
(() => {
  const root = document.documentElement;
  const started = performance.now();
  const minimumMs = 1500;
  root.classList.add('form-loading');
  let finished = false;
  let revealTimer;
  let closing = false;
  let closeTimer;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove('form-loading', 'form-loading-complete');
    document.getElementById('form-loading-screen')?.remove();
    clearTimeout(timeout);
    clearTimeout(revealTimer);
    clearTimeout(closeTimer);
  };
  const complete = () => {
    if (finished || closing) return;
    closing = true;
    root.classList.add('form-loading-complete');
    closeTimer = setTimeout(finish, 450);
  };
  const ready = () => {
    if (finished || revealTimer !== undefined) return;
    revealTimer = setTimeout(complete, Math.max(0, minimumMs - (performance.now() - started)));
  };
  const timeout = setTimeout(complete, 6000);
  document.addEventListener('form-step-shown', ready, { once: true });
  document.addEventListener('DOMContentLoaded', ready, { once: true });
  window.addEventListener('pageshow', event => event.persisted ? finish() : ready(), { once: true });
})();
