# Handoff: rediseño de la interfaz de análisis (Logix)

## Resumen

Rediseño completo del flujo de análisis de problemas de Logix, la herramienta con la que estudiantes de primer curso descomponen un problema en datos, actividades y una conclusión. Cubre las cuatro etapas del análisis —Problema, Datos, Construcción (Actividades) y Cadena—, la barra superior, el paso por etapas y los estados vacíos de cada etapa.

El objetivo del rediseño: que la pantalla no abrume. Cada etapa muestra una sola tarea, con una línea de ayuda contextual, y la relación entre pasos se hace visible con conectores en vez de con columnas de tabla.

Repositorio de destino: `amynx/logix-preview`, rama `main`.

## Sobre los archivos de diseño

Los archivos `.dc.html` de este paquete son **referencias de diseño hechas en HTML**: prototipos que muestran el aspecto y el comportamiento buscados, no código para copiar y pegar. La tarea es **recrear estos diseños dentro del entorno que ya tiene el repositorio** —JavaScript sin framework, vistas construidas con el helper `el()` de `src/utils/dom.js`, Tailwind por CDN— siguiendo sus patrones actuales.

Los prototipos usan estilos en línea porque así se construyeron; **en el repositorio no debe hacerse así**. Ver "Cómo trasladarlo al repositorio".

## Fidelidad

**Alta (hifi).** Colores, tipografía, espaciado y estados son definitivos: el usuario pidió que la implementación sea idéntica al prototipo. Cuando un valor no esté en la escala por defecto de Tailwind, usa el token CSS correspondiente de `tokens.css` (ver "Design tokens").

## Cómo trasladarlo al repositorio

Convenciones que el proyecto ya sigue y que hay que respetar:

- **Vistas solo DOM.** Cada archivo de `src/views/` construye nodos con `el()` y recibe callbacks; no lee ni escribe el modelo, no persiste nada. `analysisController.js` sigue siendo el único que orquesta estado, historial (deshacer/rehacer) y guardado.
- **El modelo no cambia.** `analysisModel.js`, `chainModel.js`, `operators.js`, `dataTypes.js` y `nameConventions.js` se quedan como están. La etapa Cadena sigue derivándose de `buildChain(analysis)`; el rediseño solo cambia cómo se pinta.
- **Comentarios en español**, en la cabecera de cada archivo y sobre las funciones no obvias, explicando la intención pedagógica —no el mecanismo—, como ya hacen las vistas actuales.
- **Tailwind + tokens propios.** Sigue usando clases de utilidad para layout, espaciado y tipografía. Para los colores, radios y sombras del rediseño, importa `tokens.css` y úsalos vía `bg-[var(--lx-surface)]`, `border-[var(--lx-border)]`, `rounded-[var(--lx-r-card)]`, `shadow-[var(--lx-shadow-card)]`. No introduzcas hexadecimales sueltos en las vistas.
- **Constantes de clase compartidas.** El proyecto ya define `INPUT_CLASS`, `TH_CLASS`, `GHOST_BUTTON_CLASS`, etc. al principio de cada vista. Extiende ese patrón: define `CARD_CLASS`, `CHIP_CLASS`, `ZONE_LABEL_CLASS` una vez y reutilízalas en lugar de repetir cadenas largas.
- **Modo oscuro.** `src/utils/theme.js` alterna el tema y el botón de contraste sigue en la barra. Cada token nuevo necesita su valor equivalente bajo `.dark` en `tokens.css`; el prototipo solo define el tema claro.
- **Accesibilidad.** Mantén `aria-label`/`title` en los botones solo-icono, `scope="col"` en las cabeceras de tabla y el foco visible en los controles (el prototipo usa `focus` con borde violeta).

### Mapa de archivos

| Parte del rediseño | Archivo del repo a modificar |
| --- | --- |
| Barra superior, logo, estado de guardado, deshacer/rehacer | `src/views/analysisView.js` (`renderToolbar`, `renderStatus`), `src/views/icons.js` |
| Paso por etapas y línea de ayuda | `src/views/stageNav.js` |
| Etapa Problema (título, descripción, enunciado con fragmentos) | `src/views/analysisView.js` (`renderInfo`) |
| Etapa Datos (tabla y datos resultantes) | `src/views/inputsView.js` |
| Etapa Construcción (tarjeta de actividad y riel) | `src/views/cardsView.js`, `src/views/cardLayout.js`, `src/views/rowEditor.js`, `src/views/rowSummary.js` |
| Selector de elementos (datos, operadores, valores) | `src/views/rowEditor.js`, `src/views/mentionMenu.js` |
| Etapa Cadena | `src/views/chainView.js` |
| Tokens y estilos base | `src/styles/app.css` (importar `tokens.css` o pegar su contenido al inicio) |

