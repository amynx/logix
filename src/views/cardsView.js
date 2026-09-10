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

    if (rows.length === 0) {
      this.container.append(activitiesEmptyState(handlers.onAddRow));
      return;
    }

    // La actividad seleccionada; si no hay una válida, se trabaja la primera.
    const wanted = handlers.selectedRowId?.();
    const selected = rows.find((row) => row.id === wanted) ?? rows[0];

    // La lista intercala, entre dos pasos, un conector con el dato que produce el
    // paso anterior: así se ve qué se transporta de una actividad a la siguiente.
    const listChildren = [];
    rows.forEach((row, index) => {
      if (index > 0) {
        const produced = rows[index - 1].resultId ? dataById.get(rows[index - 1].resultId) : null;
        listChildren.push(railConnector(produced));
      }
      listChildren.push(this.#listItem(row, index, selected.id, dataById, handlers));
    });
    const list = el("ol", {}, listChildren);
    // Los botones de agregar van ARRIBA: con muchas actividades no obligan a hacer
    // scroll hasta el final de la lista para crear una nueva.
    const railLabel = el("div", { class: "mb-2 flex items-baseline gap-2" }, [
      el("span", { class: "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--lx-ink-muted)]" }, "El flujo"),
      el("span", { class: "text-[12px] text-[var(--lx-ink-ghost)]" }, `${rows.length} ${rows.length === 1 ? "paso" : "pasos"}`),
    ]);
    const master = el("div", { class: "space-y-3 md:sticky md:top-[20px]" }, [railLabel, addActivityButton(handlers.onAddRow), list]);
    const detail = this.#workspace(selected, rows.indexOf(selected), dataById, handlers, activities, producedIds);

    this.container.append(
      el("div", { class: "grid items-start gap-[22px] md:grid-cols-[268px_minmax(0,1fr)]" }, [master, detail]),
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
          isSelected ? "border-[oklch(0.90_0.04_300)] bg-[oklch(0.972_0.018_300)] shadow-[var(--lx-shadow-card)]" : "border-[var(--lx-border)] bg-[var(--lx-surface)] hover:border-[var(--lx-border-dashed)] hover:bg-[var(--lx-bg)]"
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
            icon(isCondition ? "fork" : "workflow", `h-3.5 w-3.5 shrink-0 ${isCondition ? "text-[var(--lx-condicion-fg)]" : "text-[var(--lx-violet)]"}`),
            el("span", { class: `min-w-0 truncate text-sm ${isSelected ? "font-semibold text-[var(--lx-ink)]" : "text-[var(--lx-ink-body)]"}` }, activityTitle(row, dataById)),
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
    const tint = isCondition ? "border-[var(--lx-condicion-border)] bg-[var(--lx-condicion-bg)]/40" : "border-[var(--lx-border)] bg-[var(--lx-surface)]";
    const fields = buildRowFields(row, dataById, handlers, activities, producedIds);
    return el("div", { class: `rounded-[var(--lx-r-card)] border ${tint} p-4 shadow-[var(--lx-shadow-card)] sm:p-5`, dataset: { workspaceRow: row.id } }, [
      el("div", { class: "flex items-center gap-2 border-b border-[var(--lx-border-soft)] pb-3" }, [
        stepNumber(index + 1),
        el("span", { class: `inline-flex items-center gap-1.5 text-sm font-semibold ${isCondition ? "text-[var(--lx-condicion-fg)]" : "text-[var(--lx-ink-body)]"}` }, [
          icon(isCondition ? "fork" : "activities", `h-4 w-4 ${isCondition ? "text-[var(--lx-condicion-fg)]" : "text-[var(--lx-violet)]"}`),
          isCondition ? "Condición" : "Actividad",
        ]),
        el("div", { class: "ml-auto" }, [deleteButton(() => handlers.onDeleteRow(row.id))]),
      ]),
      el("div", { class: "mt-4 space-y-3.5" }, [
        // El tipo se decide al crear la actividad («Agregar operación» / «Agregar
        // condición»); aquí solo se recuerda qué hace, sin un conmutador que confunda.
        el("p", { class: "text-xs text-[var(--lx-ink-muted)]" }, isCondition ? "Comprueba algo: una pregunta de Sí / No." : "Calcula o transforma datos para obtener uno nuevo."),
        activityFlow(fields, stackedRow, row.kind),
      ]),
    ]);
  }
}

