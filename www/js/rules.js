/**
 * rules.js
 * Reglas de negocio obligatorias, aisladas del DOM para que sean
 * fáciles de razonar y probar:
 *  - el total de egresos nunca puede superar el total de ingresos del mes
 *  - alerta "Precaución" cuando el saldo disponible llega al 30% del ingreso
 *  - alerta "Crítico" cuando el saldo disponible llega al 10% del ingreso
 *  - el saldo nunca puede quedar negativo
 */
const Rules = (() => {

  function monthKey(dateStr) {
    // dateStr: 'YYYY-MM-DD' -> 'YYYY-MM'
    return (dateStr || '').slice(0, 7);
  }

  function currentMonthKey() {
    const d = new Date();
    return d.toISOString().slice(0, 7);
  }

  function transactionsForMonth(transactions, monthKeyValue) {
    return transactions.filter(t => monthKey(t.fecha) === monthKeyValue);
  }

  function totals(transactions, monthKeyValue) {
    const monthTx = transactionsForMonth(transactions, monthKeyValue);
    const totalIngresos = monthTx
      .filter(t => t.tipo === 'ingreso')
      .reduce((sum, t) => sum + t.monto, 0);
    const totalEgresos = monthTx
      .filter(t => t.tipo === 'egreso')
      .reduce((sum, t) => sum + t.monto, 0);
    const saldo = totalIngresos - totalEgresos;
    const saldoPercent = totalIngresos > 0 ? (saldo / totalIngresos) * 100 : 0;
    return { totalIngresos, totalEgresos, saldo, saldoPercent };
  }

  /**
   * Estado del presupuesto según el saldo disponible restante.
   * 'ok'       -> saldo por encima del 30% del ingreso
   * 'caution'  -> saldo entre 10% (exclusivo) y 30% (inclusivo) del ingreso
   * 'critical' -> saldo en 10% o menos del ingreso
   */
  function status({ totalIngresos, saldoPercent }) {
    if (totalIngresos <= 0) return 'ok'; // sin ingresos aún, no hay base para alertar
    if (saldoPercent <= 10) return 'critical';
    if (saldoPercent <= 30) return 'caution';
    return 'ok';
  }

  /**
   * Valida si un egreso propuesto puede registrarse sin romper las
   * reglas de negocio. No muta nada, solo evalúa.
   */
  function canRegisterEgreso(transactions, { monto, fecha }) {
    const mKey = monthKey(fecha);
    const { totalIngresos, totalEgresos } = totals(transactions, mKey);
    const nuevoTotalEgresos = totalEgresos + monto;
    const maxPermitido = Math.max(totalIngresos - totalEgresos, 0);

    if (nuevoTotalEgresos > totalIngresos) {
      return {
        ok: false,
        maxPermitido,
        motivo: totalIngresos === 0
          ? 'Todavía no has registrado ingresos este mes, así que no hay presupuesto disponible para gastar.'
          : `Ese monto dejaría el saldo en negativo. Como máximo puedes registrar ${maxPermitido} en este mes.`,
      };
    }
    return { ok: true, maxPermitido };
  }

  function validateAmount(value) {
    const n = Number(value);
    if (value === '' || value === null || value === undefined) return { ok: false, error: 'El monto es obligatorio.' };
    if (Number.isNaN(n)) return { ok: false, error: 'Ingresa un número válido.' };
    if (n <= 0) return { ok: false, error: 'El monto debe ser mayor que cero.' };
    return { ok: true, value: n };
  }

  function validateRequired(value, label) {
    if (!value || !String(value).trim()) return { ok: false, error: `${label} es obligatorio.` };
    return { ok: true };
  }

  return {
    monthKey,
    currentMonthKey,
    transactionsForMonth,
    totals,
    status,
    canRegisterEgreso,
    validateAmount,
    validateRequired,
  };
})();