---

## Design tokens

Todos en `tokens.css` (incluido en este paquete). Resumen:

**Colores.** Violeta `oklch(0.50 0.15 300)` es la acción primaria, la marca y la familia "operación". Ámbar `oklch(0.55 0.12 70)` es la familia "condición". Verde `oklch(0.66 0.13 160)` marca lo completado y los datos resultantes. Fondo de la aplicación `oklch(0.975 0.004 265)`; superficies blancas; bordes `oklch(0.92 0.008 280)`.

Cada familia semántica de dato tiene tríada fondo/borde/texto: entrada (violeta 292), resultante (verde 158), condición (ámbar 78). Se usan igual en chips, celdas y nodos de la cadena, y es lo que permite reconocer de un vistazo de dónde sale cada dato.

**Tipografía.**

| Uso | Familia | Tamaño / peso |
| --- | --- | --- |
| Título de página | Outfit | 26px / 600, `letter-spacing:-0.02em` |
| Título de tarjeta | Outfit | 21px / 600, `-0.015em` |
| Título de sección | Outfit | 16–17px / 600, `-0.01em` |
| Marca "Logix" | Outfit | 17px / 600, `-0.01em` |
| Texto de interfaz | Instrument Sans | 13.5px / 400–500 |
| Ayuda contextual | Instrument Sans | 12.5px / 400, color `--lx-ink-muted` |
| Etiqueta de sección | Instrument Sans | 11.5px / 600, mayúsculas, `letter-spacing:0.08em` |
| Nombres de datos y expresiones | JetBrains Mono | 13px / 400–500 |

**Radios.** Chip 8px · control 9px · campo 11px · panel 14px · tarjeta 18px. **Sombra de tarjeta:** `0 1px 2px oklch(0.30 0.02 275/0.04), 0 12px 28px -22px oklch(0.30 0.02 275/0.35)`. **Sombra de panel emergente:** `0 1px 2px .../0.05, 0 16px 32px -24px .../0.6`.

**Espaciado.** Escala de 4: gap 6–10px dentro de un grupo, 14px entre grupos, 22px entre columnas, 26px de padding superior del contenido. Ancho máximo del contenido 1320px; la etapa Cadena se centra a 720px y la etapa Datos a 1000px.

---

## Pantallas

### Barra superior (todas las etapas)

Altura 58px, fondo blanco, borde inferior `--lx-border-soft`, padding `14px 28px`.

Izquierda: marca + estado + historial, en una fila con `gap:10px`.
- **Logo (nuevo).** Cuadrado de 30px, radio **8px**, fondo violeta. Dentro, SVG de 19px en `viewBox 0 0 24 24`: tres nodos en diagonal descendente unidos por dos enlaces —`circle(6.2,7,r2.1)`, `circle(12,12,r3)`, `circle(17.8,17,r2.1)`; líneas `6.2,7 → 12,12` y `12,12 → 17.8,17`, `stroke:#fff`, `stroke-width:1.5`, `stroke-linecap:round`. Todo a opacidad completa. Significa dato → operación → resultado; el nodo central, mayor, es el paso activo. Sustituye a la red de cinco nodos anterior. El SVG completo está en `Logix · Logo.dc.html`, opción 1a, junto con las dos alternativas descartadas y la versión favicon de 16px.
- Marca "Logix" (Outfit 17/600) + `· Análisis de problemas` (13.5px, `--lx-ink-muted`).
- Píldora de guardado: `3px 9px`, radio 999px, fondo `oklch(0.955 0.035 158)`, borde `oklch(0.90 0.055 158)`, texto `oklch(0.42 0.10 158)`, icono check de 12px. Conserva el ancho reservado que ya tiene la vista para que el cambio de estado no mueva el layout.
- Deshacer/rehacer: 30×30px, radio 8px, fantasma; el deshabilitado baja a `oklch(0.72 0.015 275)`.

Derecha (`margin-left:auto`, `gap:8px`, envuelve en pantallas estrechas): Archivo ▾, **Exportar PDF** (primario violeta), Ejemplo guiado, Guía, Ayuda, y botón cuadrado de contraste (34×34). Botones de 34px de alto, radio 9px, borde `oklch(0.91 0.006 275)`, texto 13.5px; hover `background: oklch(0.975 0.004 265)`.

