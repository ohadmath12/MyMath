/* Never wait for third-party verification, and never trap the form behind a loader. */
(() => {
  const root = document.documentElement;
  root.classList.add('form-loading');
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove('form-loading');
    document.getElementById('form-loading-screen')?.remove();
    clearTimeout(timeout);
  };
  const timeout = setTimeout(finish, 6000);
  document.addEventListener('form-step-shown', finish, { once: true });
  document.addEventListener('DOMContentLoaded', finish, { once: true });
  window.addEventListener('pageshow', finish, { once: true });
})();
