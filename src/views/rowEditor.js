// Constructores de los campos editables de una actividad (fila), compartidos por
// la vista de tabla y la de tarjetas para que ambas ofrezcan exactamente las
// mismas funciones sobre el mismo modelo. Solo se ocupa del DOM.

import { el } from "../utils/dom.js";
import { DATA_TYPES, BRANCH_TYPES, PURPOSES, optionsOf, labelOf } from "../models/dataTypes.js";
import { OPERATOR_GROUPS, OPERATOR_SYMBOLS } from "../models/operators.js";
import { typeBadge } from "./badges.js";
import { icon } from "./icons.js";
import { PENDING_ACTIVITY } from "../models/analysisModel.js";

// Estilo discreto: sin borde ni fondo hasta pasar el cursor o enfocar.
const CONTROL_CLASS =
  "w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-900 " +
  "outline-none hover:border-slate-200 hover:bg-slate-50 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200 " +
  "disabled:cursor-not-allowed disabled:text-slate-300";

// Orden y etiquetas de los campos de una actividad (usado por ambas vistas).
export const FIELD_ORDER = [
  { key: "problem", label: "Problema / Necesidad", help: "Sub-necesidad de este paso (opcional)." },
  { key: "inputs", label: "Datos de entrada", help: "Datos que el programa recibe para este paso." },
  { key: "condition", label: "Condición", help: "Pregunta en lenguaje natural que debe validar el programa." },
  { key: "operation", label: "Operación", help: "Constrúyela referenciando datos y operadores." },
  { key: "result", label: "Dato resultante", help: "Dato producido tras realizar una operación." },
  { key: "purpose", label: "Propósito", help: "Para qué se utilizará el dato producido." },
  { key: "usedIn", label: "Actividad asociada", help: "Actividad donde se usará el dato producido." },
  { key: "comment", label: "Comentario", help: "Nota libre para anotar qué sigue (opcional)." },
  { key: "ifTrue", label: "Si se cumple", help: "Camino cuando la condición se cumple (decisiones)." },
  { key: "ifFalse", label: "Si no se cumple", help: "Camino cuando la condición no se cumple (decisiones)." },
];

// Construye los nodos editables de una fila. Los campos que no aplican en la fila
// (condición y ramas fuera de una decisión) devuelven null, para que cada vista
// decida cómo mostrarlos (la tabla pone "—"; las tarjetas los omiten).
export function buildRowFields(row, dataById, handlers, activities = []) {
  const field = (updater) => handlers.onFieldChange(row.id, updater);
  const structural = (updater) => handlers.onStructuralChange(row.id, updater);
  const isDecision = row.purpose === "decision";
  const conditionApplies = !row.purpose || isDecision;
  const inputEntries = row.inputIds.map((id) => dataById.get(id)).filter(Boolean);
  const resultEntry = row.resultId ? dataById.get(row.resultId) ?? null : null;
  const allData = [...dataById.values()].filter((entry) => entry.id !== row.resultId);
  const availableInputs = allData.filter((entry) => !row.inputIds.includes(entry.id));
  const resolveData = (id) => dataById.get(id) ?? null;

  return {
    problem: textField(row.problem, "Necesidad de este paso", (value) => field(() => ({ problem: value }))),
    inputs: inputsEditor(row.id, inputEntries, availableInputs, handlers),
    condition: conditionApplies
      ? textField(row.condition, "¿Qué pregunta debe responderse?", (value) => field(() => ({ condition: value })))
      : null,
    operation: expressionEditor(row.operation, allData, resolveData, (updater) => handlers.onOperationChange(row.id, updater), `op:${row.id}`),
    result: resultEditor(row.id, resultEntry, handlers),
    purpose: purposeSelect(row.purpose, (value) => structural(() => ({ purpose: value }))),
    // La actividad asociada solo aplica cuando la fila produce un dato que reutilizar.
    usedIn: row.resultId ? usedInSelect(row, activities, (value) => handlers.onUsedInChange(row.id, value)) : null,
    comment: textField(row.subsequentUse, "Comentario…", (value) => field(() => ({ subsequentUse: value }))),
    ifTrue: isDecision ? branchEditor(row.ifTrue, "ifTrue", { structural, refs: allData, resolve: resolveData, rowId: row.id }) : null,
    ifFalse: isDecision ? branchEditor(row.ifFalse, "ifFalse", { structural, refs: allData, resolve: resolveData, rowId: row.id }) : null,
  };
}

