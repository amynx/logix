// Vista de la sección "Datos de entrada": declara una vez los datos que recibe el
// programa. Se presentan como una tabla alineada con columnas descriptivas
// (Dato identificado · Valor · Tipo · Nombre). Tiene dos modos: edición (con
// controles) y visualización (solo lectura), para que la sección quede limpia al
// terminar. Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import { DATA_TYPES, optionsOf } from "../models/dataTypes.js";
import { NAME_CONVENTIONS } from "../models/nameConventions.js";
import { normalizeFieldOnBlur } from "./rowEditor.js";
import { sectionHeader, emptyState } from "./sectionHeader.js";
import { helpButton } from "./helpView.js";
import { typeBadge } from "./badges.js";
import { icon } from "./icons.js";

const CONTROL_CLASS =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

const GHOST_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700";

const TH_CLASS = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-left align-top";
const TD_CLASS = "border-b border-slate-100 px-3 py-2 align-top";

// Columnas de la tabla: nombre + una nota de qué va en cada una.
const IDENTIFIED_COLUMN = { label: "Dato identificado", help: "Fragmento del enunciado", width: "min-w-[14rem]" };
const VALUE_COLUMN = { label: "Valor", help: "Opcional (si el ejercicio lo indica)", width: "min-w-[8rem]" };
const TYPE_COLUMN = { label: "Tipo", help: "Numérico, Lógico o Texto", width: "min-w-[9rem]" };
const NAME_COLUMN = { label: "Nombre", help: "Nombre en el algoritmo", width: "min-w-[12rem]" };

// La estructura se adapta al modo de trabajo: con enunciado se muestra el fragmento
// identificado; sin enunciado (entrada manual) se omite y el nombre va al frente.
function columnsFor(usingStatement) {
  return usingStatement
    ? [IDENTIFIED_COLUMN, VALUE_COLUMN, TYPE_COLUMN, NAME_COLUMN]
    : [NAME_COLUMN, TYPE_COLUMN, VALUE_COLUMN];
}

export class InputsView {
  constructor({ container }) {
    this.container = container;
  }

  render(inputs, editing, handlers, usingStatement = false, nameConvention = "") {
    clear(this.container);

    const addButton = el("button", { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onAddInput() }, "+ Agregar dato");

    let body;
    let actions;
    if (inputs.length === 0 && !editing) {
      body = emptyState("data", "Aún no hay datos de entrada. Agrégalos aquí para usarlos en las actividades.");
      actions = [addButton];
    } else if (editing) {
      body =
        inputs.length > 0
          ? inputsTable(inputs, true, handlers, usingStatement)
          : el("p", { class: "text-sm text-slate-400" }, "Agrega el primer dato de entrada.");
      const done = el("button", { type: "button", class: PRIMARY_BUTTON_CLASS, onclick: () => handlers.onDoneInputs() }, [icon("check", "h-4 w-4"), "Listo"]);
      actions = inputs.length > 0 ? [addButton, conventionSelect(nameConvention, handlers.onSetNameConvention), done] : [addButton, done];
    } else {
      body = inputsTable(inputs, false, handlers, usingStatement);
      actions = [el("button", { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onEditInputs() }, [icon("edit", "h-4 w-4"), "Editar datos"])];
    }

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({
          step: 3,
          title: "Datos de entrada",
          subtitle: "Datos que el programa recibe. En las actividades solo se reutilizan estos.",
          iconName: "data",
          help: helpButton(1), // pestaña "Datos y operaciones" (cómo nombrar los datos)
        }),
        body,
        el("div", { class: "mt-3 flex flex-wrap gap-2" }, actions),
      ]),
    );
  }
}

// Tabla de datos de entrada; en edición las celdas tienen controles, en
// visualización muestran el valor de solo lectura.
function inputsTable(inputs, editing, handlers, usingStatement) {
  const columns = columnsFor(usingStatement);
  const headCells = columns.map((column) =>
    el("th", { class: `${TH_CLASS} ${column.width}`, scope: "col" }, [
      el("div", { class: "font-semibold text-slate-700" }, column.label),
      el("div", { class: "mt-0.5 text-xs font-normal text-slate-400" }, column.help),
    ]),
  );
  if (editing) headCells.push(el("th", { class: `${TH_CLASS} w-10` }, el("span", { class: "sr-only" }, "Acciones")));

  const rows = inputs.map((entry) => (editing ? editRow(entry, handlers, usingStatement) : viewRow(entry, usingStatement)));

  return el("div", { class: "overflow-x-auto rounded-lg border border-slate-200" }, [
    el("table", { class: "w-full border-collapse text-sm" }, [
      el("thead", {}, [el("tr", {}, headCells)]),
      el("tbody", {}, rows),
    ]),
  ]);
}

