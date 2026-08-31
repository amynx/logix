// Vista de la tabla de análisis. Representa el estado como una tabla editable y
// notifica los cambios mediante callbacks. Solo se ocupa del DOM: no conoce el
// modelo ni la persistencia.
//
// Estrategia de renderizado para no perder el foco mientras se escribe:
//   - edición de texto/select que no altera la estructura → onFieldChange (sin re-render);
//     el valor ya está en el DOM y el modelo se sincroniza en segundo plano.
//   - cambios que alteran qué controles se muestran (propósito, añadir/quitar un
//     dato de entrada) → onStructuralChange, que provoca un nuevo render de la tabla.

import { el, clear } from "../utils/dom.js";
import { DATA_TYPES, BRANCH_TYPES, PURPOSES, optionsOf, labelOf } from "../models/dataTypes.js";

const CONTROL_CLASS =
  "w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 " +
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const TH_CLASS = "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left align-top";
const TD_CLASS = "border-b border-slate-100 px-3 py-2 align-top";

// Definición de las columnas de contenido: título y ayuda contextual (sección UX).
const COLUMNS = [
  { key: "problem", title: "Problema / Necesidad", help: "Sub-necesidad de este paso (opcional)." },
  { key: "inputs", title: "Datos de entrada", help: "Datos que el programa recibe para este paso." },
  { key: "condition", title: "Condición", help: "Pregunta que debe responderse para decidir el camino." },
  { key: "operation", title: "Operación", help: "Operación que debe realizarse." },
  { key: "result", title: "Dato resultante", help: "Dato producido tras realizar una operación." },
  { key: "purpose", title: "Propósito", help: "Para qué se utilizará el dato producido." },
  { key: "subsequentUse", title: "Uso posterior", help: "Cómo se integra el dato en la siguiente operación o información." },
  { key: "ifTrue", title: "Si se cumple", help: "Camino cuando la condición se cumple (decisiones)." },
  { key: "ifFalse", title: "Si no se cumple", help: "Camino cuando la condición no se cumple (decisiones)." },
];

