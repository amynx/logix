// Vista de la sección "Condiciones": el estudiante descubre comprobaciones lógicas
// reutilizables (C1, C2…), cada una construida con el mismo editor de expresiones
// que las operaciones (referenciando datos). Luego se componen en las actividades.
// Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import { expressionEditor, renderPreservingFocus } from "./rowEditor.js";
import { sectionHeader, emptyState } from "./sectionHeader.js";
import { helpButton } from "./helpView.js";
import { icon } from "./icons.js";

const GHOST_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

export class ConditionsView {
  constructor({ container }) {
    this.container = container;
  }

  // `data` = { refs, resolve, producedIds } para el editor de expresiones.
  render(conditions, data, handlers) {
    clear(this.container);

    const addButton = el(
      "button",
      { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onAddCondition() },
      "+ Agregar condición",
    );

    const body =
      conditions.length > 0
        ? el("div", { class: "space-y-2" }, conditions.map((condition, index) => conditionRow(condition, index, data, handlers)))
        : emptyState("fork", "Aún no hay condiciones. Registra aquí las comprobaciones que necesitas y luego combínalas en las actividades.");

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({
          step: 4,
          title: "Condiciones",
          subtitle: "Comprobaciones lógicas reutilizables. Descúbrelas aquí y combínalas en las actividades.",
          iconName: "fork",
          help: helpButton(2), // pestaña "Condiciones y expresiones"
        }),
        body,
        el("div", { class: "mt-3" }, [addButton]),
      ]),
    );
  }

  renderKeepingFocus(conditions, data, handlers) {
    renderPreservingFocus(this.container, () => this.render(conditions, data, handlers));
  }
}

// Una condición: su etiqueta (C1…), el editor de su expresión y el botón de quitar.
function conditionRow(condition, index, data, handlers) {
  const label = el(
    "span",
    { class: "mt-1 inline-flex h-6 shrink-0 items-center rounded-md bg-indigo-100 px-2 text-xs font-semibold text-indigo-700" },
    `C${index + 1}`,
  );

  const editor = expressionEditor(
    condition.tokens,
    data.refs,
    data.resolve,
    (updater) => handlers.onUpdateCondition(condition.id, updater),
    `cond:${condition.id}`,
    data.producedIds,
  );

  const remove = el(
    "button",
    {
      type: "button",
      class: "mt-0.5 shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600",
      title: "Eliminar condición",
      "aria-label": "Eliminar condición",
      onclick: () => handlers.onRemoveCondition(condition.id),
    },
    "🗑",
  );

  return el("div", { class: "flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5" }, [
    label,
    el("div", { class: "min-w-0 flex-1" }, [editor]),
    remove,
  ]);
}
