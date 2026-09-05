// Constructores de los campos editables de una actividad (fila), compartidos por
// la vista de tabla y la de tarjetas para que ambas ofrezcan exactamente las
// mismas funciones sobre el mismo modelo. Solo se ocupa del DOM.

import { el } from "../utils/dom.js";
import { DATA_TYPES, BRANCH_TYPES, PURPOSES, optionsOf, labelOf } from "../models/dataTypes.js";
import { OPERATOR_GROUPS, OPERATOR_SYMBOLS } from "../models/operators.js";
import { capitalizeFirst, formatAsQuestion } from "../models/textNormalization.js";
import { attachMentions } from "./mentionMenu.js";
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
export function buildRowFields(row, dataById, handlers, activities = [], producedIds = new Set()) {
  const field = (updater) => handlers.onFieldChange(row.id, updater);
  const structural = (updater) => handlers.onStructuralChange(row.id, updater);
  const isCondition = row.kind === "condition";
  const mentions = handlers.getDataMentions; // menú "/" para insertar referencias
  const inputEntries = row.inputIds.map((id) => dataById.get(id)).filter(Boolean);
  const resultEntry = row.resultId ? dataById.get(row.resultId) ?? null : null;
  const allData = [...dataById.values()].filter((entry) => entry.id !== row.resultId);
  const availableInputs = allData.filter((entry) => !row.inputIds.includes(entry.id));
  const resolveData = (id) => dataById.get(id) ?? null;
  const kindToggle = activityKindToggle(row.kind, (kind) => structural(() => ({ kind })));
  // Contexto de condiciones para COMPONER comprobaciones (C1 Y C2…) en una expresión.
  // Una condición no se compone a sí misma: se excluye la fila actual.
  const conditions = handlers.conditionEntries
    ? { entries: handlers.conditionEntries().filter((entry) => entry.id !== row.id), resolve: handlers.resolveCondition }
    : null;
  // Datos disponibles en el editor, en selects separados: resultados producidos por
  // otras actividades, y datos de entrada. Para una operación, las entradas son las
  // definidas para esa actividad (`inputIds`); una condición (sin esa zona) ofrece
  // todos los datos de entrada declarados.
  const resultRefs = allData.filter((entry) => producedIds.has(entry.id));
  const inputRefs = isCondition
    ? allData.filter((entry) => !producedIds.has(entry.id))
    : row.inputIds.map((id) => dataById.get(id)).filter(Boolean);
  // Si no hay datos de entrada disponibles, una pista dice de dónde salen (para que
  // el selector no desaparezca sin explicación).
  const inputHint = inputRefs.length > 0
    ? null
    : isCondition
      ? "Declara datos en «Datos de entrada» para usarlos aquí"
      : "Agrega datos de entrada a esta actividad (arriba) para usarlos aquí";
  const exprCtx = { inputRefs, resultRefs, resolve: resolveData, producedIds, conditions, inputHint };
  const expression = (tokens, focusKey) =>
    expressionEditor(tokens, (updater) => handlers.onOperationChange(row.id, updater), focusKey, exprCtx);
  const branch = (key) => branchEditor(row[key], key, { structural, rowId: row.id, exprCtx });

  // Una condición: pregunta + expresión + nombre, y decide si evaluarse ahora. Si
  // NO se evalúa, queda reutilizable (dónde se usará + comentario). Si SÍ se evalúa,
  // produce un dato lógico con propósito; como decisión, lleva sus caminos.
  if (isCondition) {
    const evaluated = row.evaluateNow;
    const isDecisionCondition = evaluated && row.purpose === "decision";
    const showUsedIn = !evaluated || row.purpose === "operation" || row.purpose === "decision";
    return {
      kind: kindToggle,
      conditionName: conditionNameField(row, field, handlers),
      condition: textField(row.condition, "¿Qué se comprueba?", (value) => field(() => ({ condition: value })), { normalize: formatAsQuestion, mentions }),
      operation: expression(row.operation, `op:${row.id}`),
      evaluate: evaluateToggle(row.evaluateNow, (value) => structural(() => ({ evaluateNow: value }))),
      result: evaluated ? logicalResultEditor(row.id, resultEntry, handlers) : null,
      purpose: evaluated ? purposeSelect(row.purpose, (value) => structural(() => ({ purpose: value }))) : null,
      usedIn: showUsedIn ? usedInSelect(row, activities, (value) => handlers.onUsedInChange(row.id, value)) : null,
      comment: textField(row.subsequentUse, "Comentario…", (value) => field(() => ({ subsequentUse: value })), { mentions }),
      ifTrue: isDecisionCondition ? branch("ifTrue") : null,
      ifFalse: isDecisionCondition ? branch("ifFalse") : null,
    };
  }

  // Una operación produce un dato: necesidad + expresión + dato resultante +
  // propósito (nueva operación o información final) + uso posterior + comentario.
  // No comprueba (las condiciones son su propia tarjeta) ni tiene caminos.
  return {
    kind: kindToggle,
    problem: textField(row.problem, "Necesidad de este paso", (value) => field(() => ({ problem: value })), { normalize: capitalizeFirst, mentions }),
    inputs: inputsEditor(row.id, inputEntries, availableInputs, handlers),
    operation: expression(row.operation, `op:${row.id}`),
    result: resultEditor(row.id, resultEntry, handlers),
    purpose: purposeSelect(row.purpose, (value) => structural(() => ({ purpose: value }))),
    // La actividad asociada solo aplica cuando la fila produce un dato que reutilizar.
    usedIn: row.resultId ? usedInSelect(row, activities, (value) => handlers.onUsedInChange(row.id, value)) : null,
    comment: textField(row.subsequentUse, "Comentario…", (value) => field(() => ({ subsequentUse: value })), { mentions }),
  };
}

