// Vista de la cadena del análisis: un FLUJO vertical que hace visible el
// razonamiento — los datos de entrada bajan hacia cada transformación, que produce
// nuevos datos, hasta llegar a la decisión y a la información final. No repite las
// tarjetas de construcción: es una representación de conjunto (más compacta) para
// COMPRENDER cómo fluye el análisis. Deriva de buildChain; solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import { sectionHeader } from "./sectionHeader.js";
import { typeBadge } from "./badges.js";
import { formulaBox } from "./cardLayout.js";
import { helpButton } from "./helpView.js";
import { icon } from "./icons.js";

// Acentos por tipo de nodo, coherentes con el color semántico del resto:
// entrada azul, operación índigo, condición naranja, información final verde.
const NODE = {
  input: "border-blue-200 bg-blue-50/60",
  operation: "border-indigo-200 bg-white",
  condition: "border-amber-200 bg-amber-50/40",
};

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
      : el("div", {}, [summaryBar(chain), el("div", { class: "mx-auto max-w-2xl" }, flowNodes(chain))]);

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({
          title: "Cadena del análisis",
          subtitle: "Cómo fluye tu razonamiento: de los datos a la información final.",
          iconName: "chain",
          help: helpButton(0), // pestaña "Interfaz" (símbolos e indicadores)
        }),
        body,
      ]),
    );
  }
}

// Resumen no invasivo del estado del razonamiento: cuántos datos, operaciones,
// decisiones y respuestas lleva el análisis. Da una visión rápida de conjunto.
function summaryBar(chain) {
  const operaciones = chain.proceso.filter((step) => step.kind !== "condition").length;
  const decisiones = chain.proceso.filter((step) => step.kind === "condition" && step.evaluateNow && step.purpose === "decision").length;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const stats = [
    ["data", plural(chain.entradas.length, "dato de entrada", "datos de entrada"), "text-blue-600"],
    ["workflow", plural(operaciones, "operación", "operaciones"), "text-indigo-600"],
    ["fork", plural(decisiones, "decisión", "decisiones"), "text-amber-600"],
    ["flag", plural(chain.salidas.length, "respuesta final", "respuestas finales"), "text-emerald-600"],
  ];
  return el("div", { class: "mb-4 flex flex-wrap justify-center gap-2" }, stats.map(([iconName, text, color]) =>
    el("span", { class: "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600" }, [icon(iconName, `h-3.5 w-3.5 ${color}`), text]),
  ));
}

// Ensambla el flujo vertical: Entradas → cada actividad → Información final,
// intercalando conectores «↓» para que se lea como una secuencia.
function flowNodes(chain) {
  const blocks = [];
  blocks.push(inputsBlock(chain.entradas));
  for (const step of chain.proceso) {
    blocks.push(down(), step.kind === "condition" ? conditionNode(step) : operationNode(step));
  }
  blocks.push(down(), outputBlock(chain.salidas));
  return blocks;
}

// Conector vertical entre nodos.
function down() {
  return el("div", { class: "flex justify-center py-1 text-slate-300", "aria-hidden": "true" }, "↓");
}

// Nodo de entradas: los datos que recibe el programa (azul).
function inputsBlock(entradas) {
  return el("div", { class: `rounded-lg border ${NODE.input} p-3` }, [
    el("div", { class: "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600" }, [icon("data", "h-3.5 w-3.5"), "Entradas"]),
    entradas.length > 0
      ? el("div", { class: "flex flex-wrap gap-1.5" }, entradas.map((datum) => dataChip(datum, "blue")))
      : el("p", { class: "text-sm text-slate-400" }, "Aún no has identificado datos de entrada."),
  ]);
}

// Nodo de operación: la expresión que combina datos y el dato que produce (índigo).
function operationNode(step) {
  const expr =
    step.operation.length > 0
      ? formulaBox(expressionEl(step.operation))
      : step.inputs.length > 0
        ? el("div", { class: "flex flex-wrap gap-1.5" }, step.inputs.map((datum) => dataChip(datum, datum.produced ? "emerald" : "blue")))
        : el("span", { class: "text-sm italic text-slate-400" }, "sin operación definida");
  const produces = step.result ? el("div", { class: "flex items-center gap-1.5 text-sm" }, [arrow(), dataChip(step.result, "emerald")]) : null;
  return nodeShell(step.position, "workflow", NODE.operation, "text-indigo-700", step.description || `Actividad ${step.position}`, [expr, produces]);
}

