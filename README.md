# Logix — Editor de análisis de problemas

Aplicación web educativa para **analizar un problema antes de diseñar su algoritmo**.
En lugar de empezar escribiendo pseudocódigo, el estudiante descompone el problema en una
tabla que relaciona datos de entrada, operaciones, datos resultantes, su propósito y los
caminos de decisión.

Funciona **completamente en el navegador**: sin backend, sin cuentas y sin base de datos remota.

## Tecnologías

- HTML, CSS y JavaScript moderno (ES modules).
- [Tailwind CSS](https://tailwindcss.com/) v4 (compilado con su CLI vía Node).
- APIs nativas del navegador: IndexedDB, File, Blob, FileReader y Drag and Drop.

Sin frameworks de frontend en tiempo de ejecución.

## Puesta en marcha

Requiere [Node.js](https://nodejs.org/) para compilar los estilos y servir la aplicación
(los módulos ES necesitan servirse por HTTP, no por `file://`).

```bash
npm install          # instala las dependencias de desarrollo
npm run build:css    # compila Tailwind -> src/styles/app.css
npm run serve        # sirve la app (abre la URL que muestre, p. ej. http://localhost:3000)
```

Durante el desarrollo puedes recompilar los estilos al vuelo:

```bash
npm run dev:css      # observa cambios y recompila el CSS
```

## Pruebas

```bash
npm test             # ejecuta los tests con el runner de Node (node --test)
```

Las pruebas usan `jsdom` para el pipeline de vistas y `fake-indexeddb` para la persistencia.

## Persistencia y portabilidad

- **Auto-guardado local:** el trabajo se conserva en IndexedDB y se recupera al reabrir la app.
- **Archivo `.analisis`:** con *Guardar archivo* se descarga el análisis (JSON con extensión
  propia) y con *Abrir análisis* se importa. Es la forma portable de mover el trabajo entre
  equipos; IndexedDB es solo una comodidad local.

El archivo incluye una propiedad `version` para permitir migraciones futuras del formato.

## Arquitectura

```text
src/
├── app.js                       # arranque: conecta vistas, persistencia y controlador
├── models/
│   ├── analysisModel.js         # modelo del análisis (datos puros, sin DOM)
│   └── dataTypes.js             # enums: tipos de dato, propósitos y ramas
├── controllers/
│   └── analysisController.js    # única fuente de verdad; coordina estado, vista y storage
├── views/
│   ├── analysisView.js          # barra de herramientas e información del análisis
│   ├── tableView.js             # tabla editable
│   └── dialogs.js               # diálogos de confirmación e información
├── services/
│   ├── storage/storageService.js  # abstracción de IndexedDB
│   └── file/fileService.js        # exportación/importación de .analisis
├── validation/
│   └── analysisValidation.js    # validación de importación y advertencias
├── utils/
│   ├── dom.js                   # ayudas mínimas de DOM
│   └── id.js                    # identificadores únicos
└── styles/                      # input.css (fuente) y app.css (compilado)
```

El flujo de datos es unidireccional: **acción del usuario → estado → persistencia → vista**.
La lógica de negocio se mantiene separada del DOM y de IndexedDB.

Los estándares de desarrollo del proyecto están en [CLAUDE.md](CLAUDE.md).
