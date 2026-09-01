// Documentación de ayuda: un panel lateral deslizable (no bloquea el análisis,
// que permanece visible al lado) con explicaciones sencillas y una guía pedagógica
// para construir el análisis. Se organiza en pestañas para mantener la legibilidad
// y reutiliza los mismos badges de la interfaz. Solo se ocupa del DOM.

import { el } from "../utils/dom.js";
import { icon } from "./icons.js";
import { typeBadge, purposeBadge, producedBadge } from "./badges.js";

// Abre el panel de ayuda. Se cierra al pulsar la ×, el fondo o la tecla Escape.
// Si ya hay un panel abierto, no abre otro.
export function openHelp(initialTab = 0) {
  if (document.getElementById("help-panel")) return;

  const close = () => {
    panel.classList.add("translate-x-full");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => overlay.remove(), 200); // espera la transición de salida
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
  };

  const tabs = [
    { label: "Interfaz", sections: interfaceSections },
    { label: "Datos y operaciones", sections: dataSections },
    { label: "Condiciones y expresiones", sections: expressionSections },
  ];

  const startTab = Math.min(Math.max(initialTab, 0), tabs.length - 1);
  const panels = tabs.map((tab, index) => {
    const view = el("div", { class: "space-y-6" }, tab.sections());
    view.hidden = index !== startTab;
    return view;
  });

  const tabButtons = tabs.map((tab, index) =>
    el("button", { type: "button", class: tabButtonClass(index === startTab), onclick: () => activate(index) }, tab.label),
  );

  const activate = (active) => {
    panels.forEach((view, index) => (view.hidden = index !== active));
    tabButtons.forEach((button, index) => (button.className = tabButtonClass(index === active)));
  };

  const panel = el(
    "div",
    {
      id: "help-panel",
      // pointer-events-auto: el panel es interactivo aunque el overlay deje pasar
      // los clics al análisis (se puede seguir trabajando con la ayuda abierta).
      class: "pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-lg translate-x-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out",
      role: "dialog",
      "aria-modal": "false",
      "aria-label": "Ayuda de Logix",
    },
    [
      el("div", { class: "flex items-center justify-between border-b border-slate-200 px-5 py-3" }, [
        el("div", { class: "flex items-center gap-2" }, [icon("help", "h-5 w-5 text-indigo-500"), el("h2", { class: "text-base font-semibold text-slate-900" }, "Cómo usar Logix")]),
        el("button", { type: "button", class: "rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700", title: "Cerrar", "aria-label": "Cerrar ayuda", onclick: close }, "✕"),
      ]),
      el("div", { class: "flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2" }, tabButtons),
      el("div", { class: "flex-1 space-y-6 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-700" }, panels),
    ],
  );

  // Overlay sin fondo y que no captura clics: no bloquea el análisis, que queda
  // visible y utilizable junto al panel.
  const overlay = el("div", { class: "pointer-events-none fixed inset-0 z-50" }, [panel]);

  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
  // Deja pintar el estado inicial (fuera de pantalla) y anima la entrada.
  requestAnimationFrame(() => panel.classList.remove("translate-x-full"));
}

// Botón "?" de ayuda contextual: abre el panel en la pestaña indicada.
export function helpButton(initialTab = 0) {
  return el(
    "button",
    {
      type: "button",
      class: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700",
      title: "Ver ayuda sobre esta sección",
      "aria-label": "Ayuda sobre esta sección",
      onclick: () => openHelp(initialTab),
    },
    "?",
  );
}

