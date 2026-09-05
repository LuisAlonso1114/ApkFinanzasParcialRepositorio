/**
 * voice.js
 * Registro de movimientos por comando de voz usando la Web Speech API.
 * Extrae monto y categoría de una frase en español; el resto del texto
 * se usa como descripción. El usuario siempre confirma/edita antes de guardar.
 */
const Voice = (() => {
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SpeechRecognitionImpl;

  // Categorías reconocidas y sus palabras gatillo.
  const CATEGORY_KEYWORDS = {
    alimentacion: ['comida', 'almuerzo', 'desayuno', 'cena', 'mercado', 'restaurante', 'alimentacion', 'alimentación'],
    transporte: ['transporte', 'bus', 'buseta', 'taxi', 'uber', 'gasolina', 'pasaje', 'metro'],
    entretenimiento: ['entretenimiento', 'cine', 'salida', 'fiesta', 'streaming', 'juego', 'concierto'],
    salud: ['salud', 'medicina', 'farmacia', 'doctor', 'droguería', 'drogueria'],
    educacion: ['educacion', 'educación', 'libro', 'curso', 'matricula', 'matrícula', 'universidad'],
  };

  const UNIT_WORDS = {
    'cero': 0, 'un': 1, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12,
    'trece': 13, 'catorce': 14, 'quince': 15, 'veinte': 20, 'treinta': 30, 'cuarenta': 40,
    'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
    'cien': 100, 'cientos': 100, 'mil': 1000, 'millon': 1000000, 'millón': 1000000,
  };

  /** Convierte números escritos en palabras (español, casos comunes) a entero. */
  function wordsToNumber(text) {
    const tokens = text
      .toLowerCase()
      .replace(/y/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    let total = 0;
    let current = 0;
    let found = false;

    for (const tok of tokens) {
      const clean = tok.replace(/[.,]/g, '');
      if (UNIT_WORDS[clean] !== undefined) {
        found = true;
        const val = UNIT_WORDS[clean];
        if (val === 1000 || val === 1000000) {
          current = (current === 0 ? 1 : current) * val;
          total += current;
          current = 0;
        } else if (val === 100) {
          current = (current === 0 ? 1 : current) * val;
        } else {
          current += val;
        }
      }
    }
    total += current;
    return found ? total : null;
  }

  /** Extrae el primer monto (dígitos o en palabras) presente en el texto. */
  function extractAmount(text) {
    const digitMatch = text.match(/(\d[\d.,]*)/);
    if (digitMatch) {
      const cleaned = digitMatch[1].replace(/\./g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      if (!Number.isNaN(n)) return n;
    }
    return wordsToNumber(text);
  }

  function extractCategory(text, categoryMap) {
    const lower = text.toLowerCase();
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => lower.includes(k))) return cat;
    }
    return null;
  }

  /**
   * Interpreta una frase dictada y devuelve { descripcion, monto, categoria }.
   * categoryMap permite pasar categorías distintas para ingresos/egresos.
   */
  function parseUtterance(text, categoryMap = CATEGORY_KEYWORDS) {
    const monto = extractAmount(text);
    const categoria = extractCategory(text, categoryMap);
    // Descripción: se usa la frase completa, limpiando muletillas comunes.
    let descripcion = text
      .replace(/^(gaste|gasté|pague|pagué|compre|compré|recibi|recibí|ingreso de|ingresé)\s*/i, '')
      .trim();
    if (!descripcion) descripcion = text.trim();
    return { descripcion, monto, categoria };
  }

  let recognitionInstance = null;

  function listen({ onResult, onError, onEnd, onStart }) {
    if (!isSupported) {
      onError && onError('unsupported');
      return null;
    }
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => onStart && onStart();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult && onResult(transcript);
    };
    recognition.onerror = (event) => onError && onError(event.error);
    recognition.onend = () => onEnd && onEnd();

    recognitionInstance = recognition;
    recognition.start();
    return recognition;
  }

  function stop() {
    if (recognitionInstance) recognitionInstance.stop();
  }

  return {
    isSupported,
    listen,
    stop,
    parseUtterance,
    CATEGORY_KEYWORDS,
  };
})();
