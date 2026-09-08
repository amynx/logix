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
    const master = el("div", { class: "space-y-3" }, [list, addActivityButton(handlers.onAddRow)]);
    const detail = this.#workspace(selected, rows.indexOf(selected), dataById, handlers, activities, producedIds);

    this.container.append(
      header,
      el("div", { class: "grid items-start gap-4 md:grid-cols-[17rem_minmax(0,1fr)]" }, [master, detail]),
    );
  }

  renderKeepingFocus(analysis, handlers) {
    renderPreservingFocus(this.container, () => this.render(analysis, handlers));
  }

  // Un elemento de la lista: estado + número + título breve + tipo. Seleccionable,
  // y arrastrable (por su tirador) para reordenar. Lleva `data-row-id` (uno por
  // actividad); el espacio de trabajo no, para no duplicar la representación.
  #listItem(row, index, selectedId, dataById, handlers) {
    const isSelected = row.id === selectedId;
    const isCondition = row.kind === "condition";
    const status = isSelected ? "active" : handlers.rowStatus?.(row.id) ?? "todo";
    const setDragged = (id) => {
      this.draggedRowId = id;
    };
    return el(
      "li",
      {
        dataset: { rowId: row.id },
        class: `flex items-center gap-2 rounded-lg border px-2 py-2 transition ${
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
        statusMarker(status, index + 1),
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
        el("span", { class: `inline-flex items-center gap-1 text-sm font-semibold ${isCondition ? "text-amber-700" : "text-slate-700"}` }, [
          icon(isCondition ? "fork" : "activities", "h-4 w-4"),
          isCondition ? "Condición" : "Actividad",
        ]),
        el("div", { class: "ml-auto" }, [deleteButton(() => handlers.onDeleteRow(row.id))]),
      ]),
      el("div", { class: "mt-4 space-y-3.5" }, [
        fields.kind ? el("div", {}, [fields.kind]) : null,
        activityFlow(fields, stackedRow, row.kind),
      ]),
    ]);
  }
}

// Marcador de estado de una actividad, con el mismo lenguaje que el paso superior:
// ✓ completa, ● en construcción (la seleccionada), ⚠ revisar, ○ pendiente (número).
function statusMarker(status, position) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold";
  if (status === "done") return el("span", { class: `${base} bg-emerald-500 text-white`, title: "Completa" }, [icon("check", "h-3.5 w-3.5")]);
  if (status === "warn") return el("span", { class: `${base} bg-amber-100 text-amber-700`, title: "Por revisar" }, [icon("alert", "h-3.5 w-3.5")]);
  if (status === "active") return el("span", { class: `${base} bg-indigo-600 text-white`, title: "En construcción" }, String(position));
  return el("span", { class: `${base} border border-slate-300 text-slate-400`, title: "Pendiente" }, String(position));
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