// Interruptor del tipo de actividad: operación (produce un dato) o condición
// (comprobación reutilizable). Cambia qué campos muestra la tarjeta.
function activityKindToggle(kind, onChange) {
  const button = (value, label, iconName) =>
    el(
      "button",
      {
        type: "button",
        class: `inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition ${
          kind === value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`,
        onclick: () => kind !== value && onChange(value),
      },
      [icon(iconName, "h-3.5 w-3.5"), label],
    );
  const toggle = el("div", { class: "inline-flex rounded-md bg-slate-100 p-0.5" }, [
    button("operation", "Operación", "workflow"),
    button("condition", "Condición", "fork"),
  ]);
  // Micro-ayuda: recuerda qué es cada tipo, justo donde se elige.
  const hint = el(
    "p",
    { class: "mt-1 text-[11px] text-slate-400" },
    kind === "condition" ? "Comprueba algo: una pregunta de Sí / No." : "Calcula o transforma datos para obtener uno nuevo.",
  );
  return el("div", {}, [toggle, hint]);
}

// Campo de nombre de una condición. Aplica la convención de nombres al desenfocar;
// el placeholder muestra la etiqueta genérica que recibiría si se deja vacío.
function conditionNameField(row, field, handlers) {
  const input = el("input", {
    type: "text",
    value: row.conditionName ?? "",
    placeholder: handlers.conditionPlaceholder ? handlers.conditionPlaceholder(row.id) : "C1",
    class: CONTROL_CLASS,
    dataset: { focusKey: `cond-name:${row.id}` },
    oninput: (event) => field(() => ({ conditionName: event.target.value })),
    onblur: (event) => normalizeFieldOnBlur(event, handlers.formatName, (name) => field(() => ({ conditionName: name }))),
  });
  return input;
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

// Re-renderiza preservando el control enfocado, la posición del cursor y el scroll,
// para que al crear un dato o agregarlo a una expresión se refresque la vista sin
// interrumpir la escritura ni saltar a otra actividad. Conserva el scroll de la
// ventana y el de los contenedores marcados con `data-scroll-key` (p. ej. la tira
// horizontal de tarjetas), que al recrearse volverían a su inicio. `render`
// re-dibuja dentro de `container`.
export function renderPreservingFocus(container, render) {
  const active = document.activeElement;
  const focusKey = active?.dataset?.focusKey;
  const start = active?.selectionStart ?? null;
  const end = active?.selectionEnd ?? null;

  const pageX = window.scrollX;
  const pageY = window.scrollY;
  const scrolls = new Map();
  container.querySelectorAll("[data-scroll-key]").forEach((node) => {
    scrolls.set(node.dataset.scrollKey, { left: node.scrollLeft, top: node.scrollTop });
  });

  render();

  container.querySelectorAll("[data-scroll-key]").forEach((node) => {
    const saved = scrolls.get(node.dataset.scrollKey);
    if (saved) {
      node.scrollLeft = saved.left;
      node.scrollTop = saved.top;
    }
  });

  if (focusKey) {
    const restored = container.querySelector(`[data-focus-key="${focusKey}"]`);
    if (restored) {
      // preventScroll: el scroll ya se restauró; que el foco no lo vuelva a mover.
      restored.focus({ preventScroll: true });
      if (start != null && typeof restored.setSelectionRange === "function") {
        try {
          restored.setSelectionRange(start, end);
        } catch {
          // Algunos tipos de input no admiten setSelectionRange; el foco basta.
        }
      }
    }
  }

  window.scrollTo(pageX, pageY);
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
  const button = (kind, label, iconName) =>
    el(
      "button",
      {
        type: "button",
        class: "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50",
        onclick: () => onAddRow(kind),
      },
      [icon(iconName, "h-4 w-4"), label],
    );
  return el("div", { class: "mt-3 flex flex-wrap gap-2" }, [
    button("operation", "Agregar operación", "workflow"),
    button("condition", "Agregar condición", "fork"),
  ]);
}

// --- Constructores de controles ---

// Reformatea un campo al desenfocar aplicando `transform`, y persiste el resultado
// si cambió. Se usa para normalizar la presentación (capitalización, pregunta) y
// para aplicar la convención de nombres, sin interrumpir mientras se escribe.
export function normalizeFieldOnBlur(event, transform, persist) {
  if (typeof transform !== "function") return;
  const formatted = transform(event.target.value);
  if (formatted !== event.target.value) {
    event.target.value = formatted;
    persist(formatted);
  }
}

// `normalize` corrige la forma del texto al desenfocar (no mientras se escribe,
// para no interrumpir). `mentions` activa el menú de datos al escribir "/".
function textField(value, placeholder, onInput, { normalize, mentions } = {}) {
  const field = el("textarea", {
    rows: 2,
    value: value ?? "",
    placeholder,
    class: `${CONTROL_CLASS} resize-y`,
    oninput: (event) => onInput(event.target.value),
    onblur: normalize ? (event) => normalizeFieldOnBlur(event, normalize, onInput) : null,
  });
  if (mentions) attachMentions(field, mentions);
  return field;
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
// se agregan, borran y reordenan. Los datos vienen de selects propios (entrada /
// resultado / condición) y seleccionar uno lo incorpora directamente; los valores
// constantes, de un campo aparte; los operadores, de botones agrupados por tipo.
// `focusKey` conserva el foco del campo de valor al re-renderizar (encadenar).
// `ctx` = { inputRefs, resultRefs, resolve, producedIds, conditions }.
export function expressionEditor(tokens, onChange, focusKey = "expr", ctx = {}) {
  const { inputRefs = [], resultRefs = [], resolve = () => null, producedIds = new Set(), conditions = null, inputHint = null } = ctx;
  const conditionEntries = conditions?.entries ?? [];
  const resolveCondition = conditions?.resolve ?? null;
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
    operationTokenChip(token, resolve, producedIds, resolveCondition, {
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

  // Selects de datos: seleccionar uno lo incorpora directamente como referencia.
  // `items` = [{id, label}]; al elegir, se agrega y el select vuelve al placeholder
  // (el re-render lo restablece). Se omite el select si no hay opciones.
  const refSelect = (placeholder, items, makeToken) => {
    const named = items.filter((entry) => (entry.label ?? "").trim());
    if (named.length === 0) return null;
    const select = selectField(
      named.map((entry) => ({ value: entry.id, label: entry.label })),
      "",
      (id) => id && append(makeToken(id)),
      { placeholder },
    );
    select.classList.add("text-xs");
    return select;
  };
  const inputSelect = refSelect("Dato de entrada…", inputRefs.map((e) => ({ id: e.id, label: e.name })), (id) => ({ kind: "ref", dataId: id }));
  const resultSelect = refSelect("Dato resultante…", resultRefs.map((e) => ({ id: e.id, label: e.name })), (id) => ({ kind: "ref", dataId: id }));
  const conditionSelect = refSelect("Condición…", conditionEntries, (id) => ({ kind: "cond", condId: id }));
  // Sin datos de entrada disponibles, en lugar del selector se muestra la pista.
  const inputControl = inputSelect ?? (inputHint ? el("span", { class: "inline-flex items-center rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs italic text-slate-400" }, inputHint) : null);

  // Campo independiente para agregar un valor constante (literal).
  const addValue = () => {
    const value = valueInput.value.trim();
    if (!value) return;
    valueInput.value = "";
    append({ kind: "literal", value });
  };
  const valueInput = el("input", {
    type: "text",
    placeholder: "valor",
    autocomplete: "off",
    class: `${CONTROL_CLASS} w-24 text-xs`,
    dataset: { focusKey: `expr:${focusKey}` },
    onkeydown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addValue();
      } else if (event.key === "Backspace" && valueInput.value === "" && tokens.length > 0) {
        event.preventDefault();
        removeLast();
      }
    },
  });
  const valueButton = el(
    "button",
    {
      type: "button",
      class: "shrink-0 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-700",
      title: "Agregar valor",
      onmousedown: (event) => event.preventDefault(),
      onclick: addValue,
    },
    "+ valor",
  );

  const dataControls = [inputControl, resultSelect, conditionSelect].filter(Boolean);
  const operatorGroups = Object.values(OPERATOR_GROUPS).map((group) => operatorGroup(group, (key) => append({ kind: "op", op: key })));

  return el("div", { class: "min-w-0 space-y-2" }, [
    tokens.length > 0 ? el("div", { class: "flex flex-wrap items-center gap-1" }, chips) : null,
    el("div", { class: "flex flex-wrap items-center gap-2" }, [
      ...dataControls,
      el("div", { class: "flex items-center gap-1" }, [valueInput, valueButton]),
    ]),
    el("div", { class: "flex flex-wrap items-start gap-2" }, operatorGroups),
  ]);
}

// Un grupo de operadores (aritméticos, relacionales…) como caja rotulada con
// botones amplios, para que sean claros y fáciles de pulsar.
function operatorGroup(group, onPick) {
  return el("div", { class: "flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50/70 px-1.5 py-1" }, [
    el("span", { class: "text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400" }, group.label),
    el(
      "div",
      { class: "flex flex-wrap gap-1" },
      Object.entries(group.operators).map(([key, symbol]) =>
        el(
          "button",
          {
            type: "button",
            title: `${group.label}: ${symbol}`,
            dataset: { op: key },
            class: "min-w-[2rem] rounded border border-slate-200 bg-white px-2 py-1 text-sm font-mono font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700",
            onmousedown: (event) => event.preventDefault(),
            onclick: () => onPick(key),
          },
          symbol,
        ),
      ),
    ),
  ]);
}

function operationTokenChip(token, resolve, producedIds, resolveCondition, { onRemove, draggable, onDragStart, onDrop }) {
  const { leading, text, className, extra = "" } = describeToken(token, resolve, producedIds, resolveCondition);
  const cursor = draggable ? "cursor-move" : "";
  return el(
    "span",
    {
      class: `inline-flex max-w-full min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs ${extra} ${cursor} ${className}`,
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
      // break-words: un valor largo se ajusta dentro de la tarjeta en vez de desbordar.
      el("span", { class: "min-w-0 break-words" }, text),
      el("button", { type: "button", class: "text-slate-400 hover:text-red-600", title: "Quitar", onclick: onRemove }, "×"),
    ],
  );
}

// Describe una ficha por tipo. Cada tipo se distingue por FORMA además del color:
// dato de entrada = icono de datos (azul); resultado producido por otra actividad
// = icono de reutilización (violeta); condición = icono de bifurcación (índigo);
// operador = símbolo monoespaciado en negrita; valor = «#» (ámbar).
function describeToken(token, resolve, producedIds = new Set(), resolveCondition = null) {
  if (token.kind === "cond") {
    const condition = resolveCondition ? resolveCondition(token.condId) : null;
    return {
      leading: icon("fork", "h-3 w-3 shrink-0 text-indigo-500"),
      text: condition ? condition.label : "(condición eliminada)",
      className: "border border-indigo-200 bg-indigo-50 text-indigo-700",
      extra: "font-semibold",
    };
  }
  if (token.kind === "ref") {
    const datum = resolve(token.dataId);
    const text = datum ? datum.name || "(sin nombre)" : "(dato eliminado)";
    if (producedIds.has(token.dataId)) {
      return {
        leading: icon("reuse", "h-3 w-3 shrink-0 text-violet-500"),
        text,
        className: "border border-violet-200 bg-violet-50 text-violet-700",
      };
    }
    return {
      leading: icon("data", "h-3 w-3 shrink-0 text-sky-500"),
      text,
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
      // Al desenfocar, el nombre del dato resultante adopta la convención vigente.
      onblur: (event) => normalizeFieldOnBlur(event, handlers.formatName, (name) => handlers.onResultChange(rowId, { name })),
    }),
    typeSelect,
  ]);
}