// Lista de actividades con una etiqueta reconocible (posición + dato/necesidad),
// para poblar el selector de "actividad asociada". El id es la clave estable.
export function buildActivityList(rows, dataById) {
  return rows.map((row, index) => {
    const detail = dataById.get(row.resultId)?.name || row.problem || "";
    const label = detail ? `Actividad ${index + 1} · ${detail}` : `Actividad ${index + 1}`;
    return { id: row.id, label };
  });
}

// Marcador discreto para un campo que no aplica en esta actividad.
export function notApplicable() {
  return el("span", { class: "block px-2 py-1 text-xs text-slate-300", title: "No aplica en esta actividad" }, "—");
}

// Re-renderiza preservando el control enfocado y la posición del cursor, para que
// al crear o renombrar un dato se refresquen las demás celdas sin interrumpir la
// escritura. `render` re-dibuja dentro de `container`.
export function renderPreservingFocus(container, render) {
  const active = document.activeElement;
  const focusKey = active?.dataset?.focusKey;
  const start = active?.selectionStart ?? null;
  const end = active?.selectionEnd ?? null;

  render();

  if (!focusKey) return;
  const restored = container.querySelector(`[data-focus-key="${focusKey}"]`);
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

// Selector para alternar entre la vista de tabla y la de tarjetas.
export function viewToggle(mode, onToggle) {
  const button = (key, label) =>
    el(
      "button",
      {
        type: "button",
        class: `rounded px-3 py-1 text-sm font-medium transition ${mode === key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`,
        onclick: () => mode !== key && onToggle(key),
      },
      label,
    );
  return el("div", { class: "inline-flex rounded-md bg-slate-100 p-0.5" }, [button("table", "Tabla"), button("cards", "Tarjetas")]);
}

export function dataReferenceLabel(entry) {
  return `${entry.name || "(sin nombre)"} : ${labelOf(DATA_TYPES, entry.type) || "—"}`;
}

// Tirador de arrastre. La identidad viaja por el id de la actividad; `setDragged`
// registra (o limpia) la actividad que se está arrastrando en la vista. Marca el
// elemento arrastrado (atenuado) para que sea identificable durante el arrastre.
export function dragHandle(rowId, setDragged) {
  return el(
    "span",
    {
      class: "block cursor-move select-none text-slate-300 hover:text-slate-500",
      title: "Arrastrar para reordenar",
      draggable: "true",
      "aria-label": "Reordenar actividad",
      ondragstart: (event) => {
        setDragged(rowId);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", rowId);
        }
        event.currentTarget.closest("[data-row-id]")?.classList.add("is-dragging");
      },
      ondragend: (event) => {
        setDragged(null);
        event.currentTarget.closest("[data-row-id]")?.classList.remove("is-dragging");
        // Limpia cualquier resaltado de destino que quedara si no hubo "drop".
        document.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
      },
    },
    "⠿",
  );
}

// Resalta (o limpia) un elemento como posible destino del arrastre. Se usa en los
// eventos dragover/dragleave/drop de las filas y tarjetas.
export function markDropTarget(element) {
  element.classList.add("is-drop-target");
}

export function clearDropTarget(element) {
  element.classList.remove("is-drop-target");
}

// Pasa la actividad a modo edición (mostrada en el modo de visualización).
export function editButton(onClick) {
  return el(
    "button",
    {
      type: "button",
      class: "inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700",
      title: "Editar esta actividad",
      onclick: onClick,
    },
    [icon("edit", "h-3.5 w-3.5"), "Editar"],
  );
}

