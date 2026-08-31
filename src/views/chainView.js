// Vista de la cadena del análisis: Entradas → Proceso → Salida.
// Representa la estructura derivada por buildChain; solo se ocupa del DOM. Se
// re-renderiza completa en cada cambio (es barata y no retiene el foco).

import { el, clear } from "../utils/dom.js";
import { DATA_TYPES, PURPOSES, labelOf } from "../models/dataTypes.js";

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
          zone("Proceso", "Actividades en orden", chain.proceso.map(stepCard)),
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
  return el("div", { class: "rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-800" }, [
    el("div", {}, output.label),
    output.detail ? el("div", { class: "text-[11px] text-emerald-700/80" }, output.detail) : null,
  ]);
}

function stepCard(step) {
  const children = [
    el("div", { class: "mb-1 flex items-center gap-2" }, [
      el("span", { class: "text-xs font-semibold text-slate-400" }, `#${step.position}`),
      purposeBadge(step.purpose),
    ]),
  ];

  if (step.inputs.length > 0) {
    children.push(
      el("div", { class: "mb-1 flex flex-wrap gap-1" }, step.inputs.map((datum) =>
        el("span", { class: "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600" }, dataLabel(datum)),
      )),
    );
  }

  if (step.purpose === "decision") {
    children.push(el("div", { class: "text-sm text-slate-700" }, step.condition || "(sin condición)"));
    children.push(
      el("ul", { class: "mt-1 space-y-0.5 text-xs text-slate-500" }, [
        branchLine("✓", step.ifTrue),
        branchLine("✗", step.ifFalse),
      ]),
    );
  } else if (step.operation) {
    children.push(el("div", { class: "text-sm text-slate-700" }, step.operation));
  } else if (step.condition) {
    children.push(el("div", { class: "text-sm text-slate-500" }, step.condition));
  }

  if (step.result) {
    children.push(
      el("div", { class: "mt-1 text-xs text-slate-500" }, `→ produce ${dataLabel(step.result)}`),
    );
  }

  return el("div", { class: "rounded-md border border-slate-200 bg-white p-2" }, children);
}

function branchLine(mark, branch) {
  const value = branch.value.trim() || "…";
  return el("li", {}, `${mark} ${value}`);
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
