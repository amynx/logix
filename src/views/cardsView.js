// Vista de tarjetas: cada actividad es una card con su información de arriba hacia
// abajo, y las cards se encadenan HORIZONTALMENTE en el orden de ejecución. Cada
// card tiene dos estados: visualización (solo la información registrada, compacta)
// y edición (los campos y controles, más ancha para operaciones largas). Comparte
// con la tabla los mismos constructores de campos (rowEditor) y el mismo resumen
// de solo lectura (rowSummary). Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import {
  FIELD_ORDER,
  buildRowFields,
  renderPreservingFocus,
  viewToggle,
  dragHandle,
  deleteButton,
  editButton,
  doneButton,
  addActivityButton,
  buildActivityList,
} from "./rowEditor.js";
import { buildRowSummary, isSummaryEmpty } from "./rowSummary.js";
import { sectionHeader } from "./sectionHeader.js";

const VIEW_WIDTH = "w-80"; // ~20rem: lectura compacta
const EDIT_WIDTH = "w-[46rem]"; // ~46rem: espacio para operaciones largas

export class CardsView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, handlers, viewMode) {
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    const activities = buildActivityList(analysis.rows, dataById);
    const cards = analysis.rows.map((row, index) => this.#card(row, index, dataById, handlers, activities));

    this.container.append(
      sectionHeader({
        step: 3,
        title: "Actividades",
        subtitle: "Cada paso del análisis. Puedes cambiar de vista o de orden.",
        iconName: "activities",
        trailing: viewToggle(viewMode, handlers.onSetViewMode),
      }),
      cards.length > 0
        ? el("div", { class: "overflow-x-auto pb-2" }, [el("div", { class: "flex items-start" }, chained(cards))])
        : el("p", { class: "text-sm text-slate-400" }, "Aún no hay actividades."),
      addActivityButton(handlers.onAddRow),
    );
  }

  renderKeepingFocus(analysis, handlers, viewMode) {
    renderPreservingFocus(this.container, () => this.render(analysis, handlers, viewMode));
  }

  #card(row, index, dataById, handlers, activities) {
    const editing = handlers.isRowEditing(row.id);
    const body = editing ? this.#editBody(row, dataById, handlers, activities) : this.#viewBody(row, dataById, activities);
    const action = editing
      ? doneButton(() => handlers.onDoneRow(row.id))
      : editButton(() => handlers.onEditRow(row.id));
    const setDragged = (id) => {
      this.draggedRowId = id;
    };

    return el(
      "div",
      {
        class: `${editing ? EDIT_WIDTH : VIEW_WIDTH} shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm`,
        dataset: { rowId: row.id, editing: String(editing) },
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
          el("div", { class: "ml-auto flex items-center gap-1" }, [action, deleteButton(() => handlers.onDeleteRow(row.id))]),
        ]),
        el("div", { class: "mt-3" }, [body]),
      ],
    );
  }

  // Modo edición: todos los campos con sus controles.
  #editBody(row, dataById, handlers, activities) {
    const fields = buildRowFields(row, dataById, handlers, activities);
    const sections = FIELD_ORDER.filter((column) => fields[column.key]).map((column) =>
      labeledSection(column.label, fields[column.key]),
    );
    return el("div", { class: "space-y-3" }, sections);
  }

  // Modo visualización: solo los campos con información registrada.
  #viewBody(row, dataById, activities) {
    const summary = buildRowSummary(row, dataById, activities);
    if (isSummaryEmpty(summary)) {
      return el("p", { class: "text-sm text-slate-400" }, "Sin información. Pulsa «Editar» para completarla.");
    }
    const sections = FIELD_ORDER.filter((column) => summary[column.key]).map((column) =>
      labeledSection(column.label, summary[column.key]),
    );
    return el("div", { class: "space-y-2.5" }, sections);
  }
}

function labeledSection(label, node) {
  return el("div", {}, [
    el("div", { class: "text-xs font-medium text-slate-500" }, label),
    el("div", { class: "mt-1 text-sm" }, [node]),
  ]);
}

// Encadena las tarjetas con un conector horizontal entre pasos consecutivos.
function chained(cards) {
  const nodes = [];
  cards.forEach((card, index) => {
    if (index > 0) nodes.push(connector());
    nodes.push(card);
  });
  return nodes;
}

function connector() {
  return el("div", { class: "flex shrink-0 items-start px-2 pt-16 text-xl text-slate-300" }, "→");
}