// Finaliza la edición y devuelve la actividad al modo de visualización.
export function doneButton(onClick) {
  return el(
    "button",
    {
      type: "button",
      class: "inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700",
      title: "Terminar de editar",
      onclick: onClick,
    },
    [icon("check", "h-3.5 w-3.5"), "Listo"],
  );
}

export function deleteButton(onClick) {
  return el(
    "button",
    {
      type: "button",
      class: "rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600",
      title: "Eliminar actividad",
      "aria-label": "Eliminar actividad",
      onclick: onClick,
    },
    "🗑",
  );
}

export function addActivityButton(onAddRow) {
  return el("div", { class: "mt-3" }, [
    el(
      "button",
      {
        type: "button",
        class: "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50",
        onclick: () => onAddRow(),
      },
      "+ Agregar actividad",
    ),
  ]);
}

// --- Constructores de controles ---

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
  const select = el("select", { class: CONTROL_CLASS, onchange: (event) => onChange(event.target.value) }, optionNodes);
  select.value = value ?? "";
  return select;
}

// Constructor visual de una expresión: fichas de tokens (dato/operador/valor) que
// se agregan, borran y reordenan. Los datos y valores se agregan con un campo de
// autocompletado; los operadores, con botones rápidos. `focusKey` identifica el
// campo de este editor para conservar el foco al re-renderizar (encadenar rápido).
function expressionEditor(tokens, refs, resolve, onChange, focusKey = "expr") {
  const append = (token) => onChange((current) => [...current, token]);
  const removeAt = (index) => onChange((current) => current.filter((_, i) => i !== index));
  const removeLast = () => onChange((current) => current.slice(0, -1));

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

  // Campo de dato o valor con autocompletado de los datos disponibles. Al confirmar,
  // si el texto coincide con el nombre de un dato se agrega como referencia; si no,
  // como valor constante. El estudiante decide qué usar; la búsqueda solo localiza.
  const named = refs.filter((entry) => (entry.name ?? "").trim());
  const listId = `expr-data-${focusKey}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const datalist = el("datalist", { id: listId }, named.map((entry) => el("option", { value: entry.name })));
  const input = el("input", {
    type: "text",
    placeholder: "dato o valor…",
    autocomplete: "off",
    class: `${CONTROL_CLASS} w-40 text-xs`,
    dataset: { focusKey: `expr:${focusKey}` },
    onkeydown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Backspace" && input.value === "" && tokens.length > 0) {
        event.preventDefault();
        removeLast();
      }
    },
  });
  input.setAttribute("list", listId); // `list` es de solo lectura como propiedad
  const commit = () => {
    const text = input.value.trim();
    if (!text) return;
    const match = named.find((entry) => entry.name.toLowerCase() === text.toLowerCase());
    append(match ? { kind: "ref", dataId: match.id } : { kind: "literal", value: text });
  };
  const addButton = el(
    "button",
    { type: "button", class: "shrink-0 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:text-indigo-700", title: "Agregar dato o valor", onmousedown: (event) => event.preventDefault(), onclick: commit },
    "Agregar",
  );

  // Botones rápidos de operadores, agrupados por categoría con su rótulo visible.
  const operatorButtons = Object.values(OPERATOR_GROUPS).map((group) =>
    el("div", { class: "flex flex-col gap-0.5" }, [
      el("span", { class: "text-[0.65rem] font-medium uppercase tracking-wide text-slate-400" }, group.label),
      el(
        "div",
        { class: "flex gap-0.5" },
        Object.entries(group.operators).map(([key, symbol]) =>
          el(
            "button",
            {
              type: "button",
              title: `${group.label}: ${symbol}`,
              dataset: { op: key },
              class: "min-w-[1.6rem] rounded border border-slate-200 bg-white px-1.5 py-1 text-xs font-mono font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700",
              onmousedown: (event) => event.preventDefault(),
              onclick: () => append({ kind: "op", op: key }),
            },
            symbol,
          ),
        ),
      ),
    ]),
  );

  return el("div", { class: "space-y-1.5" }, [
    tokens.length > 0 ? el("div", { class: "flex flex-wrap items-center gap-1" }, chips) : null,
    el("div", { class: "flex flex-wrap items-start gap-x-4 gap-y-2" }, [
      el("div", { class: "flex items-center gap-1" }, [input, datalist, addButton]),
      el("div", { class: "flex flex-wrap items-start gap-x-4 gap-y-2" }, operatorButtons),
    ]),
  ]);
}

function operationTokenChip(token, resolve, { onRemove, draggable, onDragStart, onDrop }) {
  const { leading, text, className, extra = "" } = describeToken(token, resolve);
  const cursor = draggable ? "cursor-move" : "";
  return el(
    "span",
    {
      class: `inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${extra} ${cursor} ${className}`,
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
      leading,
      el("span", { class: "whitespace-nowrap" }, text),
      el("button", { type: "button", class: "text-slate-400 hover:text-red-600", title: "Quitar", onclick: onRemove }, "×"),
    ],
  );
}

// Describe una ficha por tipo. Cada tipo se distingue por FORMA además del color:
// dato = icono de datos; operador = símbolo monoespaciado en negrita; valor = «#».
function describeToken(token, resolve) {
  if (token.kind === "ref") {
    const datum = resolve(token.dataId);
    return {
      leading: icon("data", "h-3 w-3 shrink-0 text-sky-500"),
      text: datum ? datum.name || "(sin nombre)" : "(dato eliminado)",
      className: "border border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  if (token.kind === "op") {
    return { leading: null, text: OPERATOR_SYMBOLS[token.op] ?? "?", className: "bg-slate-200 text-slate-700", extra: "font-mono font-bold" };
  }
  return {
    leading: icon("hash", "h-3 w-3 shrink-0 text-amber-500"),
    text: token.value || "∅",
    className: "border border-amber-200 bg-amber-50 text-amber-700",
    extra: "font-mono",
  };
}

function resultEditor(rowId, result, handlers) {
  const typeSelect = selectField(optionsOf(DATA_TYPES), result?.type, (value) => handlers.onResultChange(rowId, { type: value }), {
    placeholder: "Tipo…",
  });
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

function purposeSelect(purpose, onChange) {
  return selectField(optionsOf(PURPOSES), purpose, onChange, { placeholder: "Propósito…" });
}

// Selector de la actividad donde se usará el dato producido. Además de las otras
// actividades, ofrece "Pendiente" para cuando la actividad destino aún no existe.
function usedInSelect(row, activities, onChange) {
  const others = activities.filter((activity) => activity.id !== row.id);
  const options = [
    { value: PENDING_ACTIVITY, label: "Pendiente de asignación" },
    ...others.map((activity) => ({ value: activity.id, label: activity.label })),
  ];
  return selectField(options, row.usedInRowId, onChange, { placeholder: "— Sin asignar —" });
}

// Camino de una decisión: el constructor de la respuesta solo aparece para "Respuesta".
function branchEditor(branch, key, { structural, refs, resolve, rowId }) {
  const children = [
    selectField(optionsOf(BRANCH_TYPES), branch.type, (value) => structural((row) => ({ [key]: { ...row[key], type: value } })), {
      placeholder: "Continúa con…",
    }),
  ];
  if (branch.type === "response") {
    children.push(
      expressionEditor(
        branch.value,
        refs,
        resolve,
        (updater) => structural((row) => ({ [key]: { ...row[key], value: updater(row[key].value) } })),
        `br:${rowId}:${key}`,
      ),
    );
  }
  return el("div", { class: "space-y-1" }, children);
}

// Datos de entrada de la fila: solo se reutilizan (fichas de solo lectura + selector).
function inputsEditor(rowId, entries, availableInputs, handlers) {
  const chips = entries.map((entry) =>
    el("div", { class: "flex items-center gap-1" }, [
      el(
        "span",
        {
          class: "flex flex-1 items-center gap-1.5 rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-slate-600",
          title: "Se edita en la sección «Datos de entrada»",
        },
        [el("span", { class: "min-w-0 truncate" }, entry.name || "(sin nombre)"), typeBadge(entry.type)],
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
