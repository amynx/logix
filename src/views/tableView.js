// Vista de tabla de análisis: cada actividad es una fila editable. Comparte los
// constructores de campos con la vista de tarjetas (rowEditor). Solo se ocupa del
// DOM; notifica los cambios mediante callbacks.

import { el, clear } from "../utils/dom.js";
import {
  FIELD_ORDER,
  buildRowFields,
  notApplicable,
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
import { buildRowSummary } from "./rowSummary.js";
import { sectionHeader } from "./sectionHeader.js";
import { helpButton } from "./helpView.js";

const TH_CLASS = "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left align-top";
const TD_CLASS = "border-b border-slate-100 px-3 py-2 align-top";

export class TableView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, handlers, viewMode) {
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    const activities = buildActivityList(analysis.rows, dataById);
    const producedIds = new Set(analysis.rows.map((row) => row.resultId).filter(Boolean));
    const table = el("table", { class: "w-full border-collapse text-sm" }, [
      this.#buildHeader(),
      el("tbody", {}, analysis.rows.map((row, index) => this.#buildRow(row, index, dataById, handlers, activities, producedIds))),
    ]);

    this.container.append(
      sectionHeader({
        step: 4,
        title: "Actividades",
        subtitle: "Cada paso del análisis. Puedes cambiar de vista o de orden.",
        iconName: "activities",
        help: helpButton(2), // pestaña "Condiciones y expresiones"
        trailing: viewToggle(viewMode, handlers.onSetViewMode),
      }),
      el("div", { class: "overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm" }, [table]),
      addActivityButton(handlers.onAddRow),
    );
  }

  renderKeepingFocus(analysis, handlers, viewMode) {
    renderPreservingFocus(this.container, () => this.render(analysis, handlers, viewMode));
  }

  #buildHeader() {
    const cells = [el("th", { class: `${TH_CLASS} w-10 text-slate-400`, scope: "col" }, "#")];
    for (const column of FIELD_ORDER) {
      cells.push(
        el("th", { class: `${TH_CLASS} min-w-[9rem]`, scope: "col" }, [
          el("div", { class: "font-semibold text-slate-700" }, column.label),
          el("div", { class: "mt-0.5 text-xs font-normal text-slate-400" }, column.help),
        ]),
      );
    }
    cells.push(el("th", { class: `${TH_CLASS} w-12`, scope: "col" }, el("span", { class: "sr-only" }, "Acciones")));
    return el("thead", { class: "bg-slate-50" }, [el("tr", {}, cells)]);
  }

  #buildRow(row, index, dataById, handlers, activities, producedIds) {
    const editing = handlers.isRowEditing(row.id);
    const contentCells = editing
      ? this.#editCells(row, dataById, handlers, activities)
      : this.#viewCells(row, dataById, activities, producedIds);
    const action = editing
      ? doneButton(() => handlers.onDoneRow(row.id))
      : editButton(() => handlers.onEditRow(row.id));

    const setDragged = (id) => {
      this.draggedRowId = id;
    };
    const cells = [
      el("td", { class: `${TD_CLASS} text-center` }, [
        dragHandle(row.id, setDragged),
        el("span", { class: "text-xs text-slate-400" }, String(index + 1)),
      ]),
      ...contentCells,
      el("td", { class: `${TD_CLASS} text-center` }, [
        el("div", { class: "flex flex-col items-center gap-1" }, [action, deleteButton(() => handlers.onDeleteRow(row.id))]),
      ]),
    ];

    return el(
      "tr",
      {
        class: `${index % 2 === 1 ? "bg-slate-50" : "bg-white"} hover:bg-sky-50/60`,
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
      cells,
    );
  }

  // Modo edición: una celda por campo con su control editable.
  #editCells(row, dataById, handlers, activities) {
    const fields = buildRowFields(row, dataById, handlers, activities);
    return FIELD_ORDER.map((column) => el("td", { class: TD_CLASS }, [fields[column.key] ?? notApplicable()]));
  }

  // Modo visualización: una celda por campo con solo la información registrada.
  #viewCells(row, dataById, activities, producedIds) {
    const summary = buildRowSummary(row, dataById, activities, producedIds);
    return FIELD_ORDER.map((column) =>
      el("td", { class: TD_CLASS }, [summary[column.key] ?? el("span", { class: "text-slate-300" }, "—")]),
    );
  }
}
