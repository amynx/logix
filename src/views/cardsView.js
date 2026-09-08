// Vista de actividades como MAESTRO-DETALLE: a la izquierda una lista de las
// actividades con su estado (✓ completa / ● en construcción / ○ pendiente /
// ⚠ revisar) y a la derecha la actividad seleccionada como espacio de trabajo
// principal. Así el estudiante siempre sabe dónde está, qué construye y qué le
// falta, sin ver todas las tarjetas a la vez. Comparte los constructores de campos
// (rowEditor) y las zonas de razonamiento (cardLayout). Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import {
  buildRowFields,
  renderPreservingFocus,
  dragHandle,
  deleteButton,
  addActivityButton,
  buildActivityList,
  markDropTarget,
  clearDropTarget,
} from "./rowEditor.js";
import { activityFlow, stepNumber, stackedRow } from "./cardLayout.js";
import { sectionHeader } from "./sectionHeader.js";
import { helpButton } from "./helpView.js";
import { icon } from "./icons.js";

export class CardsView {
  constructor({ container }) {
    this.container = container;
  }

  render(analysis, handlers) {
    clear(this.container);
    const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
    const activities = buildActivityList(analysis.rows, dataById);
    const producedIds = new Set(analysis.rows.map((row) => row.resultId).filter(Boolean));
    this.conditions = analysis.rows.filter((row) => row.kind === "condition"); // para etiquetar tokens `cond`
    const rows = analysis.rows;

    const header = sectionHeader({
      title: "Actividades",
      subtitle: "Cada paso del análisis, en orden. Elige una para trabajar en ella.",
      iconName: "activities",
      help: helpButton(2), // pestaña "Condiciones y expresiones"
    });

    if (rows.length === 0) {
      this.container.append(header, activitiesEmptyState(), el("div", { class: "mt-3" }, [addActivityButton(handlers.onAddRow)]));
      return;
    }

    // La actividad seleccionada; si no hay una válida, se trabaja la primera.
    const wanted = handlers.selectedRowId?.();
    const selected = rows.find((row) => row.id === wanted) ?? rows[0];

    const list = el("ol", { class: "space-y-1.5" }, rows.map((row, index) => this.#listItem(row, index, selected.id, dataById, handlers)));
    // Los botones de agregar van ARRIBA: con muchas actividades no obligan a hacer
    // scroll hasta el final de la lista para crear una nueva.
    const master = el("div", { class: "space-y-3" }, [addActivityButton(handlers.onAddRow), list]);
    const detail = this.#workspace(selected, rows.indexOf(selected), dataById, handlers, activities, producedIds);

    this.container.append(
      header,
      el("div", { class: "grid items-start gap-4 md:grid-cols-[17rem_minmax(0,1fr)]" }, [master, detail]),
    );
  }

  renderKeepingFocus(analysis, handlers) {
    renderPreservingFocus(this.container, () => this.render(analysis, handlers));
  }

  // Un elemento de la lista: número (en el círculo) + tipo + título, con el estado
  // en la esquina superior derecha. Seleccionable y arrastrable (por su tirador)
  // para reordenar. Lleva `data-row-id` (uno por actividad); el espacio de trabajo
  // no, para no duplicar la representación.
  #listItem(row, index, selectedId, dataById, handlers) {
    const isSelected = row.id === selectedId;
    const isCondition = row.kind === "condition";
    const status = handlers.rowStatus?.(row.id) ?? "todo";
    const setDragged = (id) => {
      this.draggedRowId = id;
    };
    return el(
      "li",
      {
        dataset: { rowId: row.id },
        class: `relative flex items-center gap-2 rounded-lg border py-2 pl-2 pr-7 transition ${
          isSelected ? "border-indigo-300 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        }`,
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
        dragHandle(row.id, setDragged),
        stepNumber(index + 1),
        el(
          "button",
          {
            type: "button",
            class: "flex min-w-0 flex-1 items-center gap-1.5 text-left",
            onclick: () => handlers.onSelectRow?.(row.id),
          },
          [
            icon(isCondition ? "fork" : "workflow", `h-3.5 w-3.5 shrink-0 ${isCondition ? "text-amber-500" : "text-indigo-500"}`),
            el("span", { class: `min-w-0 truncate text-sm ${isSelected ? "font-semibold text-slate-900" : "text-slate-600"}` }, activityTitle(row, dataById)),
          ],
        ),
        statusCorner(status),
      ],
    );
  }

  // Espacio de trabajo de la actividad seleccionada: encabezado con su número y
  // tipo, y debajo los campos como un flujo de razonamiento (siempre editable).
  #workspace(row, index, dataById, handlers, activities, producedIds) {
    const isCondition = row.kind === "condition";
    const tint = isCondition ? "border-amber-200 bg-amber-50/20" : "border-slate-200 bg-white";
    const fields = buildRowFields(row, dataById, handlers, activities, producedIds);
    return el("div", { class: `rounded-xl border ${tint} p-4 shadow-sm sm:p-5`, dataset: { workspaceRow: row.id } }, [
      el("div", { class: "flex items-center gap-2 border-b border-slate-100 pb-3" }, [
        stepNumber(index + 1),
        el("span", { class: `inline-flex items-center gap-1.5 text-sm font-semibold ${isCondition ? "text-amber-700" : "text-slate-700"}` }, [
          icon(isCondition ? "fork" : "activities", `h-4 w-4 ${isCondition ? "text-amber-500" : "text-indigo-500"}`),
          isCondition ? "Condición" : "Actividad",
        ]),
        el("div", { class: "ml-auto" }, [deleteButton(() => handlers.onDeleteRow(row.id))]),
      ]),
      el("div", { class: "mt-4 space-y-3.5" }, [
        // El tipo se decide al crear la actividad («Agregar operación» / «Agregar
        // condición»); aquí solo se recuerda qué hace, sin un conmutador que confunda.
        el("p", { class: "text-xs text-slate-400" }, isCondition ? "Comprueba algo: una pregunta de Sí / No." : "Calcula o transforma datos para obtener uno nuevo."),
        activityFlow(fields, stackedRow, row.kind),
      ]),
    ]);
  }
}