export class TableView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, handlers) {
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    // Datos que alguna fila produce como resultado: se editan en su celda de
    // origen y se reutilizan como referencia de solo lectura en otras filas.
    const producedIds = new Set(analysis.rows.map((row) => row.resultId).filter(Boolean));
    const table = el("table", { class: "w-full border-collapse text-sm" }, [
      this.#buildHeader(),
      this.#buildBody(analysis.rows, { dataById, producedIds }, handlers),
    ]);
    this.container.append(
      el("div", { class: "overflow-x-auto rounded-lg border border-slate-200 bg-white" }, [table]),
      el("div", { class: "mt-3" }, [
        el(
          "button",
          {
            type: "button",
            class:
              "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium " +
              "text-slate-700 hover:bg-slate-50",
            onclick: () => handlers.onAddRow(),
          },
          "+ Agregar fila",
        ),
      ]),
    );
  }

  #buildHeader() {
    const cells = [el("th", { class: `${TH_CLASS} w-10 text-slate-400`, scope: "col" }, "#")];
    for (const column of COLUMNS) {
      cells.push(
        el("th", { class: `${TH_CLASS} min-w-[13rem]`, scope: "col" }, [
          el("div", { class: "font-semibold text-slate-700" }, column.title),
          el("div", { class: "mt-0.5 text-xs font-normal text-slate-400" }, column.help),
        ]),
      );
    }
    cells.push(el("th", { class: `${TH_CLASS} w-12`, scope: "col" }, el("span", { class: "sr-only" }, "Acciones")));
    return el("thead", { class: "bg-slate-50" }, [el("tr", {}, cells)]);
  }

  #buildBody(rows, catalog, handlers) {
    return el("tbody", {}, rows.map((row, index) => this.#buildRow(row, index, catalog, handlers)));
  }

  #buildRow(row, index, catalog, handlers) {
    const { dataById, producedIds } = catalog;
    // Los cambios se expresan como actualizadores (fila actual) => cambios, de modo
    // que cada edición lea el estado fresco del modelo. Es clave para campos con
    // varios subcampos (result, inputs, ramas): editar uno no debe sobrescribir otro
    // usando una copia capturada en el render anterior.
    const field = (updater) => handlers.onFieldChange(row.id, updater);
    const structural = (updater) => handlers.onStructuralChange(row.id, updater);
    const isDecision = row.purpose === "decision";
    const inputEntries = row.inputIds.map((id) => dataById.get(id)).filter(Boolean);
    const resultEntry = row.resultId ? dataById.get(row.resultId) ?? null : null;
    // Datos que esta fila puede reutilizar: los del catálogo que no consume ya
    // ni produce ella misma.
    const reusable = [...dataById.values()].filter(
      (entry) => !row.inputIds.includes(entry.id) && entry.id !== row.resultId,
    );

    const cells = [
      el("td", { class: `${TD_CLASS} text-center` }, [
        el(
          "span",
          {
            class: "block cursor-move select-none text-slate-300 hover:text-slate-500",
            title: "Arrastrar para reordenar",
            draggable: "true",
            "aria-label": "Reordenar fila",
            ondragstart: (event) => {
              this.draggedRowId = row.id;
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", row.id);
              }
            },
            ondragend: () => {
              this.draggedRowId = null;
            },
          },
          "⠿",
        ),
        el("span", { class: "text-xs text-slate-400" }, String(index + 1)),
      ]),
      cell(textField(row.problem, "Necesidad de este paso", (value) => field(() => ({ problem: value })))),
      cell(inputsEditor(row.id, inputEntries, { producedIds, reusable }, handlers)),
      cell(textField(row.condition, "¿Qué debe responderse?", (value) => field(() => ({ condition: value })))),
      cell(textField(row.operation, "Operación a realizar", (value) => field(() => ({ operation: value })))),
      cell(resultEditor(row.id, resultEntry, handlers)),
      cell(purposeSelect(row.purpose, (value) => structural(() => ({ purpose: value })))),
      cell(textField(row.subsequentUse, subsequentUsePlaceholder(row.purpose), (value) => field(() => ({ subsequentUse: value })))),
      cell(branchEditor(row.ifTrue, "ifTrue", field, !isDecision)),
      cell(branchEditor(row.ifFalse, "ifFalse", field, !isDecision)),
      el("td", { class: `${TD_CLASS} text-center` }, [
        el(
          "button",
          {
            type: "button",
            class: "rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600",
            title: "Eliminar fila",
            "aria-label": "Eliminar fila",
            onclick: () => handlers.onDeleteRow(row.id),
          },
          "🗑",
        ),
      ]),
    ];

    return el(
      "tr",
      {
        class: "hover:bg-slate-50/60",
        dataset: { rowId: row.id },
        ondragover: (event) => event.preventDefault(),
        ondrop: (event) => {
          event.preventDefault();
          const fromId = this.draggedRowId;
          this.draggedRowId = null;
          if (fromId && fromId !== row.id) handlers.onMoveRow(fromId, row.id);
        },
      },
      cells,
    );
  }
}

// --- Constructores de controles reutilizables ---

function cell(content) {
  return el("td", { class: TD_CLASS }, [content]);
}

function textField(value, placeholder, onInput, { disabled = false } = {}) {
  const textarea = el("textarea", {
    rows: 2,
    value: value ?? "",
    placeholder,
    class: `${CONTROL_CLASS} resize-y`,
    oninput: (event) => onInput(event.target.value),
  });
  textarea.disabled = disabled;
  return textarea;
}

function selectField(options, value, onChange, { placeholder, disabled = false } = {}) {
  const optionNodes = placeholder != null ? [el("option", { value: "" }, placeholder)] : [];
  for (const option of options) {
    optionNodes.push(el("option", { value: option.value }, option.label));
  }
  const select = el("select", {
    class: CONTROL_CLASS,
    onchange: (event) => onChange(event.target.value),
  }, optionNodes);
  select.disabled = disabled;
  select.value = value ?? "";
  return select;
}

// El texto guía de "Uso posterior" cambia según el propósito elegido.
function subsequentUsePlaceholder(purpose) {
  if (purpose === "operation") return "Cómo alimenta la siguiente operación";
  if (purpose === "response") return "Qué información se mostrará";
  if (purpose === "decision") return "Cómo se integra el dato";
  return "Cómo se usa el dato";
}