// Estilo de cada estado de una actividad: un icono y un color representativos, para
// reconocerlo de un vistazo — completa (✓ verde), en construcción (✎ índigo),
// por revisar (⚠ ámbar) y pendiente (◎ gris).
const STATUS_STYLE = {
  done: { icon: "check", cls: "bg-[var(--lx-green)] text-white", title: "Completa" },
  active: { icon: "edit", cls: "bg-[var(--lx-violet)] text-white", title: "En construcción" },
  warn: { icon: "alert", cls: "bg-[var(--lx-amber)] text-white", title: "Por revisar" },
  todo: { icon: "target", cls: "bg-[var(--lx-ink-ghost)] text-white", title: "Pendiente" },
};

// Conector entre dos pasos del riel: una línea vertical y, si el paso anterior
// produce un dato, un chip con ese dato (lo que se transporta al siguiente paso).
function railConnector(datum) {
  return el("li", { class: "flex items-center gap-2 pl-[26px]", "aria-hidden": datum ? null : "true" }, [
    el("span", { class: "h-[22px] w-px shrink-0 bg-[var(--lx-border-dashed)]" }),
    datum
      ? el("span", { class: "[font-family:var(--lx-font-mono)] inline-flex items-center rounded-[var(--lx-r-chip)] border border-[var(--lx-resultante-border)] bg-[var(--lx-resultante-bg)] px-1.5 py-0.5 text-[11px] text-[var(--lx-resultante-fg)]", title: "Dato que pasa al siguiente paso" }, datum.name || "(sin nombre)")
      : null,
  ]);
}

// El estado va en la esquina superior derecha de la actividad: el icono dentro de un
// círculo del color que representa el estado.
function statusCorner(status) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.todo;
  return el(
    "span",
    { class: `absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full ${style.cls}`, title: style.title },
    [icon(style.icon, "h-3 w-3")],
  );
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

// Estado vacío: en vez de un cartel, el esqueleto de una actividad (las tres zonas
// en punteado) con la acción que lo llena en el centro.
function activitiesEmptyState(onAddRow) {
  const zone = (n, title, help) =>
    el("div", { class: "flex-1 rounded-[var(--lx-r-panel)] border border-dashed border-[var(--lx-border-dashed)] p-3" }, [
      el("div", { class: "mb-1 flex items-center gap-1.5" }, [
        el("span", { class: "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--lx-surface-sunken)] text-[11px] font-semibold text-[var(--lx-ink-muted)]" }, String(n)),
        el("span", { class: "text-[13px] font-semibold text-[var(--lx-ink-muted)]" }, title),
      ]),
      el("p", { class: "text-[12px] text-[var(--lx-ink-ghost)]" }, help),
    ]);
  const addBtn = (kind, label, iconName, cls) =>
    el("button", { type: "button", class: `inline-flex items-center gap-1.5 rounded-[var(--lx-r-control)] px-3.5 py-2 text-[13.5px] font-medium ${cls}`, onclick: () => onAddRow(kind) }, [icon(iconName, "h-4 w-4"), label]);
  return el("div", { class: "rounded-[var(--lx-r-card)] border border-dashed border-[var(--lx-border-dashed)] bg-[var(--lx-surface-muted)] p-6" }, [
    el("div", { class: "mb-5 flex flex-col gap-3 lg:flex-row" }, [
      zone(1, "Qué necesitas", "Los datos que usa este paso."),
      zone(2, "Qué haces", "La operación o comprobación."),
      zone(3, "Qué obtienes", "El dato que produce."),
    ]),
    el("p", { class: "mb-5 text-center text-[13.5px] text-[var(--lx-ink-muted)]" }, "Empieza por el primer paso del proceso: algo que calcule un dato nuevo o que compruebe una condición."),
    el("div", { class: "flex flex-wrap justify-center gap-2" }, [
      addBtn("operation", "+ Agregar operación", "workflow", "bg-[var(--lx-violet)] text-white hover:bg-[var(--lx-violet-hover)]"),
      addBtn("condition", "+ Agregar condición", "fork", "border border-[var(--lx-condicion-border)] bg-[var(--lx-condicion-bg)] text-[var(--lx-condicion-fg)] hover:brightness-95"),
    ]),
  ]);
}