// Estilo de cada estado de una actividad: un icono y un color representativos, para
// reconocerlo de un vistazo — completa (✓ verde), en construcción (✎ índigo),
// por revisar (⚠ ámbar) y pendiente (◎ gris).
const STATUS_STYLE = {
  done: { icon: "check", color: "text-emerald-600", title: "Completa" },
  active: { icon: "edit", color: "text-indigo-600", title: "En construcción" },
  warn: { icon: "alert", color: "text-amber-600", title: "Por revisar" },
  todo: { icon: "target", color: "text-slate-400", title: "Pendiente" },
};

// El estado va en la esquina superior derecha de la actividad (icono + color).
function statusCorner(status) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.todo;
  return el("span", { class: `absolute right-1.5 top-1.5 ${style.color}`, title: style.title }, [icon(style.icon, "h-4 w-4")]);
}

// Título breve de una actividad para la lista: su necesidad («¿qué necesitas
// hacer?») y, si aún no la tiene, el dato que produce o la pregunta que comprueba.
function activityTitle(row, dataById) {
  const problem = (row.problem ?? "").trim();
  if (problem) return problem;
  if (row.kind === "condition") {
    return (row.conditionName ?? "").trim() || (row.condition ?? "").trim() || "Condición sin definir";
  }
  const result = row.resultId ? dataById.get(row.resultId) : null;
  return (result?.name ?? "").trim() || "Actividad sin definir";
}

// Estado vacío que orienta el primer paso: explica los dos tipos de actividad y
// para qué sirve cada botón de «Agregar…».
function activitiesEmptyState() {
  const option = (iconName, tone, title, text) =>
    el("div", { class: "flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3" }, [
      el("span", { class: `mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tone}` }, [icon(iconName, "h-4 w-4")]),
      el("div", {}, [
        el("div", { class: "text-sm font-semibold text-slate-700" }, title),
        el("div", { class: "text-xs text-slate-500" }, text),
      ]),
    ]);
  return el("div", { class: "rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4" }, [
    el("p", { class: "mb-3 text-sm text-slate-600" }, "Descompón el problema en pasos. Cada paso es de uno de dos tipos:"),
    el("div", { class: "grid gap-2 sm:grid-cols-2" }, [
      option("workflow", "bg-indigo-100 text-indigo-600", "Operación", "Calcula o transforma datos para obtener uno nuevo."),
      option("fork", "bg-amber-100 text-amber-600", "Condición", "Comprueba algo: una pregunta de Sí / No."),
    ]),
    el("p", { class: "mt-3 text-xs text-slate-500" }, "Usa los botones de abajo para agregar la primera. ¿Dudas? Abre la «Guía» o pulsa «?»."),
  ]);
}
