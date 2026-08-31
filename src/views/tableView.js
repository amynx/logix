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
  addActivityButton,
} from "./rowEditor.js";

const TH_CLASS = "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left align-top";
const TD_CLASS = "border-b border-slate-100 px-3 py-2 align-top";

export class TableView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, handlers, viewMode) {
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    const table = el("table", { class: "w-full border-collapse text-sm" }, [
      this.#buildHeader(),
      el("tbody", {}, analysis.rows.map((row, index) => this.#buildRow(row, index, dataById, handlers))),
    ]);

    this.container.append(
      el("div", { class: "mb-3" }, [viewToggle(viewMode, handlers.onSetViewMode)]),
      el("div", { class: "overflow-x-auto rounded-lg border border-slate-200 bg-white" }, [table]),
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

  #buildRow(row, index, dataById, handlers) {
    const fields = buildRowFields(row, dataById, handlers);

    const setDragged = (id) => {
      this.draggedRowId = id;
    };
    const cells = [
      el("td", { class: `${TD_CLASS} text-center` }, [
        dragHandle(row.id, setDragged),
        el("span", { class: "text-xs text-slate-400" }, String(index + 1)),
      ]),
      ...FIELD_ORDER.map((column) => el("td", { class: TD_CLASS }, [fields[column.key] ?? notApplicable()])),
      el("td", { class: `${TD_CLASS} text-center` }, [deleteButton(() => handlers.onDeleteRow(row.id))]),
    ];

    return el(
      "tr",
      {
        class: `${index % 2 === 1 ? "bg-slate-50" : "bg-white"} hover:bg-sky-50/60`,
        dataset: { rowId: row.id },
        ondragover: (event) => event.preventDefault(),
        ondrop: (event) => {
          event.preventDefault();
          const fromId = this.draggedRowId;
          this.draggedRowId = null;
          if (fromId && fromId !== row.id) handlers.onMoveRow(fromId, row.id);
        },
      },
      cells,
    );
  }
}
