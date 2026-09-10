// Vista de la cadena del análisis: un FLUJO vertical que hace visible el
// razonamiento — los datos de entrada bajan hacia cada transformación, que produce
// nuevos datos, hasta llegar a la decisión y a la información final. No repite las
// tarjetas de construcción: es una representación de conjunto (más compacta) para
// COMPRENDER cómo fluye el análisis. Deriva de buildChain; solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import { typeBadge } from "./badges.js";
import { formulaBox } from "./cardLayout.js";
import { icon } from "./icons.js";

// Acentos por tipo de nodo, coherentes con el color semántico del resto:
// entrada azul, operación índigo, condición naranja, información final verde.
const NODE = {
  input: "border-[var(--lx-entrada-border)] bg-[var(--lx-entrada-bg)]/60",
  operation: "border-[oklch(0.90_0.04_300)] bg-[var(--lx-surface)]",
  condition: "border-[var(--lx-condicion-border)] bg-[var(--lx-condicion-bg)]/40",
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
      ? el("p", { class: "text-center text-sm text-[var(--lx-ink-muted)]" }, "La cadena aparecerá aquí a medida que completes el análisis.")
      : el("div", {}, [summaryBar(chain), ...flowNodes(chain)]);

    // El diseño centra la etapa Cadena en una columna de 720px, sin tarjeta externa.
    this.container.append(el("div", { class: "mx-auto max-w-[720px]" }, [body]));
  }
}

