// Documentación de ayuda: un modal con explicaciones sencillas de los símbolos,
// controles y conceptos de la herramienta. Reutiliza los mismos badges de la
// interfaz para que los ejemplos coincidan con lo que el estudiante ve. Solo se
// ocupa del DOM.

import { el } from "../utils/dom.js";
import { icon } from "./icons.js";
import { typeBadge, purposeBadge, producedBadge } from "./badges.js";

// Abre el modal de ayuda. Se cierra al pulsar la ×, el fondo o la tecla Escape.
export function openHelp() {
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
  };

  const overlay = el(
    "div",
    {
      class: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4",
      onclick: (event) => {
        if (event.target === overlay) close();
      },
    },
    [
      el("div", { class: "my-8 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl", role: "dialog", "aria-modal": "true" }, [
        el("div", { class: "flex items-center justify-between border-b border-slate-200 px-5 py-3" }, [
          el("div", { class: "flex items-center gap-2" }, [icon("help", "h-5 w-5 text-indigo-500"), el("h2", { class: "text-base font-semibold text-slate-900" }, "Cómo usar Logix")]),
          el("button", { type: "button", class: "rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700", title: "Cerrar", "aria-label": "Cerrar ayuda", onclick: close }, "✕"),
        ]),
        el("div", { class: "space-y-6 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-700" }, content()),
      ]),
    ],
  );

  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
}

function content() {
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
    section("¿Cómo funcionan las condiciones y sus caminos?", [
      "La «Condición» es una pregunta en lenguaje natural que el programa debe responder (por ejemplo: ¿el promedio es mayor o igual a 3?).",
      "Según su respuesta, el proceso sigue un camino u otro:",
      bullets([
        ["Si se cumple, entonces:", " → la acción que se ejecuta cuando la condición es verdadera."],
        ["Si no se cumple, entonces:", " → la acción cuando es falsa."],
      ]),
    ]),
    section("¿Cómo se reorganizan las actividades?", [
      row([el("span", { class: "text-slate-400" }, "⠿"), "Arrastra una tarjeta o fila desde su tirador y suéltala sobre otra para cambiar el orden. Puedes hacerlo tanto en la vista de Tabla como en la de Tarjetas."]),
    ]),
    section("¿Cómo se exporta el análisis?", [
      row([badge("Guardar archivo", "border border-slate-300 text-slate-600"), "descarga un archivo .analisis que puedes volver a abrir con «Abrir análisis» para seguir trabajando."]),
      row([badge("Exportar PDF", "bg-indigo-600 text-white"), "genera un PDF; primero eliges qué secciones incluir."]),
    ]),
  ];
}

function intro() {
  return el("p", { class: "text-slate-600" },
    "Logix te ayuda a analizar un problema antes de diseñar su algoritmo: identifica los datos, descompón el proceso en actividades y observa cómo se encadena todo. Aquí tienes el significado de los símbolos y controles principales.");
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

// Insignia de ejemplo (imita el estilo real de un botón o marcador).
function badge(text, cls) {
  return el("span", { class: `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cls}` }, text);
}