// Nodo de condición: la pregunta, la comparación y, si es una decisión, sus
// caminos (Sí / No) hacia lo que ocurre en cada caso (naranja).
function conditionNode(step) {
  const isDecision = step.evaluateNow && step.purpose === "decision";
  const question = step.condition ? el("p", { class: "text-sm italic text-slate-700" }, `¿${step.condition.replace(/^¿|\?$/g, "")}?`) : null;
  const comparison = step.operation.length > 0 ? formulaBox(expressionEl(step.operation)) : null;
  const produces = step.evaluateNow && step.result ? el("div", { class: "flex items-center gap-1.5 text-sm" }, [arrow(), dataChip(step.result, "emerald")]) : null;
  const branches = isDecision
    ? el("div", { class: "mt-1 space-y-1" }, [branchLine("Sí", step.ifTrue), branchLine("No", step.ifFalse)])
    : null;
  const title = step.description || step.conditionLabel || `Condición ${step.position}`;
  return nodeShell(step.position, "fork", NODE.condition, "text-amber-700", title, [question, comparison, produces, branches]);
}

// Nodo genérico: número de paso, icono y título, con el cuerpo alineado debajo.
function nodeShell(position, iconName, cls, titleColor, title, body) {
  return el("div", { class: `rounded-lg border ${cls} p-3` }, [
    el("div", { class: "mb-1.5 flex items-center gap-1.5" }, [
      el("span", { class: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500" }, String(position)),
      icon(iconName, `h-3.5 w-3.5 ${titleColor}`),
      el("span", { class: `min-w-0 text-sm font-semibold ${titleColor}` }, title),
    ]),
    el("div", { class: "space-y-1.5 pl-7" }, body.filter(Boolean)),
  ]);
}

// Un camino de la decisión: caso (Sí/No) → lo que ocurre (continúa o finaliza).
function branchLine(branchCase, path) {
  const outcome =
    path.parts.length > 0
      ? expressionEl(path.parts)
      : path.type
        ? el("span", { class: "text-slate-500" }, path.flow === "finaliza" ? "respuesta final" : "continúa")
        : el("span", { class: "italic text-slate-400" }, "sin definir");
  return el("div", { class: "flex items-center gap-1.5 text-sm" }, [caseBadge(branchCase), arrow(), outcome]);
}

// Nodo de información final (verde, con más protagonismo): la culminación del
// análisis. Todo el proceso produce finalmente esta información.
function outputBlock(salidas) {
  const items =
    salidas.length > 0
      ? salidas.map((output) =>
          el("div", { class: "flex flex-wrap items-center gap-1.5 rounded-md border border-emerald-200 bg-white/70 px-2.5 py-1.5 text-sm text-emerald-800" }, [
            output.branch ? caseBadge(output.branch) : null,
            expressionEl(output.parts, "emerald"),
            output.condition ? el("span", { class: "text-[11px] text-emerald-700/80" }, `· cuando ${output.condition}`) : null,
          ]),
        )
      : [el("p", { class: "text-sm text-emerald-700/70" }, "Aún no defines la información final (un propósito «Generar la información final» o un camino de respuesta).")];
  return el("div", { class: "rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3.5" }, [
    el("div", { class: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700" }, [icon("flag", "h-4 w-4"), "Información final"]),
    el("div", { class: "space-y-1.5" }, items),
  ]);
}

// Flecha en línea "→" para "produce" / "entonces".
function arrow() {
  return el("span", { class: "font-semibold text-slate-400" }, "→");
}

// Ficha de un dato con su color semántico (entrada azul, producido verde).
function dataChip(datum, tone) {
  const style = tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700";
  return el("span", { class: `inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm ${style}` }, [
    el("span", { class: "whitespace-nowrap" }, datum.name || "(sin nombre)"),
    typeBadge(datum.type),
  ]);
}

// Indica el caso de la condición: Sí (se cumple) o No (no se cumple).
function caseBadge(branchCase) {
  const style = branchCase === "Sí" ? "bg-emerald-600 text-white" : "bg-rose-500 text-white";
  return el("span", { class: `shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${style}` }, branchCase);
}

// Renderiza una expresión resaltando los datos (ref) frente a operadores y texto.
function expressionEl(parts, tone = "blue") {
  const children = [];
  parts.forEach((part, index) => {
    if (index > 0) children.push(" ");
    children.push(partNode(part, tone));
  });
  return el("span", { class: "inline-flex flex-wrap items-center gap-1" }, children);
}

function partNode(part, tone) {
  if (part.kind === "ref") {
    const style = tone === "emerald" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-700";
    return el("span", { class: `whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium ${style}`, title: "Dato utilizado" }, part.text);
  }
  if (part.kind === "cond") {
    return el("span", { class: "whitespace-nowrap rounded bg-amber-100 px-1 py-0.5 text-xs font-semibold text-amber-700", title: "Condición" }, part.text);
  }
  if (part.kind === "op") return el("span", { class: "text-slate-400" }, part.text);
  return el("span", {}, part.text);
}