// Resumen no invasivo del estado del razonamiento: cuántos datos, operaciones,
// decisiones y respuestas lleva el análisis. Da una visión rápida de conjunto.
function summaryBar(chain) {
  const operaciones = chain.proceso.filter((step) => step.kind !== "condition").length;
  const decisiones = chain.proceso.filter((step) => step.kind === "condition" && step.evaluateNow && step.purpose === "decision").length;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const stats = [
    ["data", plural(chain.entradas.length, "dato de entrada", "datos de entrada"), "text-[var(--lx-entrada-fg)]"],
    ["workflow", plural(operaciones, "operación", "operaciones"), "text-[var(--lx-violet)]"],
    ["fork", plural(decisiones, "decisión", "decisiones"), "text-[var(--lx-condicion-fg)]"],
    ["flag", plural(chain.salidas.length, "respuesta final", "respuestas finales"), "text-[var(--lx-resultante-fg)]"],
  ];
  return el("div", { class: "mb-4 flex flex-wrap justify-center gap-2" }, stats.map(([iconName, text, color]) =>
    el("span", { class: "inline-flex items-center gap-1.5 rounded-full border border-[var(--lx-border)] bg-[var(--lx-surface)] px-2.5 py-1 text-xs font-medium text-[var(--lx-ink-body)]" }, [icon(iconName, `h-3.5 w-3.5 ${color}`), text]),
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
  return el("div", { class: "flex justify-center py-1 text-[var(--lx-ink-ghost)]", "aria-hidden": "true" }, "↓");
}

// Nodo de entradas: los datos que recibe el programa (azul).
function inputsBlock(entradas) {
  return el("div", { class: `rounded-lg border ${NODE.input} p-3` }, [
    el("div", { class: "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--lx-entrada-fg)]" }, [icon("data", "h-3.5 w-3.5"), "Entradas"]),
    entradas.length > 0
      ? el("div", { class: "flex flex-wrap gap-1.5" }, entradas.map((datum) => dataChip(datum, "blue")))
      : el("p", { class: "text-sm text-[var(--lx-ink-muted)]" }, "Aún no has identificado datos de entrada."),
  ]);
}

// Nodo de operación: la expresión que combina datos y el dato que produce (índigo).
function operationNode(step) {
  const expr =
    step.operation.length > 0
      ? formulaBox(expressionEl(step.operation))
      : step.inputs.length > 0
        ? el("div", { class: "flex flex-wrap gap-1.5" }, step.inputs.map((datum) => dataChip(datum, datum.produced ? "emerald" : "blue")))
        : el("span", { class: "text-sm italic text-[var(--lx-ink-muted)]" }, "sin operación definida");
  const produces = step.result ? el("div", { class: "flex items-center gap-1.5 text-sm" }, [arrow(), dataChip(step.result, "emerald")]) : null;
  return nodeShell(step.position, "workflow", NODE.operation, "text-[var(--lx-violet)]", step.description || `Actividad ${step.position}`, [expr, produces]);
}

// Nodo de condición: la pregunta, la comparación y, si es una decisión, sus
// caminos (Sí / No) hacia lo que ocurre en cada caso (naranja).
function conditionNode(step) {
  const isDecision = step.evaluateNow && step.purpose === "decision";
  const question = step.condition ? el("p", { class: "text-sm italic text-[var(--lx-ink-body)]" }, `¿${step.condition.replace(/^¿|\?$/g, "")}?`) : null;
  const comparison = step.operation.length > 0 ? formulaBox(expressionEl(step.operation)) : null;
  const produces = step.evaluateNow && step.result ? el("div", { class: "flex items-center gap-1.5 text-sm" }, [arrow(), dataChip(step.result, "emerald")]) : null;
  const branches = isDecision
    ? el("div", { class: "mt-1 space-y-1" }, [branchLine("Sí", step.ifTrue), branchLine("No", step.ifFalse)])
    : null;
  const title = step.description || step.conditionLabel || `Condición ${step.position}`;
  return nodeShell(step.position, "fork", NODE.condition, "text-[var(--lx-condicion-fg)]", title, [question, comparison, produces, branches]);
}

// Nodo genérico: número de paso, icono y título, con el cuerpo alineado debajo.
function nodeShell(position, iconName, cls, titleColor, title, body) {
  return el("div", { class: `rounded-lg border ${cls} p-3` }, [
    el("div", { class: "mb-1.5 flex items-center gap-1.5" }, [
      el("span", { class: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--lx-surface-sunken)] text-[11px] font-semibold text-[var(--lx-ink-muted)]" }, String(position)),
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
        ? el("span", { class: "text-[var(--lx-ink-muted)]" }, path.flow === "finaliza" ? "respuesta final" : "continúa")
        : el("span", { class: "italic text-[var(--lx-ink-muted)]" }, "sin definir");
  return el("div", { class: "flex items-center gap-1.5 text-sm" }, [caseBadge(branchCase), arrow(), outcome]);
}

// Nodo de información final (verde, con más protagonismo): la culminación del
// análisis. Todo el proceso produce finalmente esta información.
function outputBlock(salidas) {
  const items =
    salidas.length > 0
      ? salidas.map((output) =>
          el("div", { class: "flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--lx-resultante-border)] bg-[var(--lx-surface)]/70 px-2.5 py-1.5 text-sm text-[var(--lx-resultante-fg)]" }, [
            output.branch ? caseBadge(output.branch) : null,
            expressionEl(output.parts, "emerald"),
            output.condition ? el("span", { class: "text-[11px] text-[var(--lx-resultante-fg)]/80" }, `· cuando ${output.condition}`) : null,
          ]),
        )
      : [el("p", { class: "text-sm text-[var(--lx-resultante-fg)]/70" }, "Aún no defines la información final (un propósito «Generar la información final» o un camino de respuesta).")];
  return el("div", { class: "rounded-[var(--lx-r-card)] border-2 border-[var(--lx-resultante-border)] bg-[var(--lx-resultante-bg)] p-4" }, [
    el("div", { class: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--lx-resultante-fg)]" }, [icon("flag", "h-4 w-4"), "Información final"]),
    el("div", { class: "space-y-1.5" }, items),
  ]);
}

// Flecha en línea "→" para "produce" / "entonces".
function arrow() {
  return el("span", { class: "font-semibold text-[var(--lx-ink-muted)]" }, "→");
}

// Ficha de un dato con su color semántico (entrada azul, producido verde).
function dataChip(datum, tone) {
  const style = tone === "emerald" ? "border-[var(--lx-resultante-border)] bg-[var(--lx-resultante-bg)] text-[var(--lx-resultante-fg)]" : "border-[var(--lx-entrada-border)] bg-[var(--lx-entrada-bg)] text-[var(--lx-entrada-fg)]";
  return el("span", { class: `inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm ${style}` }, [
    el("span", { class: "whitespace-nowrap" }, datum.name || "(sin nombre)"),
    typeBadge(datum.type),
  ]);
}

// Indica el caso de la condición: Sí (se cumple) o No (no se cumple).
function caseBadge(branchCase) {
  const style = branchCase === "Sí" ? "bg-[var(--lx-green)] text-white" : "bg-rose-500 text-white";
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
    const style = tone === "emerald" ? "bg-[var(--lx-resultante-bg)] text-[var(--lx-resultante-fg)]" : "bg-[var(--lx-entrada-bg)] text-[var(--lx-entrada-fg)]";
    return el("span", { class: `whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium ${style}`, title: "Dato utilizado" }, part.text);
  }
  if (part.kind === "cond") {
    return el("span", { class: "whitespace-nowrap rounded bg-[var(--lx-condicion-bg)] px-1 py-0.5 text-xs font-semibold text-[var(--lx-condicion-fg)]", title: "Condición" }, part.text);
  }
  if (part.kind === "op") return el("span", { class: "text-[var(--lx-ink-muted)]" }, part.text);
  return el("span", {}, part.text);
}