### Paso por etapas (todas las etapas)

Franja blanca bajo la barra, borde inferior, contenido a 1320px, padding `10px 28px 11px`.

Cuatro botones —Problema, Datos, Construcción, Cadena— separados por un conector: línea de 30×1px, `oklch(0.90 0.006 275)`, margen lateral 6px. Cada botón: `6px 11px`, radio 9px; disco de 20px con `✓` blanco sobre `oklch(0.72 0.14 158)` si la etapa está completa, o el número sobre blanco con borde si no; etiqueta 14px. La etapa actual lleva fondo `oklch(0.972 0.018 300)` y borde `oklch(0.90 0.04 300)`, peso 600.

Debajo, **una sola línea de ayuda** de 12.5px alineada al borde izquierdo del primer botón (`margin-left:2px`), que cambia con la etapa:
- Problema — "Entiende el problema y quién lo resuelve."
- Datos — "Identifica los datos que recibe el programa."
- Construcción — "Descompón el proceso paso a paso."
- Cadena — "Observa cómo fluye tu razonamiento."

Encabezado de página bajo la franja: antetítulo `PASO N DE 4 · ETAPA` (11.5px/600, mayúsculas, `0.09em`, violeta), título (Outfit 26/600) y entradilla (14px, `--lx-ink-muted`, máx. 62ch).

| Etapa | Título | Entradilla |
| --- | --- | --- |
| Problema | El problema | Escribe de qué trata. Si tienes el enunciado, úsalo para identificar los datos. |
| Datos | Datos de entrada | Transforma lo que dice el enunciado en datos con nombre y tipo. En las actividades solo se reutilizan estos. |
| Construcción | Actividades | Descompón el proceso en pasos. Cada paso toma unos datos, hace algo con ellos y produce uno nuevo. |
| Cadena | Cadena del análisis | Cómo fluye tu razonamiento: de los datos a la información final. |

### Etapa 1 · Problema

Dos tarjetas en fila (`gap:22px`), que se apilan por debajo de ~820px.

**Izquierda (flex 1 1 380px)** — "De qué trata", con el numeral 1 en cuadrado de 18px. Dos campos: *Título del análisis* (campo de 10×13px, radio 11px, texto 14.5px) y *Descripción del problema* (mínimo 78px de alto, 13.5px, interlineado 1.55) con la ayuda "Contexto general: qué necesidad debe resolver el programa." Mantiene los `id` actuales (`analysis-title`, `analysis-description`) y el comportamiento existente: capitalización al desenfocar y menciones de datos en la descripción (`attachMentions`).

**Derecha (flex 1.3 1 440px)** — "El enunciado", borde violeta suave `oklch(0.90 0.03 300)`.
- Casilla "Tengo el enunciado del problema": botón de fila completa, radio 11px, con cuadro de 17px que se rellena de violeta y muestra `✓` cuando está activo. Sustituye a la casilla nativa actual.
- Desactivada: párrafo explicativo "Si lo activas, podrás pegar el enunciado y seleccionar fragmentos para convertirlos en datos de entrada. Si no, los declararás a mano en la etapa Datos."
- Activada: ayuda "Toca un fragmento resaltado para convertirlo en un dato de entrada." y el enunciado en un panel `oklch(0.985 0.004 285)`, radio 14px, texto 15px con **interlineado 2.05** (el aire es lo que hace que los fragmentos resaltados se lean sin apelmazarse).
- Cada fragmento identificable es un `<span>` de `2px 6px`, radio 7px. Sin agregar: fondo `oklch(0.975 0.004 285)`, borde `oklch(0.91 0.01 285)`. Agregado: fondo `--lx-entrada-bg`, borde `--lx-entrada-border`, texto `--lx-entrada-fg`. Cursor pointer; al pulsarlo se agrega o se quita el dato.
- Pie: "N de 4 fragmentos agregados como datos" a la izquierda y botón "Ver los datos →" a la derecha.

En el repositorio, la selección libre de texto del `textarea` que ya existe debe seguir funcionando: los fragmentos resaltados son los ya identificados; seleccionar texto nuevo mantiene la barra de acción actual ("Agregar «…» como dato de entrada").

### Etapa 2 · Datos de entrada

Columna de 1000px, `gap:16px`.

