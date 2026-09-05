/**
 * Pruebas unitarias mínimas (sin dependencias) para rules.js.
 * Ejecutar con: node tests/rules.test.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// rules.js está escrito para el navegador (const Rules = (()=>{...})()).
// Lo cargamos con un pequeño shim de `window` para poder reutilizarlo en Node.
const code = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'rules.js'), 'utf8');
const module_ = { exports: {} };
const fn = new Function('module', 'exports', code + '\nmodule.exports = Rules;');
fn(module_, module_.exports);
const Rules = module_.exports;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('✔', name);
    passed++;
  } catch (e) {
    console.error('✖', name, '\n  ', e.message);
    process.exitCode = 1;
  }
}

const MK = '2026-09';

test('el saldo se calcula como ingresos menos egresos del mes activo', () => {
  const tx = [
    { tipo: 'ingreso', monto: 1000000, fecha: '2026-09-01' },
    { tipo: 'egreso', monto: 200000, fecha: '2026-09-05' },
  ];
  const t = Rules.totals(tx, MK);
  assert.strictEqual(t.totalIngresos, 1000000);
  assert.strictEqual(t.totalEgresos, 200000);
  assert.strictEqual(t.saldo, 800000);
});

test('un egreso que no rompe el tope se puede registrar', () => {
  const tx = [{ tipo: 'ingreso', monto: 500000, fecha: '2026-09-01' }];
  const check = Rules.canRegisterEgreso(tx, { monto: 100000, fecha: '2026-09-02' });
  assert.strictEqual(check.ok, true);
});

test('un egreso que dejaría el saldo negativo se bloquea', () => {
  const tx = [
    { tipo: 'ingreso', monto: 500000, fecha: '2026-09-01' },
    { tipo: 'egreso', monto: 450000, fecha: '2026-09-02' },
  ];
  const check = Rules.canRegisterEgreso(tx, { monto: 100000, fecha: '2026-09-03' });
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.maxPermitido, 50000);
});

test('sin ingresos registrados, cualquier egreso se bloquea', () => {
  const check = Rules.canRegisterEgreso([], { monto: 1000, fecha: '2026-09-03' });
  assert.strictEqual(check.ok, false);
});

test('estado "ok" cuando el saldo disponible supera el 30% del ingreso', () => {
  const tx = [
    { tipo: 'ingreso', monto: 1000, fecha: '2026-09-01' },
    { tipo: 'egreso', monto: 500, fecha: '2026-09-02' }, // saldo 50%
  ];
  const t = Rules.totals(tx, MK);
  assert.strictEqual(Rules.status(t), 'ok');
});

test('estado "caution" cuando el saldo disponible llega al 30% o menos', () => {
  const tx = [
    { tipo: 'ingreso', monto: 1000, fecha: '2026-09-01' },
    { tipo: 'egreso', monto: 720, fecha: '2026-09-02' }, // saldo 28%
  ];
  const t = Rules.totals(tx, MK);
  assert.strictEqual(Rules.status(t), 'caution');
});

test('estado "critical" cuando el saldo disponible llega al 10% o menos', () => {
  const tx = [
    { tipo: 'ingreso', monto: 1000, fecha: '2026-09-01' },
    { tipo: 'egreso', monto: 950, fecha: '2026-09-02' }, // saldo 5%
  ];
  const t = Rules.totals(tx, MK);
  assert.strictEqual(Rules.status(t), 'critical');
});

test('la validación de monto rechaza ceros, negativos y vacíos', () => {
  assert.strictEqual(Rules.validateAmount('0').ok, false);
  assert.strictEqual(Rules.validateAmount('-5').ok, false);
  assert.strictEqual(Rules.validateAmount('').ok, false);
  assert.strictEqual(Rules.validateAmount('1000').ok, true);
});

console.log(`\n${passed} prueba(s) superada(s).`);
