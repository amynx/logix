// Vista de tarjetas: cada actividad es una card con su información de arriba hacia
// abajo, y las cards se encadenan HORIZONTALMENTE en el orden de ejecución. Cada
// card tiene dos estados: visualización (solo la información registrada, compacta)
// y edición (los campos y controles, más ancha para operaciones largas). Comparte
// con la tabla los mismos constructores de campos (rowEditor) y el mismo resumen
// de solo lectura (rowSummary). Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import {
  buildRowFields,
  renderPreservingFocus,
  viewToggle,
  dragHandle,
  deleteButton,
  editButton,
  doneButton,
  addActivityButton,
  buildActivityList,
  markDropTarget,
  clearDropTarget,
} from "./rowEditor.js";
import { buildRowSummary, isSummaryEmpty } from "./rowSummary.js";
import { activityZones, stepNumber, inlineRow, stackedRow } from "./cardLayout.js";
import { sectionHeader } from "./sectionHeader.js";
import { helpButton } from "./helpView.js";

// Ancho acotado a la pantalla (`max-w`) para que una tarjeta nunca sea más ancha
// que el viewport: en móvil la tarjeta encoge y la expresión se ajusta dentro.
const VIEW_WIDTH = "w-80 max-w-[calc(100vw-2rem)]"; // ~20rem: lectura compacta
const EDIT_WIDTH = "w-[46rem] max-w-[calc(100vw-2rem)]"; // ~46rem: espacio para operaciones largas

export class CardsView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, handlers, viewMode) {
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    const activities = buildActivityList(analysis.rows, dataById);
    const producedIds = new Set(analysis.rows.map((row) => row.resultId).filter(Boolean));
    const cards = analysis.rows.map((row, index) => this.#card(row, index, dataById, handlers, activities, producedIds));

    this.container.append(
      sectionHeader({
        step: 4,
        title: "Actividades",
        subtitle: "Cada paso del análisis. Puedes cambiar de vista o de orden.",
        iconName: "activities",
        help: helpButton(2), // pestaña "Condiciones y expresiones"
        trailing: viewToggle(viewMode, handlers.onSetViewMode),
      }),
      cards.length > 0
        ? el("div", { class: "overflow-x-auto pb-2", dataset: { scrollKey: "cards" } }, [el("div", { class: "flex items-start" }, chained(cards))])
        : el("p", { class: "text-sm text-slate-400" }, "Aún no hay actividades."),
      addActivityButton(handlers.onAddRow),
    );
  }

  renderKeepingFocus(analysis, handlers, viewMode) {
    renderPreservingFocus(this.container, () => this.render(analysis, handlers, viewMode));
  }

  #card(row, index, dataById, handlers, activities, producedIds) {
    const editing = handlers.isRowEditing(row.id);
    const body = editing ? this.#editBody(row, dataById, handlers, activities, producedIds) : this.#viewBody(row, dataById, activities, producedIds);
    const action = editing
      ? doneButton(() => handlers.onDoneRow(row.id))
      : editButton(() => handlers.onEditRow(row.id));
    const setDragged = (id) => {
      this.draggedRowId = id;
    };

    return el(
      "div",
      {
        class: `${editing ? EDIT_WIDTH : VIEW_WIDTH} shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition`,
        dataset: { rowId: row.id, editing: String(editing) },
        ondragover: (event) => {
          event.preventDefault();
          if (this.draggedRowId && this.draggedRowId !== row.id) markDropTarget(event.currentTarget);
        },
        ondragleave: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) clearDropTarget(event.currentTarget);
        },
        ondrop: (event) => {
          event.preventDefault();
          clearDropTarget(event.currentTarget);
          const fromId = this.draggedRowId;
          this.draggedRowId = null;
          if (fromId && fromId !== row.id) handlers.onMoveRow(fromId, row.id);
        },
      },
      [
        el("div", { class: "flex items-center gap-2 border-b border-slate-100 pb-2.5" }, [
          dragHandle(row.id, setDragged),
          stepNumber(index + 1),
          el("span", { class: "text-sm font-semibold text-slate-700" }, "Actividad"),
          el("div", { class: "ml-auto flex items-center gap-1" }, [action, deleteButton(() => handlers.onDeleteRow(row.id))]),
        ]),
        el("div", { class: "mt-3" }, [body]),
      ],
    );
  }

  // Modo edición: todos los campos con sus controles, agrupados por zona.
  #editBody(row, dataById, handlers, activities, producedIds) {
    const fields = buildRowFields(row, dataById, handlers, activities, producedIds);
    return el("div", { class: "space-y-3.5" }, activityZones(fields, stackedRow));
  }

  // Modo visualización: solo la información registrada, agrupada por zona.
  #viewBody(row, dataById, activities, producedIds) {
    const summary = buildRowSummary(row, dataById, activities, producedIds);
    if (isSummaryEmpty(summary)) {
      return el("p", { class: "text-sm text-slate-400" }, "Sin información. Pulsa «Editar» para completarla.");
    }
    return el("div", { class: "space-y-3" }, activityZones(summary, inlineRow));
  }
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