// Selector de propósito del dato resultante (qué le ocurrirá después): nueva
// operación, tomar una decisión o generar la información final.
function purposeSelect(purpose, onChange) {
  return selectField(optionsOf(PURPOSES), purpose, onChange, { placeholder: "Propósito…" });
}

// Interruptor de una condición: ¿evaluarla ahora (produce un dato lógico) o
// dejarla reutilizable para más adelante? Cambia los campos que muestra la tarjeta.
function evaluateToggle(checked, onChange) {
  const box = el("input", { type: "checkbox", class: "h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-200" });
  box.checked = Boolean(checked);
  box.onchange = (event) => onChange(event.target.checked);
  const label = el("label", { class: "inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800" }, [
    box,
    el("span", {}, "Evaluarla ahora (produce un dato lógico)"),
  ]);
  const hint = el(
    "p",
    { class: "mt-0.5 text-[11px] text-slate-400" },
    checked ? "Produce un dato lógico; elige su propósito abajo." : "Sin evaluar: queda reutilizable para combinarla con otras condiciones.",
  );
  return el("div", {}, [label, hint]);
}

// Dato resultante de una condición evaluada: solo el nombre; el tipo es lógico
// automáticamente (se muestra como distintivo, no editable).
function logicalResultEditor(rowId, result, handlers) {
  return el("div", { class: "flex items-center gap-2" }, [
    el("input", {
      type: "text",
      value: result?.name ?? "",
      placeholder: "nombre del dato lógico",
      class: `${CONTROL_CLASS} flex-1`,
      dataset: { focusKey: `res-name:${rowId}` },
      oninput: (event) => handlers.onResultChange(rowId, { name: event.target.value, type: "logical" }),
      onblur: (event) => normalizeFieldOnBlur(event, handlers.formatName, (name) => handlers.onResultChange(rowId, { name, type: "logical" })),
    }),
    typeBadge("logical"),
  ]);
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
function branchEditor(branch, key, { structural, rowId, exprCtx }) {
  const children = [
    selectField(optionsOf(BRANCH_TYPES), branch.type, (value) => structural((row) => ({ [key]: { ...row[key], type: value } })), {
      placeholder: "Continúa con…",
    }),
  ];
  if (branch.type === "response") {
    children.push(
      expressionEditor(
        branch.value,
        (updater) => structural((row) => ({ [key]: { ...row[key], value: updater(row[key].value) } })),
        `br:${rowId}:${key}`,
        exprCtx,
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
