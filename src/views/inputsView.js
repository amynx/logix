// Vista de la sección "Datos de entrada": declara una vez los datos que recibe
// el programa (nombre y tipo). Las filas de la tabla solo los referencian.
// Solo se ocupa del DOM; recibe callbacks y notifica los cambios del usuario.

import { el, clear } from "../utils/dom.js";
import { DATA_TYPES, optionsOf } from "../models/dataTypes.js";
import { sectionHeader, emptyState } from "./sectionHeader.js";
import { helpButton } from "./helpView.js";

const CONTROL_CLASS =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

const ADD_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

export class InputsView {
  constructor({ container }) {
    this.container = container;
  }

  render(inputs, handlers) {
    clear(this.container);

    const list =
      inputs.length > 0
        ? el("div", { class: "space-y-2" }, inputs.map((entry) => inputRow(entry, handlers)))
        : emptyState("data", "Aún no hay datos de entrada. Agrégalos aquí para usarlos en las actividades.");

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({
          step: 3,
          title: "Datos de entrada",
          subtitle: "Datos que el programa recibe. En las actividades solo se reutilizan estos.",
          iconName: "data",
          help: helpButton(1), // pestaña "Datos y operaciones" (cómo nombrar los datos)
        }),
        list,
        el("div", { class: "mt-3" }, [
          el("button", { type: "button", class: ADD_BUTTON_CLASS, onclick: () => handlers.onAddInput() }, "+ Agregar dato"),
        ]),
      ]),
    );
  }
}

function inputRow(entry, handlers) {
  return el("div", { class: "flex items-center gap-2" }, [
    el("input", {
      type: "text",
      value: entry.name ?? "",
      placeholder: "nombre",
      class: `${CONTROL_CLASS} w-48`,
      oninput: (event) => handlers.onInputChange(entry.id, { name: event.target.value }),
    }),
    typeSelect(entry, handlers),
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
  ]);
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
