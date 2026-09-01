// Representación de solo lectura de una actividad (fila), compartida por la vista
// de tabla y la de tarjetas para su "modo de visualización". Construye, por cada
// campo, un nodo legible o null cuando el campo no aplica o está vacío. Solo se
// ocupa del DOM; la lógica de datos vive en el modelo.

import { el } from "../utils/dom.js";
import { BRANCH_TYPES, labelOf } from "../models/dataTypes.js";
import { expressionParts } from "../models/operators.js";
import { typeBadge, purposeBadge } from "./badges.js";

// Nodo de solo lectura por cada campo de la fila (o null si no aplica / vacío),
// con las mismas claves que buildRowFields para que ambas vistas lo consuman.
export function buildRowSummary(row, dataById) {
  const resolve = (id) => dataById.get(id) ?? null;
  const isDecision = row.purpose === "decision";
  const conditionApplies = !row.purpose || isDecision;
  const inputs = row.inputIds.map(resolve).filter(Boolean);
  const result = row.resultId ? resolve(row.resultId) : null;

  return {
    problem: textNode(row.problem),
    inputs: inputs.length > 0 ? el("div", { class: "flex flex-wrap gap-1" }, inputs.map(dataChip)) : null,
    condition: conditionApplies ? textNode(row.condition) : null,
    operation: row.operation.length > 0 ? expressionNode(row.operation, resolve) : null,
    result: result ? dataChip(result) : null,
    purpose: purposeBadge(row.purpose),
    comment: textNode(row.subsequentUse),
    ifTrue: isDecision ? branchNode(row.ifTrue, resolve) : null,
    ifFalse: isDecision ? branchNode(row.ifFalse, resolve) : null,
  };
}

// True si la actividad no tiene ningún dato registrado que mostrar.
export function isSummaryEmpty(summary) {
  return Object.values(summary).every((node) => node == null);
}

function textNode(value) {
  const text = (value ?? "").trim();
  return text ? el("span", { class: "whitespace-pre-wrap text-slate-700" }, text) : null;
}

function dataChip(datum) {
  return el("span", { class: "inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600" }, [
    el("span", {}, datum.name || "(sin nombre)"),
    typeBadge(datum.type),
  ]);
}

// Expresión legible: los datos resaltados, los operadores y literales discretos.
function expressionNode(tokens, resolve) {
  const nodes = [];
  expressionParts(tokens, resolve).forEach((part, index) => {
    if (index > 0) nodes.push(" ");
    nodes.push(partNode(part));
  });
  return el("span", { class: "inline-flex flex-wrap items-center gap-1 leading-relaxed" }, nodes);
}

function partNode(part) {
  if (part.kind === "ref") {
    return el("span", { class: "rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-700" }, part.text);
  }
  if (part.kind === "op") return el("span", { class: "text-slate-400" }, part.text);
  return el("span", { class: "rounded bg-amber-50 px-1 py-0.5 text-amber-700" }, part.text || "∅");
}

// Camino de una decisión: tipo de continuación y, si la hay, su respuesta.
function branchNode(branch, resolve) {
  const hasValue = Array.isArray(branch.value) && branch.value.length > 0;
  if (!branch.type && !hasValue) return null;
  const parts = [];
  if (branch.type) parts.push(el("span", { class: "text-slate-500" }, labelOf(BRANCH_TYPES, branch.type)));
  if (hasValue) {
    if (branch.type) parts.push(el("span", { class: "text-slate-300" }, "·"));
    parts.push(expressionNode(branch.value, resolve));
  }
  return el("span", { class: "inline-flex flex-wrap items-center gap-1.5 text-slate-700" }, parts);
}