**Leyenda de transformación.** Fila punteada, radio 12px: `Enunciado → Dato identificado → Nombre en el análisis`, cada paso como chip; el último en violeta y monoespaciada. Cierra con "· p. ej. «4 en el primer parcial» → nota1". Es la vista actual `transformationLegend()` con la paleta nueva.

**Tarjeta "Datos de entrada".** Cabecera con título (Outfit 17/600), recuento ("4 datos") y "+ Agregar dato" a la derecha. Tabla con `min-width:640px` dentro de un contenedor con scroll horizontal. Cabecera con fondo `--lx-surface-sunken`: cada columna lleva su nombre (11.5px/600) y debajo su nota en 400 y `oklch(0.60 0.015 275)`:

| Columna | Nota | Ancho |
| --- | --- | --- |
| Dato identificado | Fragmento del enunciado | flex 2 1 200px |
| Valor | Opcional | 74px |
| Tipo | Numérico, Lógico, Texto | 104px |
| Nombre | Nombre en el algoritmo | flex 1 1 150px |
| (acciones) | — | 30px |

Filas de `12px 22px`, separadas por `oklch(0.965 0.004 285)`. El nombre va en monoespaciada violeta (`--lx-entrada-fg`), el tipo en chip gris, el valor en monoespaciada. Botón de eliminar `✕` fantasma que en hover pasa a fondo `oklch(0.96 0.02 25)` y texto `oklch(0.55 0.15 25)`. Se conserva la doble estructura de columnas de la vista actual: sin enunciado, el orden es Nombre · Tipo · Valor y desaparece "Dato identificado".

**Tarjeta "Datos resultantes".** Fondo `--lx-surface-muted`, solo lectura. Ayuda: "No los escribes aquí: aparecen cuando una actividad produce un dato nuevo." Cada dato es una fila de 240px mínimo con nombre en monoespaciada verde, chip de tipo y, a la derecha, la actividad que lo produce ("Actividad 1 · Sumar las tres notas").

### Etapa 3 · Construcción (Actividades)

Dos columnas: riel de flujo (268px, `position:sticky; top:20px`) y la tarjeta de la actividad activa (flex 1 1 560px). Por debajo de 1010px la tarjeta pasa a una sola columna (ver "Responsive").

**Riel.** Cabecera "EL FLUJO" + "N pasos". Cada actividad es un botón: numeral de 24px, título (13.5px, elipsis), subtítulo con su clase ("Operación"/"Condición") y un punto de estado de 7px (verde completado, violeta activo, gris pendiente). La activa lleva fondo y borde de su familia. **Entre dos pasos consecutivos**, un conector: línea vertical de 22px a 24px del borde izquierdo y, a su lado, un chip monoespaciado con el dato que se transporta (`sumaNotas`). Es lo que hace visible el encadenamiento. Debajo, dos botones punteados: "Agregar operación" (hover violeta) y "Agregar condición" (hover ámbar).

**Barra de contexto** sobre la tarjeta (opcional, tweak `resaltarFlujo`): `Actividad anterior → Actividad actual → Siguiente`, 12.5px, fondo `oklch(0.955 0.012 290)`.

**Tarjeta de actividad.** Radio 18px, sombra de tarjeta.
- *Cabecera* (`20px 24px 18px`): cuadrado de 30px con el número, sobre violeta o ámbar según la clase; encima el rótulo de clase en mayúsculas 11.5px; título Outfit 21/600; ayuda debajo ("Una operación calcula o transforma datos para obtener uno nuevo." / "Una condición comprueba algo: una pregunta que se responde Sí o No."). A la derecha, `✕` para eliminar. Si es condición, el fondo de la cabecera vira a `oklch(0.992 0.008 80)`.
- *Cuerpo en tres zonas* separadas por un conector circular de 26px con `→` (o `↓` cuando se apilan): **1 Qué necesitas** (flex 1 1 240px) · **2 Qué haces / Qué compruebas** (flex 1.25 1 280px) · **3 Qué obtienes** (flex 1 1 220px). Cada zona lleva numeral de 18px, título 13px/600 y una ayuda de 12.5px que se puede ocultar.
- Zona 1: cada dato es una fila de `9px 11px`, radio 10px, con el nombre en monoespaciada y el chip de tipo a la derecha; los producidos por otra actividad llevan fondo violeta suave y el símbolo `↩`. Debajo, "+ Agregar dato" punteado.
- Zona 2: si es condición, primero la pregunta en un panel ámbar (`¿El promedio es mayor o igual a la nota aprobatoria?`). Después la caja de expresión: fondo `--lx-surface-sunken`, radio 12px, con los elementos como fichas monoespaciadas de `4px 9px` —referencias en violeta, condiciones en ámbar, literales en gris, operadores sin fondo— y un botón punteado "+ elemento".
- Zona 3: panel de `13px 14px` con el nombre del resultado en monoespaciada 15px y su chip de tipo; violeta para operación, ámbar para condición.
- *Caminos de la condición* (solo condiciones): panel ámbar "Entonces, ¿qué pasa en cada caso?" con dos filas `Sí → Aprueba` / `No → Reprueba`; la etiqueta del caso en chip verde o rojo.
- *Pie "¿Y después?"*: fondo `--lx-surface-muted`, borde superior. Grupo segmentado de tres propósitos ("Usar en una nueva operación", "Usar para tomar una decisión", "Generar la información final"), a la derecha el destino ("Se usa en: Actividad 2 · Calcular el promedio") y el comentario.
- *Pie de navegación*: "← Paso anterior", "Actividad N de M" y "Siguiente actividad →" (en la última, "Continuar a Cadena →", que lleva a la etapa 4).

