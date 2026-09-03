// Vista de la sección "Datos de entrada": declara una vez los datos que recibe
// el programa (nombre y tipo). Las filas de la tabla solo los referencian. Tiene
// dos modos: edición (campos y controles) y visualización (solo los datos, en
// fichas), para que la sección quede limpia al terminar. Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import { DATA_TYPES, optionsOf } from "../models/dataTypes.js";
import { NAME_CONVENTIONS } from "../models/nameConventions.js";
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

export class InputsView {
  constructor({ container }) {
    this.container = container;
  }

  render(inputs, editing, handlers) {
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
          ? el("div", { class: "space-y-2" }, inputs.map((entry) => inputRow(entry, handlers)))
          : el("p", { class: "text-sm text-slate-400" }, "Agrega el primer dato de entrada.");
      const done = el("button", { type: "button", class: PRIMARY_BUTTON_CLASS, onclick: () => handlers.onDoneInputs() }, [icon("check", "h-4 w-4"), "Listo"]);
      actions = inputs.length > 0 ? [addButton, formatSelect(handlers.onFormatNames), done] : [addButton, done];
    } else {
      // Modo visualización: solo los datos registrados, en fichas de solo lectura.
      body = el("div", { class: "flex flex-wrap gap-2" }, inputs.map(dataChip));
      actions = [
        el(
          "button",
          { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onEditInputs() },
          [icon("edit", "h-4 w-4"), "Editar datos"],
        ),
      ];
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

// Ficha de solo lectura de un dato: nombre + insignia de tipo.
function dataChip(entry) {
  return el("span", { class: "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700" }, [
    el("span", { class: "whitespace-nowrap" }, entry.name || "(sin nombre)"),
    typeBadge(entry.type),
  ]);
}

// Fila de un dato de entrada: el fragmento del enunciado (si lo hay) → valor, tipo
// y nombre. Deja explícita la transformación de un dato identificado a su nombre.
function inputRow(entry, handlers) {
  const change = (changes) => handlers.onInputChange(entry.id, changes);
  const fields = [];
  if ((entry.source ?? "").trim()) {
    fields.push(
      el("span", { class: "inline-flex max-w-[16rem] items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-600", title: "Fragmento del enunciado" }, [
        icon("data", "h-3.5 w-3.5 shrink-0 text-slate-400"),
        el("span", { class: "truncate" }, entry.source),
      ]),
    );
    fields.push(el("span", { class: "text-slate-300" }, "→"));
  }
  fields.push(textField("valor", entry.value, "w-24", (value) => change({ value })));
  fields.push(typeSelect(entry, handlers));
  fields.push(textField("nombre", entry.name, "w-56", (value) => change({ name: value })));
  fields.push(
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
  );
  return el("div", { class: "flex flex-wrap items-center gap-2" }, fields);
}

function textField(placeholder, value, widthClass, onInput) {
  return el("input", {
    type: "text",
    value: value ?? "",
    placeholder,
    class: `${CONTROL_CLASS} ${widthClass}`,
    oninput: (event) => onInput(event.target.value),
  });
}

// Selector para aplicar una convención de nombres a los datos (solo si se elige).
function formatSelect(onFormat) {
  const select = el(
    "select",
    {
      class: `${CONTROL_CLASS} text-sm`,
      title: "Aplicar una convención a los nombres de los datos",
      onchange: (event) => {
        if (event.target.value) {
          onFormat(event.target.value);
          event.target.value = "";
        }
      },
    },
    [el("option", { value: "" }, "Formatear nombres…"), ...Object.entries(NAME_CONVENTIONS).map(([key, label]) => el("option", { value: key }, label))],
  );
  select.value = "";
  return select;
}

function typeSelect(entry, handlers) {
  const options = [el("option", { value: "" }, "Tipo…")];
  for (const option of optionsOf(DATA_TYPES)) {
    options.push(el("option", { value: option.value }, option.label));
  }
  const select = el(
    "select",
    {
      class: `${CONTROL_CLASS} w-36`,
      onchange: (event) => handlers.onInputChange(entry.id, { type: event.target.value }),
    },
    options,
  );
  select.value = entry.type ?? "";
  return select;
}
