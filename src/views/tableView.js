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
import { OPERATOR_GROUPS, OPERATOR_SYMBOLS } from "../models/operators.js";

// Estilo discreto: sin borde ni fondo hasta pasar el cursor o enfocar, para que
// las celdas vacías no hagan ruido. La caja editable aparece al interactuar.
const CONTROL_CLASS =
  "w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-900 " +
  "outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-300 " +
  "disabled:cursor-not-allowed disabled:text-slate-300";

const TH_CLASS = "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left align-top";
const TD_CLASS = "border-b border-slate-100 px-3 py-2 align-top";

// Definición de las columnas de contenido: título y ayuda contextual (sección UX).
const COLUMNS = [
  { key: "problem", title: "Problema / Necesidad", help: "Sub-necesidad de este paso (opcional)." },
  { key: "inputs", title: "Datos de entrada", help: "Datos que el programa recibe para este paso." },
  { key: "condition", title: "Condición", help: "Pregunta en lenguaje natural que debe validar el programa." },
  { key: "operation", title: "Operación", help: "Constrúyela referenciando datos y operadores." },
  { key: "result", title: "Dato resultante", help: "Dato producido tras realizar una operación." },
  { key: "purpose", title: "Propósito", help: "Para qué se utilizará el dato producido." },
  { key: "subsequentUse", title: "Comentario", help: "Nota libre para anotar qué sigue (opcional)." },
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
    // Datos que alguna fila produce como resultado (los demás son datos de entrada).
    const producedIds = new Set(analysis.rows.map((row) => row.resultId).filter(Boolean));
    const declaredInputs = analysis.data.filter((entry) => !producedIds.has(entry.id));
    const table = el("table", { class: "w-full border-collapse text-sm" }, [
      this.#buildHeader(),
      this.#buildBody(analysis.rows, { dataById, producedIds, declaredInputs }, handlers),
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

  // Re-renderiza preservando el control enfocado y la posición del cursor. Se usa
  // al crear o renombrar un dato para que los selectores, fichas y tipos de las
  // demás celdas se actualicen al instante sin interrumpir la escritura.
  renderKeepingFocus(analysis, handlers) {
    const active = document.activeElement;
    const focusKey = active?.dataset?.focusKey;
    const start = active?.selectionStart ?? null;
    const end = active?.selectionEnd ?? null;

    this.render(analysis, handlers);

    if (!focusKey) return;
    const restored = this.container.querySelector(`[data-focus-key="${focusKey}"]`);
    if (!restored) return;
    restored.focus();
    if (start != null && typeof restored.setSelectionRange === "function") {
      try {
        restored.setSelectionRange(start, end);
      } catch {
        // Algunos tipos de input no admiten setSelectionRange; el foco basta.
      }
    }
  }

  #buildHeader() {
    const cells = [el("th", { class: `${TH_CLASS} w-10 text-slate-400`, scope: "col" }, "#")];
    for (const column of COLUMNS) {
      cells.push(
        el("th", { class: `${TH_CLASS} min-w-[9rem]`, scope: "col" }, [
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
    const { dataById, producedIds, declaredInputs } = catalog;
    // Los cambios se expresan como actualizadores (fila actual) => cambios, de modo
    // que cada edición lea el estado fresco del modelo. Es clave para campos con
    // varios subcampos (result, inputs, ramas): editar uno no debe sobrescribir otro
    // usando una copia capturada en el render anterior.
    const field = (updater) => handlers.onFieldChange(row.id, updater);
    const structural = (updater) => handlers.onStructuralChange(row.id, updater);
    const isDecision = row.purpose === "decision";
    // La condición es una pregunta de decisión; solo se oculta ("no aplica")
    // cuando la fila ya se declaró de otro propósito. Sin propósito aún, se deja
    // editable para no bloquear al estudiante. Las ramas solo aplican a decisiones.
    const conditionApplies = !row.purpose || isDecision;
    const inputEntries = row.inputIds.map((id) => dataById.get(id)).filter(Boolean);
    const resultEntry = row.resultId ? dataById.get(row.resultId) ?? null : null;
    // Datos de entrada declarados que la fila aún no referencia (para su selector).
    const availableInputs = declaredInputs.filter((entry) => !row.inputIds.includes(entry.id));
    // Datos que la operación puede referenciar: las entradas de esta fila y los
    // resultados ya producidos por otras filas.
    const availableRefs = dedupeById([
      ...inputEntries,
      ...[...dataById.values()].filter((entry) => producedIds.has(entry.id) && entry.id !== row.resultId),
    ]);
    // Para construir la respuesta final están disponibles todos los datos del
    // análisis (entradas y resultados de operaciones).
    const allRefs = [...dataById.values()];
    const resolveData = (id) => dataById.get(id) ?? null;

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
      cell(inputsEditor(row.id, inputEntries, availableInputs, handlers)),
      cell(
        conditionApplies
          ? textField(row.condition, "¿Qué pregunta debe responderse?", (value) => field(() => ({ condition: value })))
          : notApplicable(),
      ),
      cell(expressionEditor(row.operation, availableRefs, resolveData, (updater) => handlers.onOperationChange(row.id, updater))),
      cell(resultEditor(row.id, resultEntry, handlers)),
      cell(purposeSelect(row.purpose, (value) => structural(() => ({ purpose: value })))),
      cell(textField(row.subsequentUse, "Comentario…", (value) => field(() => ({ subsequentUse: value })))),
      cell(isDecision ? branchEditor(row.ifTrue, "ifTrue", { structural, refs: allRefs, resolve: resolveData }) : notApplicable()),
      cell(isDecision ? branchEditor(row.ifFalse, "ifFalse", { structural, refs: allRefs, resolve: resolveData }) : notApplicable()),
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
        // Color alternado (zebra) para diferenciar visualmente cada fila.
        class: `${index % 2 === 1 ? "bg-slate-50" : "bg-white"} hover:bg-sky-50/60`,
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

function textField(value, placeholder, onInput) {
  return el("textarea", {
    rows: 2,
    value: value ?? "",
    placeholder,
    class: `${CONTROL_CLASS} resize-y`,
    oninput: (event) => onInput(event.target.value),
  });
}

function selectField(options, value, onChange, { placeholder } = {}) {
  const optionNodes = placeholder != null ? [el("option", { value: "" }, placeholder)] : [];
  for (const option of options) {
    optionNodes.push(el("option", { value: option.value }, option.label));
  }
  const select = el("select", {
    class: CONTROL_CLASS,
    onchange: (event) => onChange(event.target.value),
  }, optionNodes);
  select.value = value ?? "";
  return select;
}

// Etiqueta de un dato reutilizado: "nombre : Tipo".
function dataReferenceLabel(entry) {
  return `${entry.name || "(sin nombre)"} : ${labelOf(DATA_TYPES, entry.type) || "—"}`;
}

// Constructor de expresiones (operación o condición): sus piezas (referencias a
// datos, operadores y literales) se seleccionan, no se escriben como texto. Así
// se usan los datos identificados y sus resultados quedan disponibles para pasos
// posteriores. `onChange` recibe un actualizador (tokens actuales) => nuevos tokens.
function expressionEditor(tokens, refs, resolve, onChange) {
  const append = (token) => onChange((current) => [...current, token]);
  const removeAt = (index) => onChange((current) => current.filter((_, i) => i !== index));

  // Reordenar tokens arrastrando una ficha sobre otra.
  let draggedIndex = null;
  const moveToken = (from, to) => {
    if (from == null || from === to) return;
    onChange((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const chips = tokens.map((token, index) =>
    operationTokenChip(token, resolve, {
      onRemove: () => removeAt(index),
      draggable: tokens.length > 1,
      onDragStart: () => {
        draggedIndex = index;
      },
      onDrop: () => {
        const from = draggedIndex;
        draggedIndex = null;
        moveToken(from, index);
      },
    }),
  );

  const controls = [];
  if (refs.length > 0) {
    const dataSelect = selectField(
      refs.map((entry) => ({ value: entry.id, label: entry.name || "(sin nombre)" })),
      "",
      (dataId) => dataId && append({ kind: "ref", dataId }),
      { placeholder: "+ dato" },
    );
    dataSelect.classList.add("text-xs");
    controls.push(dataSelect);
  }
  controls.push(operatorSelect((op) => append({ kind: "op", op })));

  const literal = el("input", {
    type: "text",
    placeholder: "valor",
    class: `${CONTROL_CLASS} w-16 text-xs`,
  });
  const addLiteral = () => {
    const value = literal.value.trim();
    if (value) append({ kind: "literal", value });
  };
  controls.push(
    el("div", { class: "flex items-center gap-1" }, [
      literal,
      el("button", {
        type: "button",
        class: "shrink-0 rounded px-1.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700",
        onclick: addLiteral,
      }, "+ valor"),
    ]),
  );

  return el("div", { class: "space-y-1" }, [
    tokens.length > 0 ? el("div", { class: "flex flex-wrap items-center gap-1" }, chips) : null,
    el("div", { class: "flex flex-wrap gap-1" }, controls),
  ]);
}

function operationTokenChip(token, resolve, { onRemove, draggable, onDragStart, onDrop }) {
  const { text, className } = describeToken(token, resolve);
  const cursor = draggable ? "cursor-move" : "";
  return el(
    "span",
    {
      class: `inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${cursor} ${className}`,
      draggable: draggable ? "true" : null,
      title: draggable ? "Arrastra para reordenar" : null,
      ondragstart: onDragStart,
      ondragover: (event) => draggable && event.preventDefault(),
      ondrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      },
    },
    [
      el("span", {}, text),
      el("button", {
        type: "button",
        class: "text-slate-400 hover:text-red-600",
        title: "Quitar",
        onclick: onRemove,
      }, "×"),
    ],
  );
}

function describeToken(token, resolve) {
  if (token.kind === "ref") {
    const datum = resolve(token.dataId);
    return {
      text: datum ? datum.name || "(sin nombre)" : "(dato eliminado)",
      className: "border border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  if (token.kind === "op") {
    return { text: OPERATOR_SYMBOLS[token.op] ?? "?", className: "bg-slate-100 font-semibold text-slate-700" };
  }
  return { text: token.value || "∅", className: "border border-amber-200 bg-amber-50 text-amber-700" };
}

// Selector de operador con grupos (Aritméticos / Relacionales / Lógicos).
function operatorSelect(onPick) {
  const groups = Object.values(OPERATOR_GROUPS).map((group) =>
    el(
      "optgroup",
      { label: group.label },
      Object.entries(group.operators).map(([key, symbol]) => el("option", { value: key }, symbol)),
    ),
  );
  const select = el(
    "select",
    {
      class: `${CONTROL_CLASS} text-xs`,
      onchange: (event) => {
        if (event.target.value) onPick(event.target.value);
      },
    },
    [el("option", { value: "" }, "+ operador"), ...groups],
  );
  select.value = "";
  return select;
}

function dedupeById(entries) {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

// Dato resultante: nombre + tipo. El dato se crea de forma diferida en el modelo
// la primera vez que se escribe algo (handlers.onResultChange).
function resultEditor(rowId, result, handlers) {
  const typeSelect = selectField(
    optionsOf(DATA_TYPES),
    result?.type,
    (value) => handlers.onResultChange(rowId, { type: value }),
    { placeholder: "Tipo…" },
  );
  typeSelect.dataset.focusKey = `res-type:${rowId}`;

  return el("div", { class: "space-y-1" }, [
    el("input", {
      type: "text",
      value: result?.name ?? "",
      placeholder: "nombre",
      class: CONTROL_CLASS,
      dataset: { focusKey: `res-name:${rowId}` },
      oninput: (event) => handlers.onResultChange(rowId, { name: event.target.value }),
    }),
    typeSelect,
  ]);
}

// Propósito del dato: nueva operación, decisión o respuesta/información.
function purposeSelect(purpose, onChange) {
  return selectField(optionsOf(PURPOSES), purpose, onChange, { placeholder: "Propósito…" });
}

// Camino de una decisión: a dónde continúa. El constructor de la respuesta solo
// se muestra cuando el camino es "Respuesta"; para los demás tipos basta el
// selector (la operación/decisión siguiente se define en otra fila).
// Solo aparece en filas cuyo propósito es "Decisión".
function branchEditor(branch, key, { structural, refs, resolve }) {
  const children = [
    selectField(optionsOf(BRANCH_TYPES), branch.type, (value) => structural((row) => ({ [key]: { ...row[key], type: value } })), {
      placeholder: "Continúa con…",
    }),
  ];
  if (branch.type === "response") {
    children.push(
      expressionEditor(branch.value, refs, resolve, (updater) =>
        structural((row) => ({ [key]: { ...row[key], value: updater(row[key].value) } })),
      ),
    );
  }
  return el("div", { class: "space-y-1" }, children);
}

// Marcador discreto para una celda que no aplica en esta fila (p. ej. la condición
// o las ramas cuando la fila no es una decisión).
function notApplicable() {
  return el("span", { class: "block px-2 py-1 text-xs text-slate-300", title: "No aplica en esta fila" }, "—");
}

// Datos de entrada de la fila: solo se REUTILIZAN los datos declarados en la
// sección "Datos de entrada". Se muestran como fichas de solo lectura (se editan
// en su sección) y un selector agrega los que aún no se referencian.
function inputsEditor(rowId, entries, availableInputs, handlers) {
  const chips = entries.map((entry) =>
    el("div", { class: "flex items-center gap-1" }, [
      el(
        "span",
        {
          class: "flex-1 truncate rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-slate-600",
          title: "Se edita en la sección «Datos de entrada»",
        },
        dataReferenceLabel(entry),
      ),
      el("button", {
        type: "button",
        class: "shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600",
        title: "Quitar referencia",
        onclick: () => handlers.onRemoveRowInput(rowId, entry.id),
      }, "×"),
    ]),
  );

  const children = [...chips];
  if (availableInputs.length > 0) {
    const picker = selectField(
      availableInputs.map((entry) => ({ value: entry.id, label: dataReferenceLabel(entry) })),
      "",
      (dataId) => dataId && handlers.onReuseInput(rowId, dataId),
      { placeholder: "Agregar dato…" },
    );
    picker.classList.add("text-xs");
    children.push(picker);
  } else if (chips.length === 0) {
    children.push(el("span", { class: "text-xs text-slate-300" }, "Declara datos arriba"));
  }

  return el("div", { class: "space-y-1" }, children);
}