// Dato resultante: nombre + tipo. El dato se crea de forma diferida en el modelo
// la primera vez que se escribe algo (handlers.onResultChange).
function resultEditor(rowId, result, handlers) {
  return el("div", { class: "space-y-1" }, [
    el("input", {
      type: "text",
      value: result?.name ?? "",
      placeholder: "nombre",
      class: CONTROL_CLASS,
      oninput: (event) => handlers.onResultChange(rowId, { name: event.target.value }),
    }),
    selectField(optionsOf(DATA_TYPES), result?.type, (value) => handlers.onResultChange(rowId, { type: value }), {
      placeholder: "Tipo…",
    }),
  ]);
}

// Propósito del dato: nueva operación, decisión o respuesta/información.
function purposeSelect(purpose, onChange) {
  return selectField(optionsOf(PURPOSES), purpose, onChange, { placeholder: "Propósito…" });
}

// Camino de una decisión: cómo continúa (respuesta/operación/otra decisión) y su detalle.
// Solo tiene sentido cuando el propósito de la fila es "Decisión"; en otro caso se
// muestra deshabilitado para orientar al estudiante.
function branchEditor(branch, key, field, disabled) {
  const wrapper = el("div", { class: "space-y-1" }, [
    selectField(optionsOf(BRANCH_TYPES), branch.type, (value) => field((row) => ({ [key]: { ...row[key], type: value } })), {
      placeholder: "Continúa con…",
      disabled,
    }),
    textField(branch.value, "Detalle del camino", (value) => field((row) => ({ [key]: { ...row[key], value } })), { disabled }),
  ]);
  if (disabled) wrapper.classList.add("opacity-50");
  return wrapper;
}

// Lista de datos de entrada de la fila. Un dato que otra fila produce se muestra
// como ficha de solo lectura (se renombra en su origen); uno propio es editable.
// Al pie: reutilizar un dato existente o crear uno nuevo.
function inputsEditor(rowId, entries, { producedIds, reusable }, handlers) {
  const detachButton = (dataId, title) =>
    el("button", {
      type: "button",
      class: "shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600",
      title,
      onclick: () => handlers.onRemoveRowInput(rowId, dataId),
    }, "×");

  const rows = entries.map((entry) => {
    if (producedIds.has(entry.id)) {
      return el("div", { class: "flex items-center gap-1" }, [
        el(
          "span",
          {
            class: "flex-1 truncate rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-slate-600",
            title: "Dato reutilizado (se edita en su fila de origen)",
          },
          `${entry.name || "(sin nombre)"} : ${labelOf(DATA_TYPES, entry.type) || "—"}`,
        ),
        detachButton(entry.id, "Quitar referencia"),
      ]);
    }

    return el("div", { class: "flex items-center gap-1" }, [
      el("input", {
        type: "text",
        value: entry.name ?? "",
        placeholder: "nombre",
        class: CONTROL_CLASS,
        oninput: (event) => handlers.onDataChange(entry.id, { name: event.target.value }),
      }),
      selectField(optionsOf(DATA_TYPES), entry.type, (value) => handlers.onDataChange(entry.id, { type: value }), {
        placeholder: "Tipo…",
      }),
      detachButton(entry.id, "Quitar dato"),
    ]);
  });

  const actions = [
    el("button", {
      type: "button",
      class: "text-xs font-medium text-slate-500 hover:text-slate-700",
      onclick: () => handlers.onAddRowInput(rowId),
    }, "+ dato"),
  ];

  if (reusable.length > 0) {
    const reuse = selectField(
      reusable.map((entry) => ({ value: entry.id, label: `${entry.name || "(sin nombre)"} : ${labelOf(DATA_TYPES, entry.type) || "—"}` })),
      "",
      (dataId) => dataId && handlers.onReuseInput(rowId, dataId),
      { placeholder: "Reutilizar dato…" },
    );
    reuse.classList.add("text-xs");
    actions.push(reuse);
  }

  return el("div", { class: "space-y-1" }, [...rows, el("div", { class: "space-y-1" }, actions)]);
}