function editRow(entry, handlers, usingStatement) {
  const change = (changes) => handlers.onInputChange(entry.id, changes);
  const nameCell = el("td", { class: TD_CLASS }, [textField("nombre", entry.name, (value) => change({ name: value }), { normalize: handlers.formatName })]);
  const typeCell = el("td", { class: TD_CLASS }, [typeSelect(entry, handlers)]);
  const valueCell = el("td", { class: TD_CLASS }, [textField("opcional", entry.value, (value) => change({ value }))]);
  const cells = usingStatement
    ? [el("td", { class: TD_CLASS }, [sourceCell(entry.source)]), valueCell, typeCell, nameCell]
    : [nameCell, typeCell, valueCell];
  cells.push(
    el("td", { class: `${TD_CLASS} text-center` }, [
      el(
        "button",
        {
          type: "button",
          class: "rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600",
          title: "Eliminar dato de entrada",
          "aria-label": "Eliminar dato de entrada",
          onclick: () => handlers.onRemoveInput(entry.id),
        },
        "🗑",
      ),
    ]),
  );
  return el("tr", { class: "align-top" }, cells);
}

function viewRow(entry, usingStatement) {
  const nameCell = el("td", { class: TD_CLASS }, entry.name ? el("span", { class: "font-medium text-slate-700" }, entry.name) : dash());
  const typeCell = el("td", { class: TD_CLASS }, entry.type ? typeBadge(entry.type) : dash());
  const valueCell = el("td", { class: TD_CLASS }, entry.value ? el("span", { class: "text-slate-700" }, entry.value) : dash());
  const cells = usingStatement
    ? [el("td", { class: TD_CLASS }, [sourceCell(entry.source)]), valueCell, typeCell, nameCell]
    : [nameCell, typeCell, valueCell];
  return el("tr", {}, cells);
}

// Celda "Dato identificado": el fragmento del enunciado, completo. "—" si no lo hay.
function sourceCell(source) {
  const text = (source ?? "").trim();
  if (!text) return dash();
  return el("span", { class: "inline-flex items-start gap-1.5 text-slate-600", title: "Fragmento del enunciado" }, [
    icon("data", "h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400"),
    el("span", {}, text),
  ]);
}

function dash() {
  return el("span", { class: "text-slate-300" }, "—");
}

// `normalize` reformatea el campo al desenfocar (p. ej. la convención de nombres),
// sin interrumpir mientras se escribe.
function textField(placeholder, value, onInput, { normalize } = {}) {
  return el("input", {
    type: "text",
    value: value ?? "",
    placeholder,
    class: `${CONTROL_CLASS} w-full`,
    oninput: (event) => onInput(event.target.value),
    onblur: normalize ? (event) => normalizeFieldOnBlur(event, normalize, onInput) : null,
  });
}

function typeSelect(entry, handlers) {
  const options = [el("option", { value: "" }, "Tipo…")];
  for (const option of optionsOf(DATA_TYPES)) {
    options.push(el("option", { value: option.value }, option.label));
  }
  const select = el(
    "select",
    {
      class: `${CONTROL_CLASS} w-full`,
      onchange: (event) => handlers.onInputChange(entry.id, { type: event.target.value }),
    },
    options,
  );
  select.value = entry.type ?? "";
  return select;
}

// Selector de la convención de nombres del análisis. Es una regla persistente: al
// elegirla se aplica a todos los datos y se mantiene para los nuevos nombres.
function conventionSelect(nameConvention, onSetNameConvention) {
  const select = el(
    "select",
    {
      class: `${CONTROL_CLASS} text-sm`,
      title: "Convención de nombres del análisis (se aplica a entradas y resultados)",
      onchange: (event) => onSetNameConvention(event.target.value),
    },
    [el("option", { value: "" }, "Convención: ninguna"), ...Object.entries(NAME_CONVENTIONS).map(([key, label]) => el("option", { value: key }, label))],
  );
  select.value = nameConvention ?? "";
  return select;
}
