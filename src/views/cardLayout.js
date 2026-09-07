// Primitivas de presentación para las tarjetas de actividad (vista de tarjetas y
// cadena del análisis). Dan a todas las tarjetas la MISMA jerarquía visual:
// un número de paso, zonas agrupadas con un título de color y filas etiquetadas.
// Solo se ocupa del DOM; no conoce el modelo.

import { el } from "../utils/dom.js";
import { icon } from "./icons.js";

// Tonos por zona: refuerzan el lenguaje de color entrada(azul) → proceso(índigo)
// → resultado(verde), con la condición y la decisión (sus caminos y propósito) en
// naranja y el contexto en gris. Cada zona lleva un icono para reconocerla rápido.
const ZONE_TONES = {
  need: { bar: "border-slate-200", title: "text-slate-400", icon: "target" },
  input: { bar: "border-blue-300", title: "text-blue-600", icon: "data" },
  process: { bar: "border-indigo-300", title: "text-indigo-600", icon: "workflow" },
  result: { bar: "border-emerald-300", title: "text-emerald-600", icon: "flag" },
  branch: { bar: "border-amber-300", title: "text-amber-600", icon: "fork" },
  purpose: { bar: "border-amber-300", title: "text-amber-600", icon: "reuse" },
  comment: { bar: "border-slate-200", title: "text-slate-400", icon: "message" },
  condition: { bar: "border-amber-300", title: "text-amber-600", icon: "fork" },
  reuse: { bar: "border-emerald-300", title: "text-emerald-600", icon: "reuse" },
};

// Etiquetas de los campos que comparten zona con otros (para distinguirlos). Los
// campos que ocupan solos su zona no la necesitan: el título de la zona los nombra.
const SUBLABELS = { usedIn: "Se usa en" };

