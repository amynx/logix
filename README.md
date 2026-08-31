# Logix — Editor de análisis de problemas

Aplicación web educativa para **analizar un problema antes de diseñar su algoritmo**.
En lugar de empezar escribiendo pseudocódigo, el estudiante descompone el problema en una
tabla que relaciona datos de entrada, operaciones, datos resultantes, su propósito y los
caminos de decisión.

Funciona **completamente en el navegador**: sin backend, sin cuentas y sin base de datos remota.

## Conceptos clave

- **Catálogo de datos con identidad.** Cada dato (entrada o resultado) tiene un `id`; su nombre
  y tipo viven en un único lugar. Las filas referencian los datos por id, así que un resultado
  producido queda disponible para reutilizarse y renombrar propaga a todas sus referencias.
- **Operaciones y condiciones como expresiones.** No se escriben como texto: se **construyen**
  seleccionando referencias a datos, operadores (aritméticos, relacionales, lógicos y
  paréntesis) y literales (p. ej. `nota1 + nota2 + nota3 ÷ 3`, o `promedio ≥ 3`). Las piezas se
  pueden reordenar arrastrándolas. Esto evita inconsistencias de nombres y valores.
- **Cadena del análisis.** Bajo la tabla se dibuja en vivo la cadena
  **Entradas → Proceso → Salida**, derivada del modelo: las entradas externas (datos que se
  consumen pero nadie produce), las actividades en orden y la información final.
- **Ayudas no bloqueantes.** El tipo del dato resultante se sugiere según los operadores usados,
  y se avisan puntos por completar sin impedir experimentar.

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

El archivo incluye una propiedad `version` (actualmente **4**) que permite migrar formatos
antiguos al abrirlos, sin perder el trabajo. Las migraciones encadenadas viven en
`analysisValidation.js`.

## Arquitectura

```text
src/
├── app.js                       # arranque: conecta vistas, persistencia y controlador
├── models/
│   ├── analysisModel.js         # análisis, catálogo de datos y referencias (datos puros)
│   ├── dataTypes.js             # enums: tipos de dato, propósitos y ramas
│   ├── operators.js             # operadores y derivación de expresiones a texto
│   └── chainModel.js            # derivación pura Entradas → Proceso → Salida
├── controllers/
│   └── analysisController.js    # única fuente de verdad; coordina estado, vistas y storage
├── views/
│   ├── analysisView.js          # barra de herramientas e información del análisis
│   ├── tableView.js             # tabla editable (incluye el constructor de expresiones)
│   ├── chainView.js             # panel de la cadena del análisis
│   └── dialogs.js               # diálogos de confirmación e información
├── services/
│   ├── storage/storageService.js  # abstracción de IndexedDB
│   └── file/fileService.js        # exportación/importación de .analisis
├── validation/
│   └── analysisValidation.js    # validación de importación, migraciones y advertencias
├── utils/
│   ├── dom.js                   # ayudas mínimas de DOM
│   └── id.js                    # identificadores únicos
└── styles/                      # input.css (fuente) y app.css (compilado)
```

El flujo de datos es unidireccional: **acción del usuario → estado → persistencia → vista**.
La lógica de negocio (modelo, operadores, cadena, validación) se mantiene separada del DOM y de
IndexedDB, de modo que pueda reutilizarse para otras representaciones (pseudocódigo, diagramas).

Los estándares de desarrollo del proyecto están en [CLAUDE.md](CLAUDE.md).
