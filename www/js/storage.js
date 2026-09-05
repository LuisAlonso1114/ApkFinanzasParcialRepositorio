/**
 * storage.js
 * Capa de persistencia. Todo se guarda en localStorage para que
 * los datos sobrevivan entre sesiones de la misma instalación,
 * sin necesidad de backend ni conexión.
 */
const Storage = (() => {
  const KEYS = {
    TX: 'balance:transactions',
    SETTINGS: 'balance:settings',
  };

  const DEFAULT_SETTINGS = {
    theme: 'light',
    accent: 'azul',
    alias: 'estudiante',
    monthName: '',
    monthEmoji: '🗓️',
  };

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error leyendo', key, e);
      return fallback;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error guardando', key, e);
      return false;
    }
  }

  return {
    getTransactions() {
      return _read(KEYS.TX, []);
    },
    saveTransactions(list) {
      return _write(KEYS.TX, list);
    },
    addTransaction(tx) {
      const list = this.getTransactions();
      list.push(tx);
      this.saveTransactions(list);
      return tx;
    },
    updateTransaction(id, patch) {
      const list = this.getTransactions();
      const idx = list.findIndex(t => t.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch };
      this.saveTransactions(list);
      return list[idx];
    },
    deleteTransaction(id) {
      const list = this.getTransactions().filter(t => t.id !== id);
      this.saveTransactions(list);
    },
    getSettings() {
      return { ...DEFAULT_SETTINGS, ..._read(KEYS.SETTINGS, {}) };
    },
    saveSettings(settings) {
      return _write(KEYS.SETTINGS, settings);
    },
    resetAll() {
      localStorage.removeItem(KEYS.TX);
      localStorage.removeItem(KEYS.SETTINGS);
    },
    uid() {
      return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    },
  };
})();
