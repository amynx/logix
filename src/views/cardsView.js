// Vista de tarjetas: cada actividad es una card con su información de arriba hacia
// abajo, y las cards se encadenan HORIZONTALMENTE en el orden de ejecución. Cada
// card puede expandirse (más ancha, para leer operaciones largas) o encogerse.
// Comparte con la tabla los mismos constructores de campos (rowEditor), así que
// ofrece las mismas funciones sobre el mismo análisis. Solo se ocupa del DOM.

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
import { sectionHeader } from "./sectionHeader.js";

const COLLAPSED_WIDTH = "w-80"; // ~20rem
const EXPANDED_WIDTH = "w-[46rem]"; // ~46rem, para operaciones largas

export class CardsView {
  constructor({ container }) {
    this.container = container;
    this.expanded = new Set(); // ids de actividades expandidas (estado de vista)
  }

  render(analysis, handlers, viewMode) {
    this.context = { analysis, handlers, viewMode };
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    const cards = analysis.rows.map((row, index) => this.#card(row, index, dataById, handlers));

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

  // Expandir/encoger es estado de la vista: se re-renderiza con el contexto actual.
  #toggleExpand(rowId) {
    if (this.expanded.has(rowId)) this.expanded.delete(rowId);
    else this.expanded.add(rowId);
    const { analysis, handlers, viewMode } = this.context;
    this.render(analysis, handlers, viewMode);
  }

  #card(row, index, dataById, handlers) {
    const fields = buildRowFields(row, dataById, handlers);
    const isExpanded = this.expanded.has(row.id);
    const setDragged = (id) => {
      this.draggedRowId = id;
    };

    const sections = FIELD_ORDER.filter((column) => fields[column.key]).map((column) =>
      el("div", {}, [
        el("div", { class: "text-xs font-medium text-slate-500" }, column.label),
        el("div", { class: "mt-1" }, [fields[column.key]]),
      ]),
    );

    const expandButton = el(
      "button",
      {
        type: "button",
        class: "rounded px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        title: isExpanded ? "Encoger" : "Expandir",
        onclick: () => this.#toggleExpand(row.id),
      },
      isExpanded ? "⤡ Encoger" : "⤢ Expandir",
    );

    return el(
      "div",
      {
        class: `${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH} shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm`,
        dataset: { rowId: row.id, expanded: String(isExpanded) },
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
          el("div", { class: "ml-auto flex items-center gap-1" }, [expandButton, deleteButton(() => handlers.onDeleteRow(row.id))]),
        ]),
        el("div", { class: "mt-3 space-y-3" }, sections),
      ],
    );
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