**Selector de elementos.** Panel emergente que aparece bajo el botón que lo abre (radio 13px, borde violeta, sombra de panel), no un modal. Estructura: pregunta ("¿De dónde sale el dato?" / "¿Qué agregas a la expresión?"), fila de categorías, una línea de ayuda que cambia con la categoría, y la rejilla de elementos.

| Categoría | Ayuda | Disponible en |
| --- | --- | --- |
| Dato de entrada | Los que declaraste en el paso Datos. | datos y expresión |
| Dato resultante | Los que produjo otra actividad. | datos y expresión |
| Condición | El resultado de una comprobación anterior. | expresión |
| Valor fijo | Un número o texto que escribes tú. | expresión (campo de texto + "Agregar") |
| Operador | Qué relación hay entre los elementos. | expresión |

Cada elemento es un chip con su nombre y, en gris, su tipo o su lectura en palabras (`≥` → "mayor o igual"). Los ya usados se muestran apagados. El panel se queda abierto para poder agregar varios; cierra con "Listo". Pie: "Agrega los elementos en el orden en que se leen."

### Etapa 4 · Cadena

Columna centrada de 720px.

Arriba, cuatro píldoras de resumen (borde `--lx-border`, fondo blanco, punto de color de 7px): "4 datos de entrada" (violeta), "2 operaciones" (violeta), "1 decisión" (ámbar), "2 respuestas finales" (verde). Singular y plural correctos.

Debajo, el flujo vertical, con un `↓` de 14px centrado y 7px de aire entre bloques:
1. **Entradas** — panel violeta (`oklch(0.982 0.014 292)`, borde `oklch(0.91 0.035 292)`), rótulo en mayúsculas y chips de dato.
2. **Una tarjeta por actividad** — radio 14px; blanca con borde gris para operaciones, ámbar suave para condiciones. Cabecera: numeral de 22px en el color de su familia, título 14px/600 y, a la derecha, la clase. Cuerpo indentado 31px: la pregunta en cursiva (condiciones), la expresión en una caja blanca con las fichas ya descritas, `→` y el dato producido en chip verde, y para la condición sus dos caminos.
3. **Información final** — panel verde con borde de 2px `oklch(0.86 0.07 158)`, rótulo en mayúsculas y una fila por respuesta: chip del caso (Sí verde sólido, No rojo sólido), el valor y "cuando cumpleNotaAprobatoria".

### Estados vacíos

Regla común: nunca un cartel de "no hay nada". Se muestra el esqueleto de lo que va a haber, más la acción que lo llena.

- **Problema.** Campos con su texto de ejemplo en `--lx-ink-ghost` ("Ej.: Determinar si un estudiante aprueba", "Describe el problema del mundo real que se quiere resolver") y el panel del enunciado colapsado tras la casilla.
- **Datos.** La tabla conserva cabecera y muestra una fila fantasma en gris con el ejemplo completo (`«4 en el primer parcial» · 4 · Numérico · nota1`, el tipo con borde punteado) y debajo: "Así se verá cada dato. Agrégalos aquí o selecciónalos en el enunciado." Datos resultantes: caja punteada verde "Aparecerán aquí en cuanto una actividad produzca un dato."
- **Construcción.** En lugar de la tarjeta, un marco punteado con las tres zonas dibujadas en punteado y su ayuda, el texto centrado "Empieza por el primer paso del proceso: algo que calcule un dato nuevo o que compruebe una condición." y los dos botones al centro: "+ Agregar operación" (violeta sólido) y "+ Agregar condición" (ámbar suave). El riel queda vacío con sus dos botones de agregar.
- **Cadena.** No se vacía por sí sola: refleja las demás etapas. Los huecos son botones punteados que llevan a la etapa que falta: "Aquí irán tus datos de entrada · Ir a Datos →", "Aquí irán tus actividades · Ir a Construcción →", y en información final "Aquí irá la respuesta del análisis: el propósito «Generar la información final» o un camino de respuesta de una condición."

