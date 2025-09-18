// Small UI helpers: loading overlay, alerts, flash messages, and modal
function ensureStyle() {
  if (document.getElementById('ui-helpers-style')) return;
  const style = document.createElement('style');
  style.id = 'ui-helpers-style';
  style.textContent = `
  #global-loading{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(255,255,255,.85);z-index:2000}
  #global-loading.show{display:flex}
  #global-loading .spinner{display:flex;flex-direction:column;align-items:center;gap:.75rem}
  #global-loading .spinner .text{font-weight:500;color:#333}
  #alert-container{position:fixed;top:1rem;right:1rem;z-index:2100;display:flex;flex-direction:column;gap:.5rem;max-width:min(90vw,420px)}
  .alert{margin:0;opacity:.97}
  .alert.fade-out{transition:opacity .4s ease, transform .4s ease;opacity:0;transform:translateY(-6px)}
  button[disabled]{opacity:.7;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}
export function ensureContainers() {
  ensureStyle();
  if (!document.getElementById('global-loading')) {
    const div = document.createElement('div');
    div.id = 'global-loading';
    div.innerHTML = `
      <div class="spinner">
        <div class="spinner-border text-primary" role="status" aria-label="loading"></div>
        <div class="text">Loading…</div>
      </div>`;
    document.body.appendChild(div);
  }
  if (!document.getElementById('alert-container')) {
    const cont = document.createElement('div');
    cont.id = 'alert-container';
    document.body.appendChild(cont);
  }
}
export function showLoading(text = 'Loading…') {
  ensureContainers();
  const el = document.getElementById('global-loading');
  el.querySelector('.text').textContent = text;
  el.classList.add('show');
}
export function hideLoading() {
  const el = document.getElementById('global-loading');
  if (el) el.classList.remove('show');
}
export function showAlert(message, type = 'info', timeoutMs = 4000) {
  ensureContainers();
  const cont = document.getElementById('alert-container');
  const div = document.createElement('div');
  div.className = `alert alert-${type} shadow-sm`;
  div.role = 'alert';
  div.textContent = message;
  cont.appendChild(div);
  const t = setTimeout(() => {
    div.classList.add('fade-out');
    setTimeout(() => div.remove(), 420);
  }, timeoutMs);
  div.addEventListener('click', () => {
    clearTimeout(t);
    div.remove();
  });
}

// Bootstrap modal helper
export function showModal(title = 'Notice', body = 'Done.', { okText = 'OK' } = {}) {
  let modalRoot = document.getElementById('global-modal');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'global-modal';
    modalRoot.innerHTML = `
      <div class="modal fade" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body"><p class="mb-0"></p></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" data-bs-dismiss="modal">${okText}</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalRoot);
  }
  const modalEl = modalRoot.querySelector('.modal');
  modalRoot.querySelector('.modal-title').textContent = title;
  modalRoot.querySelector('.modal-body p').textContent = body;
  const Modal = window.bootstrap?.Modal;
  if (Modal) {
    const instance = Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: true });
    instance.show();
  } else {
    // Fallback if Bootstrap JS not loaded
    alert(`${title}\n\n${body}`);
  }
}

// Confirm modal helper that returns a Promise<boolean>
export function confirmModal(title = 'Confirm', body = 'Are you sure?', { confirmText = 'Yes', cancelText = 'Cancel', variant = 'danger' } = {}) {
  return new Promise((resolve) => {
    let root = document.getElementById('global-confirm-modal');
    if (!root) {
      root = document.createElement('div');
      root.id = 'global-confirm-modal';
      root.innerHTML = `
        <div class="modal fade" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body"><p class="mb-0"></p></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="confirm-cancel-btn"></button>
                <button type="button" class="btn" id="confirm-ok-btn"></button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(root);
    }
    const modalEl = root.querySelector('.modal');
    root.querySelector('.modal-title').textContent = title;
    root.querySelector('.modal-body p').textContent = body;
    const cancelBtn = root.querySelector('#confirm-cancel-btn');
    const okBtn = root.querySelector('#confirm-ok-btn');
    cancelBtn.textContent = cancelText;
    okBtn.textContent = confirmText;
    okBtn.className = `btn btn-${variant}`;

    const Modal = window.bootstrap?.Modal;
    if (!Modal) {
      const res = confirm(`${title}\n\n${body}`);
      resolve(!!res);
      return;
    }
    const instance = Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: true });
    const cleanup = () => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    };
    const onOk = () => {
      cleanup();
      instance.hide();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      instance.hide();
      resolve(false);
    };
    const onHidden = () => {
      cleanup();
      resolve(false);
    };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modalEl.addEventListener('hidden.bs.modal', onHidden);
    instance.show();
  });
}

// Flash storage
const FLASH_KEY = '__flash_msg__';
export function flash(message, type = 'success', meta = {}) {
  const payload = typeof meta === 'string' ? { kind: meta } : meta || {};
  try {
    localStorage.setItem(FLASH_KEY, JSON.stringify({
      message, type, ...payload, t: Date.now()
    }));
  } catch {}
}
export function readFlash() {
  try {
    const raw = localStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    localStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export function consumeFlash() {
  const f = readFlash();
  if (!f) return;
  showAlert(f.message, f.type || 'info');
}
export function consumeFlashModal() {
  const f = readFlash();
  if (!f) return;
  if (f.kind === 'registered') {
    showModal('Registration successful', f.message || 'Your account has been created. Please log in.');
  } else {
    showAlert(f.message, f.type || 'info');
  }
}
