// Vista de tarjetas: cada actividad es una card vertical con su información de
// arriba hacia abajo, encadenadas en el orden de ejecución. Comparte con la tabla
// los mismos constructores de campos (rowEditor), así que ofrece las mismas
// funciones (editar, reordenar por arrastre, agregar y eliminar) sobre el mismo
// análisis. Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import {
  FIELD_ORDER,
  buildRowFields,
  renderPreservingFocus,
  viewToggle,
  dragHandle,
  deleteButton,
  addActivityButton,
} from "./rowEditor.js";

export class CardsView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, handlers, viewMode) {
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    const cards = analysis.rows.map((row, index) => this.#card(row, index, dataById, handlers));

    this.container.append(
      el("div", { class: "mb-3" }, [viewToggle(viewMode, handlers.onSetViewMode)]),
      el("div", { class: "mx-auto max-w-2xl" }, [
        cards.length > 0
          ? el("div", {}, chained(cards))
          : el("p", { class: "text-sm text-slate-400" }, "Aún no hay actividades."),
        addActivityButton(handlers.onAddRow),
      ]),
    );
  }

  renderKeepingFocus(analysis, handlers, viewMode) {
    renderPreservingFocus(this.container, () => this.render(analysis, handlers, viewMode));
  }

  #card(row, index, dataById, handlers) {
    const fields = buildRowFields(row, dataById, handlers);
    const setDragged = (id) => {
      this.draggedRowId = id;
    };

    const sections = FIELD_ORDER.filter((column) => fields[column.key]).map((column) =>
      el("div", {}, [
        el("div", { class: "text-xs font-medium text-slate-500" }, column.label),
        el("div", { class: "mt-1" }, [fields[column.key]]),
      ]),
    );

    return el(
      "div",
      {
        class: "rounded-lg border border-slate-200 bg-white p-4 shadow-sm",
        dataset: { rowId: row.id },
        ondragover: (event) => event.preventDefault(),
        ondrop: (event) => {
          event.preventDefault();
          const fromId = this.draggedRowId;
          this.draggedRowId = null;
          if (fromId && fromId !== row.id) handlers.onMoveRow(fromId, row.id);
        },
      },
      [
        el("div", { class: "flex items-center gap-2 border-b border-slate-100 pb-2" }, [
          dragHandle(row.id, setDragged),
          el("span", { class: "text-sm font-semibold text-slate-600" }, `Actividad ${index + 1}`),
          el("div", { class: "ml-auto" }, [deleteButton(() => handlers.onDeleteRow(row.id))]),
        ]),
        el("div", { class: "mt-3 space-y-3" }, sections),
      ],
    );
  }
}

// Encadena las tarjetas con un conector visual entre pasos consecutivos.
function chained(cards) {
  const nodes = [];
  cards.forEach((card, index) => {
    if (index > 0) nodes.push(connector());
    nodes.push(card);
  });
  return nodes;
}

function connector() {
  return el("div", { class: "flex justify-center py-1 text-lg leading-none text-slate-300" }, "↓");
}
