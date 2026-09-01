// Vista de exportación a PDF. Renderiza en un área de impresión oculta solo las
// secciones seleccionadas y usa la impresión nativa del navegador (Guardar como
// PDF), sin dependencias externas. La información de los estudiantes y la fecha y
// hora de exportación se incluyen según la selección; la fecha es automática.

import { el, clear } from "../utils/dom.js";
import { DATA_TYPES, PURPOSES, BRANCH_TYPES, labelOf } from "../models/dataTypes.js";
import { operationToText } from "../models/operators.js";
import { buildChain } from "../models/chainModel.js";
import { PENDING_ACTIVITY } from "../models/analysisModel.js";

// Secciones que el usuario puede incluir o excluir (todas marcadas por defecto).
export const PDF_SECTIONS = [
  { key: "students", label: "Información de los estudiantes" },
  { key: "table", label: "Tabla de datos" },
  { key: "chain", label: "Cadena de análisis (entradas)" },
  { key: "process", label: "Proceso" },
  { key: "output", label: "Resultados o salida" },
];

export class PdfView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, options) {
    renderForPrint(this.container, analysis, options);
  }

  // Renderiza el contenido y abre el diálogo de impresión del navegador.
  print(analysis, options) {
    this.render(analysis, options);
    document.body.classList.add("printing");
    const cleanup = () => {
      document.body.classList.remove("printing");
      clear(this.container);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }
}

function renderForPrint(container, analysis, { sections, exportedAt }) {
  clear(container);
  const has = (key) => sections.includes(key);
  const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
  const resolve = (id) => dataById.get(id) ?? null;

  const blocks = [printHeader(analysis, exportedAt)];
  if (has("students")) blocks.push(studentsBlock(analysis.students));
  if (has("table")) blocks.push(tableBlock(analysis, resolve));

  if (has("chain") || has("process") || has("output")) {
    const chain = buildChain(analysis);
    if (has("chain")) blocks.push(chainInputsBlock(chain));
    if (has("process")) blocks.push(processBlock(chain));
    if (has("output")) blocks.push(outputBlock(chain));
  }

  container.append(el("div", { class: "space-y-6 p-8 text-sm text-slate-900" }, blocks));
}

function printHeader(analysis, exportedAt) {
  return el("div", { class: "border-b border-slate-300 pb-3" }, [
    el("h1", { class: "text-xl font-semibold" }, analysis.title || "Análisis sin título"),
    analysis.description ? el("p", { class: "mt-1 text-slate-600" }, analysis.description) : null,
    el("p", { class: "mt-1 text-xs text-slate-500" }, `Exportado: ${formatDateTime(exportedAt)}`),
  ]);
}

function sectionTitle(text) {
  return el("h2", { class: "mb-2 text-base font-semibold text-slate-800" }, text);
}

function studentsBlock(students) {
  const rows = students.map((s) =>
    el("tr", {}, [td(s.idNumber), td(s.fullName), td(s.group)]),
  );
  return el("div", {}, [
    sectionTitle("Información de los estudiantes"),
    students.length > 0
      ? printableTable(["N.º de identificación", "Nombre completo", "Grupo"], rows)
      : el("p", { class: "text-slate-500" }, "Sin estudiantes registrados."),
  ]);
}

function tableBlock(analysis, resolve) {
  const inputsText = (row) =>
    row.inputIds.map((id) => resolve(id)).filter(Boolean).map(dataLabel).join(", ");
  const resultText = (row) => (row.resultId ? dataLabel(resolve(row.resultId)) : "");
  const branchText = (branch) =>
    [branch.type ? labelOf(BRANCH_TYPES, branch.type) : "", operationToText(branch.value, resolve)]
      .filter(Boolean)
      .join(": ");
  const activityLabelById = new Map(analysis.rows.map((row, index) => [row.id, `Actividad ${index + 1}`]));
  const usedInText = (row) => {
    if (!row.resultId || !row.usedInRowId) return "";
    if (row.usedInRowId === PENDING_ACTIVITY) return "Pendiente de asignación";
    return activityLabelById.get(row.usedInRowId) ?? "";
  };

  const rows = analysis.rows.map((row, index) =>
    el("tr", {}, [
      td(String(index + 1)),
      td(row.problem),
      td(inputsText(row)),
      td(row.condition),
      td(operationToText(row.operation, resolve)),
      td(resultText(row)),
      td(labelOf(PURPOSES, row.purpose)),
      td(usedInText(row)),
      td(row.subsequentUse),
      td(branchText(row.ifTrue)),
      td(branchText(row.ifFalse)),
    ]),
  );

  return el("div", {}, [
    sectionTitle("Tabla de datos"),
    printableTable(
      ["#", "Problema", "Datos de entrada", "Condición", "Operación", "Dato resultante", "Propósito", "Actividad asociada", "Comentario", "Si se cumple", "Si no se cumple"],
      rows,
    ),
  ]);
}