// Número del paso: distintivo redondo para reconocer la actividad de un vistazo.
export function stepNumber(position) {
  return el(
    "span",
    { class: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700" },
    String(position),
  );
}

// Caja para una nota de texto libre (comentario): entre comillas y en cursiva,
// visualmente diferenciada del resto de la información. `content` puede ser texto
// o nodos (p. ej. texto con referencias `[nombre]` resaltadas).
export function commentBox(content) {
  const inner = Array.isArray(content) ? content : [content];
  return el(
    "blockquote",
    { class: "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm italic leading-relaxed text-slate-600" },
    ["“", ...inner, "”"],
  );
}

// Caja para la condición: se lee como una pregunta (icono de interrogación + cursiva).
// `content` puede ser texto o nodos con referencias resaltadas.
export function questionBox(content) {
  return el("div", { class: "flex items-start gap-1.5 rounded-md border border-amber-100 bg-amber-50/50 px-2.5 py-2 text-sm italic leading-relaxed text-slate-700" }, [
    icon("help", "h-3.5 w-3.5 mt-1 text-amber-500"),
    el("span", { class: "min-w-0 whitespace-pre-wrap" }, content),
  ]);
}

// Convierte un texto con referencias `[nombre]` en una lista de nodos: cada
// referencia que corresponde a un dato real se resalta como ficha (entrada = azul,
// resultado = verde); el resto queda como texto. `resolveName(name)` devuelve
// `{ produced }` si el nombre es un dato, o null. Así una referencia insertada con
// el menú «/» se lee como referencia y no como texto entre corchetes.
export function referencedText(text, resolveName) {
  const nodes = [];
  const pattern = /\[([^[\]]+)\]/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const info = typeof resolveName === "function" ? resolveName(match[1]) : null;
    nodes.push(info ? referenceChip(match[1], info.produced) : match[0]);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function referenceChip(name, produced) {
  return el(
    "span",
    {
      class: `inline-flex items-center gap-1 rounded px-1 py-0.5 align-middle not-italic ${produced ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`,
    },
    [icon(produced ? "reuse" : "data", `h-3 w-3 ${produced ? "text-emerald-500" : "text-blue-500"}`), el("span", {}, name)],
  );
}

// Caja para la operación: se lee como una fórmula (recuadro tenue, monoespaciada).
export function formulaBox(node) {
  return el("div", { class: "inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-sm text-slate-700" }, [node]);
}

// Antepone un "=" al dato producido para enfatizar que es el resultado del paso.
export function withEquals(node) {
  return el("span", { class: "inline-flex items-center gap-1.5" }, [
    el("span", { class: "font-semibold text-slate-400" }, "="),
    node,
  ]);
}

// Antepone una flecha "→" a la acción de un camino de decisión, para que "entonces
// → [acción]" haga explícito que la condición determina el camino a seguir.
export function withArrow(node) {
  return el("span", { class: "inline-flex flex-wrap items-center gap-1.5" }, [
    el("span", { class: "font-semibold text-slate-400" }, "→"),
    node,
  ]);
}

// Fila etiqueta→valor en línea (compacta), para el modo de visualización.
export function inlineRow(label, value) {
  return el("div", { class: "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-slate-700" }, [
    label ? el("span", { class: "shrink-0 text-xs font-medium text-slate-400" }, label) : null,
    el("div", { class: "min-w-0" }, value),
  ]);
}

// Fila etiqueta arriba, control debajo (apilada), para el modo de edición.
export function stackedRow(label, value) {
  return el("div", {}, [
    label ? el("div", { class: "text-xs font-medium text-slate-500" }, label) : null,
    el("div", { class: label ? "mt-0.5" : "" }, value),
  ]);
}

// Ensambla las filas de una actividad en zonas con jerarquía consistente. El
// tipo (`kind`) decide qué zonas se muestran: una condición descubre una
// comprobación (menos campos) y una operación produce un dato.
// `nodesByKey` mapea cada clave de campo a un nodo ya construido (o null); las
// zonas sin contenido se omiten. `renderRow(label, value)` decide el estilo de
// fila (en línea o apilada) según la vista.
// Las zonas se titulan como PREGUNTAS orientadoras (¿qué necesitas? → ¿qué haces?
// → ¿qué obtienes? → ¿para qué?), para que la tarjeta se lea como el razonamiento
// del análisis. `asQuestions:false` usa títulos cortos (para la cadena, más compacta).
export function activityZones(nodesByKey, renderRow, kind = "operation", { asQuestions = true } = {}) {
  const row = (key, label = null) => (nodesByKey[key] ? renderRow(label, nodesByKey[key]) : null);
  const q = (question, short) => (asQuestions ? question : short);

  if (kind === "condition") {
    return [
      zoneBlock(q("¿Qué quieres comprobar?", "Condición"), ZONE_TONES.condition, [
        row("condition", "Pregunta"),
        row("operation", "Comprobación"),
        row("conditionName", "Nombre"),
        row("evaluate"),
      ]),
      // Solo presente si la condición se evalúa (result/purpose no nulos).
      zoneBlock(q("¿Qué obtienes?", "Resultado"), ZONE_TONES.result, [row("result", "Dato lógico")]),
      zoneBlock(q("¿Para qué lo usarás?", "Propósito"), ZONE_TONES.purpose, [row("purpose"), row("usedIn", SUBLABELS.usedIn)]),
      zoneBlock(q("¿Qué pasa según el resultado?", "Caminos"), ZONE_TONES.branch, [
        row("ifTrue", "Si se cumple, entonces:"),
        row("ifFalse", "Si no se cumple, entonces:"),
      ]),
      nodesByKey.comment ? el("div", { class: "pt-0.5" }, [nodesByKey.comment]) : null,
    ].filter(Boolean);
  }
  return [
    zoneBlock(q("¿Qué necesitas hacer?", "Necesidad"), ZONE_TONES.need, [row("problem")]),
    zoneBlock(q("¿Qué necesitas para hacerlo?", "Datos de entrada"), ZONE_TONES.input, [row("inputs")]),
    zoneBlock(q("¿Qué debes hacer?", "Operación"), ZONE_TONES.process, [row("operation")]),
    zoneBlock(q("¿Qué obtienes?", "Resultado"), ZONE_TONES.result, [row("result")]),
    zoneBlock(q("¿Para qué usarás este dato?", "Propósito"), ZONE_TONES.purpose, [row("purpose"), row("usedIn", SUBLABELS.usedIn)]),
    zoneBlock("Comentario", ZONE_TONES.comment, [row("comment")]),
  ].filter(Boolean);
}

// Zona agrupada: barra y título (con icono) en su color + filas. Null si no hay filas.
function zoneBlock(title, tone, rows) {
  const present = rows.filter(Boolean);
  if (present.length === 0) return null;
  return el("div", { class: `border-l-2 ${tone.bar} pl-2.5` }, [
    el("div", { class: `mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${tone.title}` }, [
      icon(tone.icon, "h-3 w-3"),
      el("span", {}, title),
    ]),
    el("div", { class: "space-y-1" }, present),
  ]);
}
