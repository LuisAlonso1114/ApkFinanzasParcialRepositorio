/**
 * app.js
 * Controlador de UI. Conecta storage.js (persistencia) y rules.js
 * (reglas de negocio) con el DOM. No contiene lógica de negocio propia:
 * toda decisión de "se puede / no se puede" vive en Rules.
 */
(() => {
  const CATEGORY_LABELS = {
    beca: 'Beca', mesada: 'Mesada', trabajo: 'Trabajo', otro: 'Otro',
    alimentacion: 'Alimentación', transporte: 'Transporte',
    entretenimiento: 'Entretenimiento', salud: 'Salud', educacion: 'Educación',
  };
  const CATEGORY_ICONS = {
    beca: '🎓', mesada: '💌', trabajo: '💼', otro: '✨',
    alimentacion: '🍽️', transporte: '🚌', entretenimiento: '🎬',
    salud: '💊', educacion: '📚',
  };

  const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');

  const state = {
    transactions: Storage.getTransactions(),
    settings: Storage.getSettings(),
    monthKey: Rules.currentMonthKey(),
    pendingDelete: null, // {id}
    pendingEdit: null,   // tx object
  };

  // ---------- Helpers de DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // =========================================================
  // Aplicar ajustes (tema, acento, alias, mes) a la interfaz
  // =========================================================
  function applySettingsToDOM() {
    const s = state.settings;
    document.documentElement.setAttribute('data-theme', s.theme);
    document.documentElement.setAttribute('data-accent', s.accent);

    $('#greetingText').textContent = 'Hola';
    $('#aliasText').textContent = s.alias || 'estudiante';

    $('#monthEmoji').textContent = s.monthEmoji || '🗓️';
    $('#monthLabel').textContent = s.monthName || monthDisplayName();

    $('#aliasInput').value = s.alias || '';
    $('#monthNameInput').value = s.monthName || '';
    $('#monthEmojiInput').value = s.monthEmoji || '';

    $all('.toggle-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === s.theme);
    });
    $all('.swatch').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.accent === s.accent);
    });

    const hint = $('#voiceSupportHint');
    hint.textContent = Voice.isSupported
      ? 'Tu dispositivo soporta dictado de movimientos. Busca el ícono de micrófono en Inicio o Egresos.'
      : 'Este navegador no soporta reconocimiento de voz. Puedes seguir registrando movimientos manualmente.';
  }

  function monthDisplayName() {
    const d = new Date();
    const fmt = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
    const label = fmt.format(d);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  // =========================================================
  // Render: hero (balance + alerta) y listas
  // =========================================================
  function render() {
    const t = Rules.totals(state.transactions, state.monthKey);
    const st = Rules.status(t);

    $('#hero').setAttribute('data-status', st);
    $('#balanceAmount').textContent = money(t.saldo);
    $('#totalIngresos').textContent = money(t.totalIngresos);
    $('#totalEgresos').textContent = money(t.totalEgresos);

    const pct = t.totalIngresos > 0 ? Math.max(0, Math.min(100, t.saldoPercent)) : 100;
    $('#balanceBarFill').style.width = pct + '%';

    const labels = {
      ok: 'Presupuesto saludable',
      caution: 'Precaución con tu presupuesto',
      critical: 'Presupuesto en nivel crítico',
    };
    $('#statusLabel').textContent = labels[st];
    $('#balanceSub').textContent = t.totalIngresos > 0
      ? `${Math.max(0, Math.round(t.saldoPercent))}% del ingreso mensual disponible`
      : 'Registra un ingreso para empezar a monitorear tu presupuesto';

    renderAlertBanner(st, t);
    renderTxList($('#txListRecent'), $('#emptyRecent'), sortedTx().slice(0, 6), true);
    renderTxList($('#txListIngresos'), $('#emptyIngresos'), sortedTx().filter(t => t.tipo === 'ingreso'), false);
    renderTxList($('#txListEgresos'), $('#emptyEgresos'), sortedTx().filter(t => t.tipo === 'egreso'), false);
  }

  function sortedTx() {
    return Rules.transactionsForMonth(state.transactions, state.monthKey)
      .slice()
      .sort((a, b) => (b.fecha > a.fecha ? 1 : -1) || (b.creadoEn - a.creadoEn));
  }

  let lastAlertLevel = null;
  function renderAlertBanner(status, totals) {
    const banner = $('#alertBanner');
    if (status === 'ok' || totals.totalIngresos <= 0) {
      banner.classList.add('hidden');
      lastAlertLevel = status;
      return;
    }
    banner.classList.remove('hidden');
    banner.classList.toggle('caution', status === 'caution');
    banner.classList.toggle('critical', status === 'critical');
    banner.textContent = status === 'critical'
      ? `Nivel crítico: te queda ${Math.max(0, Math.round(totals.saldoPercent))}% de tu ingreso mensual. Evita nuevos gastos si puedes.`
      : `Precaución: te queda ${Math.max(0, Math.round(totals.saldoPercent))}% de tu ingreso mensual.`;

    // Notificación local solo cuando se cruza a "critical" por primera vez esta sesión.
    if (status === 'critical' && lastAlertLevel !== 'critical') {
      notifyLocal('Presupuesto en nivel crítico', 'Te queda 10% o menos de tu ingreso de este mes.');
    }
    lastAlertLevel = status;
  }

  function notifyLocal(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'icons/icon-192.png' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') new Notification(title, { body, icon: 'icons/icon-192.png' });
      });
    }
  }

  function renderTxList(ul, emptyEl, list, compact) {
    ul.innerHTML = '';
    if (list.length === 0) {
      emptyEl.classList.add('show');
      return;
    }
    emptyEl.classList.remove('show');
    list.forEach(tx => ul.appendChild(renderTxItem(tx, compact)));
  }

  function renderTxItem(tx, compact) {
    const li = document.createElement('li');
    li.className = `tx-item ${tx.tipo}`;
    const sign = tx.tipo === 'ingreso' ? '+' : '−';
    li.innerHTML = `
      <div class="tx-icon">${CATEGORY_ICONS[tx.categoria] || '✨'}</div>
      <div class="tx-body">
        <div class="tx-desc">${escapeHTML(tx.descripcion)}</div>
        <div class="tx-meta">${CATEGORY_LABELS[tx.categoria] || tx.categoria} · ${formatDate(tx.fecha)}</div>
      </div>
      <div class="tx-amount">${sign} ${money(tx.monto)}</div>
    `;
    if (!compact && tx.tipo === 'egreso') {
      const actions = document.createElement('div');
      actions.className = 'tx-actions';
      actions.innerHTML = `
        <button class="btn-edit" aria-label="Editar" title="Editar">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
        </button>
        <button class="btn-delete" aria-label="Eliminar" title="Eliminar">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-4h6l1 2h4v2H2V5h4l1-2Z"/></svg>
        </button>
      `;
      actions.querySelector('.btn-edit').addEventListener('click', () => openEditModal(tx));
      actions.querySelector('.btn-delete').addEventListener('click', () => openConfirmDelete(tx));
      li.appendChild(actions);
    }
    return li;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  // =========================================================
  // Navegación entre vistas
  // =========================================================
  function goToView(name) {
    $all('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $all('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  }

  $all('.tab').forEach(tab => {
    tab.addEventListener('click', () => goToView(tab.dataset.view));
  });

  // =========================================================
  // Formulario de ingresos
  // =========================================================
  const formIngreso = $('#formIngreso');
  formIngreso.querySelector('[name="fecha"]').value = todayISO();

  formIngreso.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFieldErrors(formIngreso);
    const data = new FormData(formIngreso);
    const descripcion = data.get('descripcion').trim();
    const categoria = data.get('categoria');
    const montoRaw = data.get('monto');
    const fecha = data.get('fecha');

    let hasError = false;
    const vDesc = Rules.validateRequired(descripcion, 'La descripción');
    if (!vDesc.ok) { setFieldError(formIngreso, 'descripcion', vDesc.error); hasError = true; }

    const vMonto = Rules.validateAmount(montoRaw);
    if (!vMonto.ok) { setFieldError(formIngreso, 'monto', vMonto.error); hasError = true; }

    const vFecha = Rules.validateRequired(fecha, 'La fecha');
    if (!vFecha.ok) { setFieldError(formIngreso, 'fecha', vFecha.error); hasError = true; }

    if (hasError) return;

    const tx = {
      id: Storage.uid(),
      tipo: 'ingreso',
      descripcion,
      categoria,
      monto: vMonto.value,
      fecha,
      creadoEn: Date.now(),
    };
    state.transactions.push(tx);
    Storage.saveTransactions(state.transactions);
    formIngreso.reset();
    formIngreso.querySelector('[name="fecha"]').value = todayISO();
    render();
    goToView('dashboard');
  });

  // =========================================================
  // Formulario de egresos (con validación de tope)
  // =========================================================
  const formEgreso = $('#formEgreso');
  formEgreso.querySelector('[name="fecha"]').value = todayISO();
  const egresoTopeError = $('#egresoTopeError');
  const btnGuardarEgreso = $('#btnGuardarEgreso');

  function checkEgresoTope() {
    const montoRaw = formEgreso.querySelector('[name="monto"]').value;
    const fecha = formEgreso.querySelector('[name="fecha"]').value || todayISO();
    const v = Rules.validateAmount(montoRaw);
    if (!v.ok) { egresoTopeError.textContent = ''; btnGuardarEgreso.disabled = false; return; }
    const check = Rules.canRegisterEgreso(state.transactions, { monto: v.value, fecha });
    if (!check.ok) {
      egresoTopeError.textContent = check.motivo;
      btnGuardarEgreso.disabled = true;
    } else {
      egresoTopeError.textContent = '';
      btnGuardarEgreso.disabled = false;
    }
  }
  formEgreso.querySelector('[name="monto"]').addEventListener('input', checkEgresoTope);
  formEgreso.querySelector('[name="fecha"]').addEventListener('change', checkEgresoTope);

  formEgreso.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFieldErrors(formEgreso);
    egresoTopeError.textContent = '';
    const data = new FormData(formEgreso);
    const descripcion = data.get('descripcion').trim();
    const categoria = data.get('categoria');
    const montoRaw = data.get('monto');
    const fecha = data.get('fecha');

    let hasError = false;
    const vDesc = Rules.validateRequired(descripcion, 'La descripción');
    if (!vDesc.ok) { setFieldError(formEgreso, 'descripcion', vDesc.error); hasError = true; }

    const vMonto = Rules.validateAmount(montoRaw);
    if (!vMonto.ok) { setFieldError(formEgreso, 'monto', vMonto.error); hasError = true; }

    const vFecha = Rules.validateRequired(fecha, 'La fecha');
    if (!vFecha.ok) { setFieldError(formEgreso, 'fecha', vFecha.error); hasError = true; }

    if (hasError) return;

    // Regla obligatoria: el egreso no puede dejar el saldo negativo.
    const check = Rules.canRegisterEgreso(state.transactions, { monto: vMonto.value, fecha });
    if (!check.ok) {
      egresoTopeError.textContent = check.motivo;
      return;
    }

    const tx = {
      id: Storage.uid(),
      tipo: 'egreso',
      descripcion,
      categoria,
      monto: vMonto.value,
      fecha,
      creadoEn: Date.now(),
    };
    state.transactions.push(tx);
    Storage.saveTransactions(state.transactions);
    formEgreso.reset();
    formEgreso.querySelector('[name="fecha"]').value = todayISO();
    btnGuardarEgreso.disabled = false;
    render();
    goToView('dashboard');
  });

  function setFieldError(form, name, message) {
    const el = form.querySelector(`.field-error[data-for="${name}"]`);
    if (el) el.textContent = message;
  }
  function clearFieldErrors(form) {
    $all('.field-error', form).forEach(el => el.textContent = '');
  }

  // =========================================================
  // Editar / eliminar egresos
  // =========================================================
  const editModal = $('#editModal');
  const formEditEgreso = $('#formEditEgreso');
  const editTopeError = $('#editTopeError');

  function openEditModal(tx) {
    state.pendingEdit = tx;
    formEditEgreso.descripcion.value = tx.descripcion;
    formEditEgreso.categoria.value = tx.categoria;
    formEditEgreso.monto.value = tx.monto;
    formEditEgreso.fecha.value = tx.fecha;
    editTopeError.textContent = '';
    editModal.classList.remove('hidden');
  }
  $('#editCancel').addEventListener('click', () => editModal.classList.add('hidden'));

  formEditEgreso.addEventListener('submit', (e) => {
    e.preventDefault();
    const tx = state.pendingEdit;
    if (!tx) return;
    const descripcion = formEditEgreso.descripcion.value.trim();
    const categoria = formEditEgreso.categoria.value;
    const montoRaw = formEditEgreso.monto.value;
    const fecha = formEditEgreso.fecha.value;

    const vMonto = Rules.validateAmount(montoRaw);
    if (!vMonto.ok) { editTopeError.textContent = vMonto.error; return; }
    if (!descripcion) { editTopeError.textContent = 'La descripción es obligatoria.'; return; }
    if (!fecha) { editTopeError.textContent = 'La fecha es obligatoria.'; return; }

    // Para validar el tope, se excluye el propio egreso del cálculo actual.
    const otherTx = state.transactions.filter(t => t.id !== tx.id);
    const check = Rules.canRegisterEgreso(otherTx, { monto: vMonto.value, fecha });
    if (!check.ok) {
      editTopeError.textContent = check.motivo;
      return;
    }

    Storage.updateTransaction(tx.id, { descripcion, categoria, monto: vMonto.value, fecha });
    state.transactions = Storage.getTransactions();
    editModal.classList.add('hidden');
    render();
  });

  const confirmModal = $('#confirmModal');
  function openConfirmDelete(tx) {
    state.pendingDelete = tx.id;
    $('#confirmModalText').textContent = `¿Eliminar "${tx.descripcion}" por ${money(tx.monto)}? Esta acción no se puede deshacer.`;
    confirmModal.classList.remove('hidden');
  }
  $('#confirmCancel').addEventListener('click', () => confirmModal.classList.add('hidden'));
  $('#confirmAccept').addEventListener('click', () => {
    if (state.pendingDelete) {
      Storage.deleteTransaction(state.pendingDelete);
      state.transactions = Storage.getTransactions();
      state.pendingDelete = null;
      render();
    }
    confirmModal.classList.add('hidden');
  });

  // =========================================================
  // Ajustes
  // =========================================================
  $all('.toggle-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.theme = btn.dataset.theme;
      Storage.saveSettings(state.settings);
      applySettingsToDOM();
    });
  });
  $all('.swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.accent = btn.dataset.accent;
      Storage.saveSettings(state.settings);
      applySettingsToDOM();
    });
  });
  $('#aliasInput').addEventListener('input', (e) => {
    state.settings.alias = e.target.value;
    Storage.saveSettings(state.settings);
    applySettingsToDOM();
  });
  $('#monthNameInput').addEventListener('input', (e) => {
    state.settings.monthName = e.target.value;
    Storage.saveSettings(state.settings);
    applySettingsToDOM();
  });
  $('#monthEmojiInput').addEventListener('input', (e) => {
    state.settings.monthEmoji = e.target.value;
    Storage.saveSettings(state.settings);
    applySettingsToDOM();
  });
  $('#btnResetData').addEventListener('click', () => {
    state.pendingDelete = 'ALL';
    $('#confirmModalText').textContent = '¿Borrar todos los ingresos y egresos guardados? Esta acción no se puede deshacer.';
    confirmModal.classList.remove('hidden');
  });
  // Ajuste al flujo de confirmación para soportar el borrado total.
  $('#confirmAccept').addEventListener('click', () => {
    if (state.pendingDelete === 'ALL') {
      Storage.saveTransactions([]);
      state.transactions = [];
      state.pendingDelete = null;
      render();
    }
  });

  // =========================================================
  // Registro por voz
  // =========================================================
  function setupVoiceButton(buttonEl, targetForm, categoryMap) {
    buttonEl.addEventListener('click', () => {
      if (!Voice.isSupported) {
        alert('Este navegador no soporta reconocimiento de voz. Puedes registrar el movimiento manualmente.');
        return;
      }
      const hint = $('#voiceHint');
      buttonEl.classList.add('listening');
      if (hint) hint.classList.remove('hidden');

      Voice.listen({
        onResult(transcript) {
          const parsed = Voice.parseUtterance(transcript, categoryMap);
          if (targetForm.descripcion) targetForm.descripcion.value = parsed.descripcion || '';
          if (parsed.monto !== null && targetForm.monto) targetForm.monto.value = parsed.monto;
          if (parsed.categoria && targetForm.categoria) targetForm.categoria.value = parsed.categoria;
          if (targetForm === formEgreso) checkEgresoTope();
        },
        onError(err) {
          buttonEl.classList.remove('listening');
          if (hint) hint.classList.add('hidden');
          if (err !== 'aborted' && err !== 'no-speech') {
            alert('No se pudo reconocer el audio. Intenta de nuevo o escribe el movimiento manualmente.');
          }
        },
        onEnd() {
          buttonEl.classList.remove('listening');
          if (hint) hint.classList.add('hidden');
        },
      });
    });
  }

  setupVoiceButton($('#micBtnEgreso'), formEgreso, Voice.CATEGORY_KEYWORDS);
  setupVoiceButton($('#micBtnDash'), formEgreso, Voice.CATEGORY_KEYWORDS);
  $('#micBtnDash').addEventListener('click', () => goToView('egresos'), { once: false });

  // =========================================================
  // Inicio
  // =========================================================
  applySettingsToDOM();
  render();

  // Registro del service worker (soporte offline / instalación como app).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