function chainInputsBlock(chain) {
  return el("div", {}, [
    sectionTitle("Cadena de análisis — Entradas"),
    labelledList("Datos que recibe el programa", chain.entradas.map(dataLabel)),
    chain.producidos.length > 0 ? labelledList("Datos producidos", chain.producidos.map(dataLabel)) : null,
  ]);
}

function processBlock(chain) {
  const cards = chain.proceso.map((step) => processCard(step));
  return el("div", {}, [
    sectionTitle("Proceso"),
    cards.length > 0 ? el("div", { class: "space-y-2" }, cards) : el("p", { class: "text-slate-500" }, "Sin actividades."),
  ]);
}

function processCard(step) {
  const lines = [];
  const add = (label, value) => value && lines.push(el("div", {}, [strong(`${label}: `), value]));
  add("Entradas", step.inputs.map(dataLabel).join(", "));
  add("Condición", step.condition);
  add("Operación", partsText(step.operation));
  add("Resultado", step.result ? dataLabel(step.result) : "");
  add("Propósito", labelOf(PURPOSES, step.purpose));
  add("Comentario", step.comment);
  if (step.purpose === "decision" || step.condition) {
    add("Si se cumple", branchLine(step.ifTrue));
    add("Si no se cumple", branchLine(step.ifFalse));
  }
  return el("div", { class: "rounded border border-slate-300 p-2" }, [
    el("div", { class: "font-medium" }, `#${step.position} ${step.description}`.trim()),
    el("div", { class: "mt-1 space-y-0.5 text-slate-700" }, lines),
  ]);
}

function outputBlock(chain) {
  const items = chain.salidas.map((output) =>
    el("li", {}, [
      output.branch ? strong(`[${output.branch}] `) : null,
      partsText(output.parts),
      output.condition ? el("span", { class: "text-slate-500" }, ` — cuando: ${output.condition}`) : null,
    ]),
  );
  return el("div", {}, [
    sectionTitle("Resultados o salida"),
    items.length > 0 ? el("ul", { class: "list-disc pl-5" }, items) : el("p", { class: "text-slate-500" }, "Sin salidas."),
  ]);
}

// --- Ayudas ---

function printableTable(headers, rows) {
  return el("table", { class: "w-full border-collapse text-xs" }, [
    el("thead", {}, [el("tr", {}, headers.map((h) => el("th", { class: "border border-slate-400 bg-slate-100 px-1.5 py-1 text-left" }, h)))]),
    el("tbody", {}, rows),
  ]);
}

function td(text) {
  return el("td", { class: "border border-slate-300 px-1.5 py-1 align-top" }, text || "");
}

function labelledList(label, values) {
  return el("div", { class: "mb-2" }, [
    strong(`${label}: `),
    values.length > 0 ? values.join(" · ") : el("span", { class: "text-slate-500" }, "—"),
  ]);
}

function strong(text) {
  return el("span", { class: "font-medium" }, text);
}

function dataLabel(datum) {
  return `${datum.name || "(sin nombre)"} : ${labelOf(DATA_TYPES, datum.type) || "—"}`;
}

function partsText(parts) {
  return parts.map((part) => part.text).join(" ");
}

function branchLine(branch) {
  return [branch.type ? `${labelOf(BRANCH_TYPES, branch.type)}: ` : "", partsText(branch.parts)].join("");
}

function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