---

## Interacciones y comportamiento

- **Cambio de etapa.** Los cuatro botones del paso por etapas navegan directamente; también lo hacen el pie de cada etapa ("Continuar a X →") y los enlaces de los huecos de la cadena. Al cambiar de etapa se cierra cualquier selector abierto.
- **Selección de actividad.** Pulsar una tarjeta del riel la abre; el pie con "← Paso anterior / Siguiente actividad →" recorre la lista y, al final, salta a Cadena.
- **Fragmentos del enunciado.** Pulsar un fragmento lo agrega como dato de entrada o lo retira; la tabla de Datos, el recuento del pie y las entradas de la cadena se actualizan a la vez.
- **Selector de elementos.** Se abre bajo su botón y permanece abierto para agregar varios; vuelve a pulsar el mismo botón, o "Listo", para cerrarlo. Los elementos ya usados se ven apagados pero siguen siendo pulsables.
- **Transiciones.** Solo en el riel: `border-color .15s ease, background .15s ease`. Nada más se anima; el resto es cambio inmediato de estado.
- **Hover.** Botones fantasma → `oklch(0.975 0.004 265)`. Punteados → el borde toma el color de su familia y el texto también. Destructivos → fondo rojo suave.
- **Foco.** Los campos de texto pasan el borde a `oklch(0.72 0.09 300)`; conserva el anillo de foco que ya usa el proyecto en el resto de controles.

### Responsive

- Por debajo de **1010px**, las tres zonas de la tarjeta de actividad se apilan y los conectores `→` se sustituyen por un `↓` a todo el ancho con líneas a los lados. En el prototipo lo decide un listener de `resize`; en el repositorio puede resolverse con un breakpoint de Tailwind.
- El riel se puede ocultar (tweak `flujoLateral`) para ganar ancho.
- La tabla de Datos hace scroll horizontal a partir de 640px de contenido.
- La barra superior envuelve sus botones; el proyecto ya tiene un menú hamburguesa por debajo de `md`, que se conserva.

## Estado

El prototipo mantiene en memoria: etapa activa, actividad seleccionada, fragmentos agregados, propósito elegido, selector abierto (destino + categoría) y borrador del valor fijo. En el repositorio, todo esto ya existe o corresponde al controlador; lo único genuinamente nuevo es **la etapa activa** y **qué selector está abierto**, que son estado de interfaz y deben vivir en la vista, no en el modelo ni en el historial de deshacer.

## Assets

Ninguno externo. Los iconos son SVG en línea de trazo 1.9 sobre `viewBox 0 0 24 24`, del mismo repertorio que `src/views/icons.js`. El logo nuevo se describe arriba y está en `Logix · Logo.dc.html`. Fuentes desde Google Fonts: Outfit (400–700), Instrument Sans (400–600) y JetBrains Mono (400–500).

## Archivos de este paquete

- `Logix · Actividades.dc.html` — el prototipo completo: las cuatro etapas, la barra, los estados vacíos. Ábrelo en un navegador; los botones de etapa funcionan.
- `Logix · Logo.dc.html` — las tres opciones de logo a tamaño real y ampliadas. La elegida es **1a**.
- `tokens.css` — los tokens listos para importar.
- `capturas/` — cada etapa con contenido (`01`–`04-etapa.png`: Problema, Datos, Construcción, Cadena), las mismas cuatro en estado vacío (`01`–`04-vacio.png`) y las opciones de logo (`05-logo.png`). Son referencia visual; los valores exactos están en este README y en los prototipos.
- `support.js` — runtime necesario para abrir los `.dc.html`. No forma parte del diseño.

Los prototipos incluyen dos ajustes que sirven para revisar variantes: `estado` (ejemplo / vacío) y `ayudas` (completas / mínimas). La versión a implementar es la de ayudas completas.
