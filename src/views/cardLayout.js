// Primitivas de presentación para las tarjetas de actividad (vista de tarjetas y
// cadena del análisis). Dan a todas las tarjetas la MISMA jerarquía visual:
// un número de paso, zonas agrupadas con un título de color y filas etiquetadas.
// Solo se ocupa del DOM; no conoce el modelo.

import { el } from "../utils/dom.js";
import { icon } from "./icons.js";

// Tonos por zona: refuerzan el lenguaje de color entrada(azul) → proceso(índigo)
// → resultado(verde), con los caminos en ámbar y el contexto en gris. Cada zona
// lleva un icono para reconocerla más rápido.
const ZONE_TONES = {
  need: { bar: "border-slate-200", title: "text-slate-400", icon: "target" },
  input: { bar: "border-blue-300", title: "text-blue-600", icon: "data" },
  process: { bar: "border-indigo-300", title: "text-indigo-600", icon: "workflow" },
  result: { bar: "border-emerald-300", title: "text-emerald-600", icon: "flag" },
  branch: { bar: "border-amber-300", title: "text-amber-600", icon: "fork" },
  comment: { bar: "border-slate-200", title: "text-slate-400", icon: "message" },
};

// Etiquetas de los campos que comparten zona con otros (para distinguirlos). Los
// campos que ocupan solos su zona no la necesitan: el título de la zona los nombra.
const SUBLABELS = { condition: "Condición", operation: "Operación", purpose: "Propósito", usedIn: "Se usa en" };

// Número del paso: distintivo redondo para reconocer la actividad de un vistazo.
export function stepNumber(position) {
  return el(
    "span",
    { class: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700" },
    String(position),
  );
}

// Caja para una nota de texto libre (comentario): entre comillas y en cursiva,
// visualmente diferenciada del resto de la información.
export function commentBox(text) {
  return el(
    "blockquote",
    { class: "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm italic text-slate-600" },
    `“${text}”`,
  );
}

// Caja para la condición: se lee como una pregunta (icono de interrogación + cursiva).
export function questionBox(text) {
  return el("div", { class: "flex items-start gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/50 px-2.5 py-1.5 text-sm italic text-slate-700" }, [
    icon("help", "h-3.5 w-3.5 mt-0.5 text-indigo-400"),
    el("span", { class: "min-w-0 whitespace-pre-wrap" }, text),
  ]);
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

// Ensambla las filas de una actividad en zonas con jerarquía consistente.
// `nodesByKey` mapea cada clave de campo a un nodo ya construido (o null); las
// zonas sin contenido se omiten. `renderRow(label, value)` decide el estilo de
// fila (en línea o apilada) según la vista.
export function activityZones(nodesByKey, renderRow) {
  const row = (key, label = null) => (nodesByKey[key] ? renderRow(label, nodesByKey[key]) : null);
  return [
    zoneBlock("Necesidad", ZONE_TONES.need, [row("problem")]),
    zoneBlock("Datos de entrada", ZONE_TONES.input, [row("inputs")]),
    zoneBlock("Proceso", ZONE_TONES.process, [row("condition", SUBLABELS.condition), row("operation", SUBLABELS.operation)]),
    zoneBlock("Resultado", ZONE_TONES.result, [row("result"), row("purpose", SUBLABELS.purpose), row("usedIn", SUBLABELS.usedIn)]),
    zoneBlock("Caminos", ZONE_TONES.branch, [row("ifTrue", "Sí"), row("ifFalse", "No")]),
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