function tabButtonClass(active) {
  return `shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;
}

// --- Pestaña 1: Interfaz ---

function interfaceSections() {
  return [
    intro(),
    section("Símbolos de tipo de dato", [
      "Cada dato lleva una insignia que indica su tipo:",
      defList([
        [typeBadge("numeric"), "Numérico: números con los que se puede operar (una nota, una cantidad, un precio)."],
        [typeBadge("logical"), "Lógico: solo puede ser verdadero o falso (¿aprobó?, ¿es mayor de edad?)."],
        [typeBadge("text"), "Texto: palabras o frases (un nombre, un mensaje)."],
      ]),
    ]),
    section("Estados de una actividad", [
      row([badge("Editar", "border border-slate-300 text-slate-600"), "muestra los campos para completar o modificar la actividad."]),
      row([badge("Listo", "bg-indigo-600 text-white"), "guarda y vuelve a la vista limpia, mostrando solo la información registrada."]),
      "Una actividad nueva se abre en modo edición; al pulsar «Listo» pasa a solo lectura.",
    ]),
    section("Indicadores de las actividades", [
      defList([
        [producedBadge(), "Dato de entrada que en realidad se produjo en otra actividad (se reutiliza)."],
        [badge("→ Actividad 2", "bg-indigo-100 text-indigo-700"), "El dato producido se usará en esa actividad."],
        [badge("Pendiente de asignación", "bg-amber-100 text-amber-700"), "Aún no se ha indicado en qué actividad se usará el dato."],
        [purposeBadge("operation"), "Propósito del dato: para una nueva operación."],
        [purposeBadge("decision"), "Propósito del dato: para tomar una decisión."],
        [purposeBadge("response"), "Propósito del dato: es una respuesta o información final."],
      ]),
    ]),
    section("¿Cómo se reorganizan las actividades?", [
      row([el("span", { class: "text-slate-400" }, "⠿"), "Arrastra una tarjeta o fila desde su tirador y suéltala sobre otra para cambiar el orden. Funciona en la vista de Tabla y en la de Tarjetas."]),
    ]),
    section("¿Cómo se exporta el análisis?", [
      row([badge("Guardar archivo", "border border-slate-300 text-slate-600"), "descarga un archivo .analisis que puedes volver a abrir con «Abrir análisis» para seguir trabajando."]),
      row([badge("Exportar PDF", "bg-indigo-600 text-white"), "genera un PDF; primero eliges qué secciones incluir."]),
    ]),
  ];
}

// --- Pestaña 2: Datos y operaciones ---

function dataSections() {
  return [
    section("Cómo nombrar los datos", [
      "Usa nombres descriptivos y consistentes, tanto para los datos de entrada como para los resultantes. Un buen nombre permite comprender qué representa el dato sin releer su descripción.",
      el("div", { class: "flex flex-wrap gap-2" }, [
        el("span", { class: "inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700" }, ["✓", el("span", { class: "font-medium" }, "Cantidad de unidades producidas")]),
        el("span", { class: "inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-rose-600" }, ["✗", "Cantidad, Dato1, X"]),
      ]),
      "Convenciones recomendadas para escribir el nombre (elige una y úsala siempre):",
      twoColTable(["Convención", "Ejemplo"], [
        ["camelCase", code("cantidadUnidadesProducidas")],
        ["snake_case", code("cantidad_unidades_producidas")],
        ["PascalCase", code("CantidadUnidadesProducidas")],
        ["kebab-case", code("cantidad-unidades-producidas")],
      ]),
      "Lo más importante, sea cual sea la convención, es que los nombres sean descriptivos, claros y coherentes con el dato que representan.",
    ]),
    section("¿Cómo se construyen las operaciones?", [
      "Una operación se arma combinando piezas, sin escribirla como texto:",
      bullets([
        ["+ dato", " referencia un dato ya identificado (una entrada o un resultado)."],
        ["+ operador", " agrega un operador: + − × ÷, comparaciones (=, ≠, <, >, ≤, ≥), lógicos (Y, O, NO) o paréntesis ( )."],
        ["+ valor", " agrega un valor fijo que escribes tú (por ejemplo 3)."],
      ]),
      "Referenciar los datos (en vez de reescribir su nombre) evita errores y permite reutilizarlos.",
    ]),
    section("¿Cómo se usan los datos resultantes después?", [
      "Cuando una actividad produce un «Dato resultante» y le pones nombre, ese dato queda disponible para las demás actividades: aparece en los selectores de «Datos de entrada» y de «Operación».",
      "Además, en «Actividad asociada» puedes indicar en qué actividad se usará. Si esa actividad aún no existe, déjalo como «Pendiente» y vincúlalo más tarde.",
    ]),
  ];
}

// --- Pestaña 3: Condiciones y expresiones ---

function expressionSections() {
  return [
    section("¿Qué es una condición?", [
      "Una condición es una pregunta que el programa necesita responder para validar una situación y decidir qué hacer a continuación.",
      "Normalmente su respuesta es Sí/No (verdadero/falso), y esa respuesta determina el camino que seguirá el proceso.",
      example("¿La cantidad de unidades producidas es mayor o igual a 100?"),
      "Según la respuesta, el proceso continúa por un camino («Si se cumple») o por otro («Si no se cumple»).",
    ]),
    section("De lenguaje natural a una expresión algorítmica", [
      "No se trata de traducir palabra por palabra: primero identifica qué pregunta responde el programa, qué datos intervienen y qué relación hay entre ellos.",
      stepFlow([
        { label: "Lenguaje natural", code: "¿La cantidad de unidades producidas es mayor o igual a 100?" },
        { label: "Identificar los elementos", node: bullets([["Dato:", " cantidad de unidades producidas"], ["Operador relacional:", " >="], ["Valor de comparación:", " 100"]]) },
        { label: "Expresión algorítmica", code: "cantidadUnidadesProducidas >= 100" },
      ]),
      "Otros ejemplos con distintos operadores relacionales:",
      twoColTable(["Lenguaje natural", "Expresión algorítmica"], [
        ["¿La cantidad de unidades producidas es mayor que 500?", code("cantidadUnidadesProducidas > 500")],
        ["¿El inventario es igual a 0?", code("inventario == 0")],
        ["¿El tiempo de producción es menor a 8 horas?", code("tiempoProduccion < 8")],
        ["¿La cantidad disponible es diferente de 0?", code("cantidadDisponible != 0")],
      ]),
    ]),
    section("Operadores lógicos", [
      "Combinan o modifican condiciones para construir expresiones más complejas:",
      defList([
        [code("&&"), "AND: exige que todas las condiciones se cumplan."],
        [code("||"), "OR: basta con que al menos una condición se cumpla."],
        [code("!"), "NOT: niega o invierte el resultado de una condición."],
      ]),
      example("¿La cantidad producida es mayor que 100 y el inventario disponible es menor que 50?"),
      codeBlock("cantidadProducida > 100 && inventarioDisponible < 50"),
    ]),
    section("Jerarquía de operadores", [
      "Cuando una expresión mezcla operaciones, no se resuelven en el orden en que aparecen escritas, sino por su prioridad:",
      orderedList([
        ["Paréntesis", " ( ) — se evalúa primero lo que encierran."],
        ["Operadores unarios", " como ! (NOT)."],
        ["Operaciones aritméticas", " × ÷ + −."],
        ["Operadores relacionales", " >, <, >=, <=, ==, !=."],
        ["Operadores lógicos", " && antes que ||."],
      ]),
      "Los paréntesis permiten establecer explícitamente qué parte se evalúa primero, además de mejorar la legibilidad.",
    ]),
    section("Expresiones combinadas, paso a paso", [
      "Una expresión compleja se resuelve por partes; cada resultado se usa en el siguiente paso:",
      codeBlock("(cantidadProducida * precioUnidad) >= 100000 && inventarioDisponible > 0"),
      stepFlow([
        { label: "Operación aritmética", code: "cantidadProducida * precioUnidad" },
        { label: "Resultado de la operación", code: "valorProduccion" },
        { label: "Expresión relacional", code: "valorProduccion >= 100000" },
        { label: "Segunda condición", code: "inventarioDisponible > 0" },
        { label: "Operador lógico", code: "condición1 && condición2" },
        { label: "Resultado final", code: "Sí / No" },
      ]),
    ]),
    section("Los paréntesis cambian el resultado", [
      "Cambiar los paréntesis puede dar un resultado distinto, porque altera qué se evalúa primero:",
      twoColTable(["Expresión", "Resultado"], [
        [code("2 + 3 * 4"), "14 — primero se resuelve 3 * 4"],
        [code("(2 + 3) * 4"), "20 — el paréntesis obliga a sumar primero"],
      ]),
      "Ante la duda, usa paréntesis: dejan la intención clara y evitan errores.",
    ]),
  ];
}

// --- Bloques de contenido reutilizables ---

function intro() {
  return el("p", { class: "text-slate-600" },
    "Logix te ayuda a analizar un problema antes de diseñar su algoritmo: identifica los datos, descompón el proceso en actividades y observa cómo se encadena todo. Aquí tienes el significado de los símbolos y una guía para construir tu análisis.");
}

function section(title, children) {
  return el("section", {}, [
    el("h3", { class: "mb-2 text-sm font-semibold text-slate-900" }, title),
    el("div", { class: "space-y-2" }, children.map((child) => (typeof child === "string" ? el("p", {}, child) : child))),
  ]);
}

// Lista de "insignia → explicación".
function defList(items) {
  return el("ul", { class: "space-y-1.5" }, items.map(([badgeNode, text]) =>
    el("li", { class: "flex items-start gap-2" }, [el("span", { class: "mt-0.5 shrink-0" }, [badgeNode]), el("span", {}, text)]),
  ));
}

// Fila con un elemento (control o símbolo) seguido de su explicación.
function row(parts) {
  return el("p", { class: "flex flex-wrap items-baseline gap-x-2" }, parts.map((part) => (typeof part === "string" ? el("span", {}, part) : part)));
}

// Lista con un término resaltado + explicación.
function bullets(items) {
  return el("ul", { class: "list-disc space-y-1 pl-5" }, items.map(([term, text]) =>
    el("li", {}, [el("span", { class: "font-medium text-slate-800" }, term), text]),
  ));
}

// Lista numerada con un término resaltado + explicación (para la jerarquía).
function orderedList(items) {
  return el("ol", { class: "list-decimal space-y-1 pl-5" }, items.map(([term, text]) =>
    el("li", {}, [el("span", { class: "font-medium text-slate-800" }, term), text]),
  ));
}

// Insignia de ejemplo (imita el estilo real de un botón o marcador).
function badge(text, cls) {
  return el("span", { class: `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cls}` }, text);
}

// Fragmento de código en línea.
function code(text) {
  return el("code", { class: "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-indigo-700" }, text);
}

// Bloque de código resaltado (fondo oscuro) para expresiones completas.
function codeBlock(text) {
  return el("div", { class: "overflow-x-auto rounded-md bg-slate-900 px-3 py-2 font-mono text-[13px] text-slate-100" }, text);
}

// Pregunta de ejemplo destacada (misma idea que la condición en las tarjetas).
function example(text) {
  return el("div", { class: "rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2 italic text-slate-700" }, `“${text}”`);
}

// Tabla de dos columnas. Las celdas pueden ser texto o nodos.
function twoColTable(headers, rows) {
  const cell = (content, extra = "") => el("td", { class: `py-1.5 align-top ${extra}` }, typeof content === "string" ? content : [content]);
  return el("div", { class: "overflow-x-auto" }, [
    el("table", { class: "w-full border-collapse text-sm" }, [
      el("thead", {}, [el("tr", { class: "border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400" }, headers.map((h) => el("th", { class: "py-1.5 pr-3 font-semibold" }, h)))]),
      el("tbody", {}, rows.map(([left, right]) => el("tr", { class: "border-b border-slate-100" }, [cell(left, "pr-3"), cell(right)]))),
    ]),
  ]);
}

// Flujo de resolución paso a paso: cada etapa en su caja, unidas por una flecha ↓.
function stepFlow(stages) {
  const nodes = [];
  stages.forEach((stage, index) => {
    if (index > 0) nodes.push(el("div", { class: "flex justify-center py-0.5 text-slate-300" }, "↓"));
    nodes.push(
      el("div", { class: "rounded-md border border-slate-200 bg-slate-50 px-3 py-2" }, [
        el("div", { class: "mb-1 text-xs font-medium text-slate-500" }, `${index + 1}. ${stage.label}`),
        stage.code ? codeBlock(stage.code) : stage.node,
      ]),
    );
  });
  return el("div", {}, nodes);
}
