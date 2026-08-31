// Vista de la cadena del análisis: Entradas → Proceso → Salida.
// Representa la estructura derivada por buildChain; solo se ocupa del DOM. Se
// re-renderiza completa en cada cambio (es barata y no retiene el foco).

import { el, clear } from "../utils/dom.js";
import { DATA_TYPES, PURPOSES, BRANCH_TYPES, labelOf } from "../models/dataTypes.js";

export class ChainView {
  constructor({ container }) {
    this.container = container;
  }

  render(chain) {
    clear(this.container);
    const isEmpty =
      chain.entradas.length === 0 && chain.proceso.length === 0 && chain.salidas.length === 0;

    const body = isEmpty
      ? el("p", { class: "text-sm text-slate-400" }, "La cadena aparecerá aquí a medida que completes el análisis.")
      : el("div", { class: "flex flex-col gap-3 md:flex-row md:items-stretch" }, [
          zone("Entradas", "Datos que recibe el programa", chain.entradas.map(dataChip)),
          connector(),
          processZone(chain.proceso, chain.producidos),
          connector(),
          zone("Salida", "Información final", chain.salidas.map(outputChip)),
        ]);

    this.container.append(
      el("section", { class: "rounded-lg border border-slate-200 bg-white p-4" }, [
        el("h2", { class: "mb-3 text-sm font-semibold text-slate-700" }, "Cadena del análisis"),
        body,
      ]),
    );
  }
}

function zone(title, subtitle, items) {
  return el("div", { class: "flex-1 rounded-md border border-slate-200 bg-slate-50/60 p-3" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wide text-slate-500" }, title),
    el("div", { class: "mb-2 text-[11px] text-slate-400" }, subtitle),
    items.length > 0
      ? el("div", { class: "space-y-2" }, items)
      : el("div", { class: "text-sm text-slate-300" }, "—"),
  ]);
}

