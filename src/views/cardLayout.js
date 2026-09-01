// Primitivas de presentación para las tarjetas de actividad (vista de tarjetas y
// cadena del análisis). Dan a todas las tarjetas la MISMA jerarquía visual:
// un número de paso, zonas agrupadas con un título de color y filas etiquetadas.
// Solo se ocupa del DOM; no conoce el modelo.

import { el } from "../utils/dom.js";

// Tonos por zona: refuerzan el lenguaje de color entrada(azul) → proceso(índigo)
// → resultado(verde), con los caminos en ámbar y el contexto en gris.
const ZONE_TONES = {
  need: { bar: "border-slate-200", title: "text-slate-400" },
  input: { bar: "border-blue-300", title: "text-blue-600" },
  process: { bar: "border-indigo-300", title: "text-indigo-600" },
  result: { bar: "border-emerald-300", title: "text-emerald-600" },
  branch: { bar: "border-amber-300", title: "text-amber-600" },
  comment: { bar: "border-slate-200", title: "text-slate-400" },
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

// Zona agrupada: barra y título en su color + filas. Devuelve null si no hay filas.
function zoneBlock(title, tone, rows) {
  const present = rows.filter(Boolean);
  if (present.length === 0) return null;
  return el("div", { class: `border-l-2 ${tone.bar} pl-2.5` }, [
    el("div", { class: `mb-1 text-[10px] font-semibold uppercase tracking-wide ${tone.title}` }, title),
    el("div", { class: "space-y-1" }, present),
  ]);
}
