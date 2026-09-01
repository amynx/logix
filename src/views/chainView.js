// Vista de la cadena del análisis: Entradas → Proceso → Salida.
// Representa la estructura derivada por buildChain; solo se ocupa del DOM. Se
// re-renderiza completa en cada cambio (es barata y no retiene el foco).

import { el, clear } from "../utils/dom.js";
import { BRANCH_TYPES, labelOf } from "../models/dataTypes.js";
import { sectionHeader } from "./sectionHeader.js";
import { typeBadge, purposeBadge, producedBadge } from "./badges.js";
import { usedInNode } from "./rowSummary.js";
import { activityZones, stepNumber, inlineRow, commentBox, questionBox, formulaBox, withEquals, withArrow } from "./cardLayout.js";

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
          zone("Entradas", "Datos que recibe el programa", chain.entradas.map(dataChip), ZONE_TONE.input),
          connector(),
          processZone(chain.proceso, chain.producidos),
          connector(),
          zone("Salida", "Información final", chain.salidas.map(outputChip), ZONE_TONE.output),
        ]);

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({
          step: 5,
          title: "Cadena del análisis",
          subtitle: "Cómo fluyen los datos: entran, se procesan y salen.",
          iconName: "chain",
        }),
        body,
      ]),
    );
  }
}

// Lenguaje de color de la cadena: entrada azul, proceso neutro, salida verde.
const ZONE_TONE = {
  input: "border-blue-200 bg-blue-50/60",
  neutral: "border-slate-200 bg-slate-50/60",
  output: "border-emerald-200 bg-emerald-50/60",
};

function zone(title, subtitle, items, tone = ZONE_TONE.neutral) {
  return el("div", { class: `flex-1 rounded-md border p-3 ${tone}` }, [
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
  // Etiquetas de las actividades para resolver "se usa en → Actividad N".
  const activities = proceso.map((step) => ({ id: step.rowId, label: `Actividad ${step.position}` }));
  const cards =
    proceso.length > 0
      ? el("div", { class: "space-y-3" }, proceso.map((step) => stepCard(step, activities)))
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

  return el("div", { class: `flex-1 rounded-md border p-3 ${ZONE_TONE.neutral}` }, children);
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
    { class: "flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700" },
    [el("span", { class: "min-w-0 truncate" }, datum.name || "(sin nombre)"), typeBadge(datum.type)],
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

// Detalle de un camino de la decisión: "→ [opción]" (si continúa o finaliza, y a
// dónde conduce). El caso lo aporta la etiqueta "Si (no) se cumple, entonces:".
function branchDetail(branch) {
  return withArrow(
    el("span", { class: "inline-flex flex-wrap items-center gap-1.5" }, [
      branch.flow ? flowBadge(branch.flow) : null,
      branch.type ? el("span", { class: "text-slate-500" }, labelOf(BRANCH_TYPES, branch.type)) : null,
      branch.parts.length > 0 ? expressionEl(branch.parts) : (!branch.type ? el("span", { class: "text-slate-400" }, "sin definir") : null),
    ]),
  );
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
    return el("span", { class: `whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium ${style}`, title: "Dato utilizado" }, part.text);
  }
  if (part.kind === "op") return el("span", { class: "text-slate-400" }, part.text);
  return el("span", {}, part.text);
}

// Tarjeta de actividad: cabecera con el número y la necesidad, y el resto de la
// información agrupada en zonas (Entrada · Proceso · Resultado · Caminos), con la
// misma jerarquía visual que la vista de tarjetas.
function stepCard(step, activities) {
  const isDecision = step.purpose === "decision" || step.condition;
  const nodes = {
    inputs: step.inputs.length > 0 ? el("div", { class: "flex flex-wrap gap-1" }, step.inputs.map(inputChip)) : null,
    condition: step.condition ? questionBox(step.condition) : null,
    operation: step.operation.length > 0 ? formulaBox(expressionEl(step.operation)) : null,
    result: step.result ? withEquals(smallChip(step.result)) : null,
    purpose: purposeBadge(step.purpose),
    usedIn: step.result ? usedInNode(step.usedInRowId, activities) : null,
    comment: step.comment ? commentBox(step.comment) : null,
    ifTrue: isDecision ? branchDetail(step.ifTrue) : null,
    ifFalse: isDecision ? branchDetail(step.ifFalse) : null,
  };

  return el("div", { class: "rounded-lg border border-slate-200 bg-white p-3.5" }, [
    el("div", { class: "flex items-center gap-2 border-b border-slate-100 pb-2" }, [
      stepNumber(step.position),
      el("span", { class: "text-sm font-medium text-slate-800" }, step.description || `Actividad ${step.position}`),
    ]),
    el("div", { class: "mt-2.5 space-y-3" }, activityZones(nodes, inlineRow)),
  ]);
}

function smallChip(datum) {
  return el("span", { class: "inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600" }, [
    el("span", { class: "whitespace-nowrap" }, datum.name || "(sin nombre)"),
    typeBadge(datum.type),
  ]);
}

// Ficha de una entrada de la actividad; marca las que son datos producidos en un
// paso anterior (intermedios reutilizados) frente a las entradas del programa.
function inputChip(datum) {
  return el("span", { class: "inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600" }, [
    datum.produced ? producedBadge() : null,
    el("span", { class: "whitespace-nowrap" }, datum.name || "(sin nombre)"),
    typeBadge(datum.type),
  ]);
}