// Zona de proceso: las actividades y, debajo, los datos producidos disponibles
// para reutilizar en operaciones posteriores.
function processZone(proceso, producidos) {
  const cards =
    proceso.length > 0
      ? el("div", { class: "space-y-3" }, proceso.map(stepCard))
      : el("div", { class: "text-sm text-slate-300" }, "—");

  const children = [
    el("div", { class: "text-xs font-semibold uppercase tracking-wide text-slate-500" }, "Proceso"),
    el("div", { class: "mb-2 text-[11px] text-slate-400" }, "Actividades en orden"),
    cards,
  ];

  if (producidos.length > 0) {
    children.push(
      el("div", { class: "mt-3 border-t border-slate-200 pt-2" }, [
        el("div", { class: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500" }, "Datos producidos"),
        el("div", { class: "flex flex-wrap gap-1" }, producidos.map(smallChip)),
      ]),
    );
  }

  return el("div", { class: "flex-1 rounded-md border border-slate-200 bg-slate-50/60 p-3" }, children);
}

// Conector entre zonas: flecha hacia la derecha en fila, hacia abajo apilado.
function connector() {
  return el("div", { class: "flex items-center justify-center text-slate-300" }, [
    el("span", { class: "md:hidden" }, "↓"),
    el("span", { class: "hidden md:inline" }, "→"),
  ]);
}

function dataChip(datum) {
  return el(
    "div",
    { class: "rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700" },
    dataLabel(datum),
  );
}

function outputChip(output) {
  const children = [
    el("div", { class: "flex flex-wrap items-center gap-1.5" }, [
      output.branch ? caseBadge(output.branch) : null,
      expressionEl(output.parts, "emerald"),
    ]),
  ];
  if (output.condition) {
    children.push(el("div", { class: "text-[11px] text-emerald-700/80" }, `cuando: ${output.condition}`));
  }
  return el("div", { class: "rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-sm text-emerald-800" }, children);
}

// Un camino de la decisión: caso Sí/No, si continúa o finaliza, y a dónde conduce.
function pathLine(caseLabel, branch) {
  return el("div", { class: "flex flex-wrap items-center gap-1.5 text-xs text-slate-600" }, [
    caseBadge(caseLabel),
    branch.flow ? flowBadge(branch.flow) : null,
    branch.type ? el("span", { class: "text-slate-400" }, `${labelOf(BRANCH_TYPES, branch.type)}:`) : null,
    branch.parts.length > 0 ? expressionEl(branch.parts) : el("span", { class: "text-slate-400" }, "…"),
  ]);
}

// Indica el caso de la condición: Sí (se cumple) o No (no se cumple).
function caseBadge(branchCase) {
  const style = branchCase === "Sí" ? "bg-emerald-600 text-white" : "bg-rose-500 text-white";
  return el("span", { class: `shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${style}` }, branchCase);
}

// Indica si el camino continúa el proceso o lo finaliza.
function flowBadge(flow) {
  const isEnd = flow === "finaliza";
  const style = isEnd ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700";
  return el("span", { class: `shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${style}` }, isEnd ? "Finaliza" : "Continúa");
}

// Renderiza una expresión resaltando los datos (ref) frente a operadores y texto.
function expressionEl(parts, tone = "sky") {
  const children = [];
  parts.forEach((part, index) => {
    if (index > 0) children.push(" ");
    children.push(partNode(part, tone));
  });
  return el("span", {}, children);
}

function partNode(part, tone) {
  if (part.kind === "ref") {
    const style = tone === "emerald" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-700";
    return el("span", { class: `rounded px-1 py-0.5 text-xs font-medium ${style}`, title: "Dato utilizado" }, part.text);
  }
  if (part.kind === "op") return el("span", { class: "text-slate-400" }, part.text);
  return el("span", {}, part.text);
}

// Tarjeta de actividad: cada parte en su propia línea etiquetada para leerse de un vistazo.
function stepCard(step) {
  const fields = [];
  if (step.inputs.length > 0) {
    fields.push(fieldRow("Entradas", el("div", { class: "flex flex-wrap gap-1" }, step.inputs.map(smallChip))));
  }
  if (step.condition) fields.push(fieldRow("Condición", step.condition));
  if (step.operation.length > 0) fields.push(fieldRow("Operación", expressionEl(step.operation)));
  if (step.result) fields.push(fieldRow("Resultado", smallChip(step.result)));
  if (step.purpose) fields.push(fieldRow("Propósito", purposeBadge(step.purpose)));
  if (step.comment) fields.push(fieldRow("Comentario", step.comment));
  // Cuando la actividad decide, se muestran los dos caminos posibles del flujo.
  if (step.purpose === "decision" || step.condition) {
    fields.push(
      fieldRow(
        "Caminos",
        el("div", { class: "space-y-1" }, [pathLine("Sí", step.ifTrue), pathLine("No", step.ifFalse)]),
      ),
    );
  }

  return el("div", { class: "space-y-2.5 rounded-md border border-slate-200 bg-white p-3.5" }, [
    el("div", { class: "flex items-baseline gap-2" }, [
      el("span", { class: "text-xs font-semibold text-slate-400" }, `#${step.position}`),
      step.description ? el("span", { class: "text-sm font-medium text-slate-800" }, step.description) : null,
    ]),
    fields.length > 0 ? el("div", { class: "space-y-2" }, fields) : null,
  ]);
}

// Línea "Etiqueta: valor" dentro de una tarjeta. `value` puede ser texto o un nodo.
function fieldRow(label, value) {
  return el("div", { class: "flex gap-2 text-xs leading-relaxed" }, [
    el("span", { class: "shrink-0 font-medium text-slate-400" }, `${label}:`),
    el("div", { class: "min-w-0 text-slate-700" }, value),
  ]);
}

function smallChip(datum) {
  return el("span", { class: "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600" }, dataLabel(datum));
}

function purposeBadge(purpose) {
  if (!purpose) return null;
  return el(
    "span",
    { class: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500" },
    labelOf(PURPOSES, purpose),
  );
}

function dataLabel(datum) {
  return `${datum.name || "(sin nombre)"} : ${labelOf(DATA_TYPES, datum.type) || "—"}`;
}
