# Balance — control financiero mensual para estudiantes

Aplicación móvil (PWA + Android nativo vía Capacitor) para que un estudiante
universitario registre ingresos y egresos, y reciba alertas progresivas
cuando su presupuesto mensual se está agotando.

## Reglas de negocio implementadas

Todas viven en [`www/js/rules.js`](www/js/rules.js), separadas del DOM, y
tienen pruebas unitarias en [`tests/rules.test.js`](tests/rules.test.js).

- El total acumulado de egresos del mes **no puede superar** el total de
  ingresos de ese mismo mes. El botón de guardar se bloquea activamente y
  se muestra el monto máximo permitido.
- Alerta visual de nivel **Precaución** cuando el saldo disponible llega al
  **30 %** del total de ingresos del mes.
- Alerta de nivel **Crítico** (con notificación local del navegador/SO)
  cuando el saldo disponible llega al **10 %**.
- El saldo nunca puede quedar negativo: registrar o editar un egreso que lo
  dejaría en negativo queda bloqueado, con el motivo explicado.
- Los datos persisten localmente (`localStorage`) entre sesiones de la
  misma instalación — no requiere backend ni conexión.

### Registro de ingresos y egresos

- Formularios con descripción, categoría, monto y fecha.
- Validación de campos vacíos y montos no positivos, con mensajes de error
  por campo.
- El saldo disponible se actualiza en tiempo real.
- Los egresos se pueden editar o eliminar, con diálogo de confirmación
  antes de borrar.

## Funcionalidades plus (más allá de lo pedido)

1. **Registro por voz** ([`www/js/voice.js`](www/js/voice.js)): un botón de
   micrófono en el dashboard y en la pantalla de egresos usa la Web Speech
   API para dictar un movimiento ("gasté ocho mil pesos en transporte").
   El sistema extrae monto y categoría, llena el formulario y el usuario
   confirma o edita antes de guardar. Si el reconocimiento falla, se
   muestra un error y se puede reintentar o escribir manualmente.
2. **Personalización de interfaz**: tema claro/oscuro, tres paletas de
   acento (azul, verde, morado), alias del estudiante, y nombre/emoji del
   mes activo — todo persistido localmente y aplicado de inmediato.

## Estructura del repositorio

```
├── www/                    # Código fuente de la app web (PWA)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── storage.js       # Persistencia (localStorage)
│   │   ├── rules.js         # Reglas de negocio (sin DOM, testeable)
│   │   ├── voice.js         # Reconocimiento de voz
│   │   └── app.js           # Controlador de UI
│   ├── manifest.json         # PWA (instalable)
│   └── service-worker.js     # Soporte offline
├── android/                 # Proyecto nativo generado por Capacitor
├── tests/rules.test.js       # Pruebas unitarias de las reglas de negocio
├── capacitor.config.json
├── package.json
└── .github/workflows/build-apk.yml   # CI que genera el APK automáticamente
```

## Cómo probar la app en el navegador (sin instalar nada)

```bash
npm install
npm start          # sirve www/ en http://localhost:5173
```

También puedes abrir `www/index.html` directamente en el navegador (algunas
funciones, como el service worker, requieren servirla por http/https).

## Cómo obtener el APK

Compilar un APK requiere el SDK de Android y Gradle, que no están
disponibles en este entorno de generación. Hay dos caminos, ambos ya
preparados en este repositorio:

### Opción A — Automático con GitHub Actions (recomendado)

1. Sube este repositorio a GitHub.
2. En la pestaña **Actions**, se ejecutará automáticamente el workflow
   `Build Android APK` (o ejecútalo manualmente con "Run workflow").
3. Al terminar, descarga el artefacto **`balance-app-debug-apk`** desde la
   página de esa ejecución: ahí está el `app-debug.apk` instalable.

El workflow está en `.github/workflows/build-apk.yml`: usa un runner de
GitHub con JDK 17 y Android SDK preinstalados, sincroniza los assets web
con Capacitor y corre `./gradlew assembleDebug`.

### Opción B — Localmente con Android Studio

1. Instala [Android Studio](https://developer.android.com/studio) (incluye
   el SDK de Android).
2. `npm install`
3. `npx cap sync android`
4. `npx cap open android` (abre el proyecto en Android Studio) y compila
   desde ahí, o desde la terminal:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
5. El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

> Para publicar en Play Store necesitarás generar un `assembleRelease`
> firmado con tu propio keystore; el flujo debug de arriba es suficiente
> para instalar y probar en cualquier celular Android habilitando
> "orígenes desconocidos".

## Pruebas

```bash
node tests/rules.test.js
```

## Notas de diseño

El color de todo el encabezado (el "hero") cambia según la salud del
presupuesto del mes — azul/verde/morado normal, ámbar en precaución, rojo
en crítico — para que el estado financiero se perciba de un vistazo sin
tener que leer números.
