// Vista de la sección "Estudiantes": el grupo es común a todos (un solo campo,
// siempre editable) y, debajo, la lista de estudiantes. La lista tiene dos modos:
// edición (campos + controles) y visualización (solo la información, en fichas),
// para que la sección quede limpia al terminar. Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import { sectionHeader, emptyState } from "./sectionHeader.js";
import { icon } from "./icons.js";

const CONTROL_CLASS =
  "rounded-[var(--lx-r-control)] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-2 py-1 text-[13.5px] text-[var(--lx-ink)] " +
  "outline-none focus:border-[oklch(0.72_0.09_300)] focus:ring-2 focus:ring-[oklch(0.90_0.05_300)]";

const GHOST_BUTTON_CLASS =
  "inline-flex h-[34px] items-center gap-1.5 rounded-[var(--lx-r-control)] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 " +
  "text-[13.5px] font-medium text-[var(--lx-ink-body)] hover:bg-[var(--lx-bg)]";

const PRIMARY_BUTTON_CLASS =
  "inline-flex h-[34px] items-center gap-1.5 rounded-[var(--lx-r-control)] bg-[var(--lx-violet)] px-3.5 text-[13.5px] font-medium text-white hover:bg-[var(--lx-violet-hover)]";

export class StudentsView {
  constructor({ container }) {
    this.container = container;
  }

  render(group, students, editing, handlers) {
    clear(this.container);
    if (editing) return this.container.append(this.#editingCard(group, students, handlers));
    // Una vez configurados, los estudiantes son información secundaria: se muestran
    // como una barra compacta para no competir con el enunciado del problema.
    if (students.length > 0) return this.container.append(this.#compactBar(group, students, handlers));
    return this.container.append(this.#emptyCard(handlers));
  }

  // Barra compacta (visualización): grupo + estudiantes en una línea, con «Editar».
  #compactBar(group, students, handlers) {
    return el("div", { class: "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--lx-r-panel)] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-3.5 py-2.5 text-[13.5px] shadow-[var(--lx-shadow-card)]" }, [
      el("span", { class: "inline-flex items-center gap-1.5 font-medium text-[var(--lx-ink-body)]" }, [
        icon("students", "h-4 w-4 text-[var(--lx-violet)]"),
        group ? `Grupo ${group}` : "Sin grupo",
      ]),
      el("span", { class: "text-[var(--lx-border-dashed)]" }, "·"),
      el("div", { class: "flex flex-wrap gap-1.5" }, students.map(studentChip)),
      el(
        "button",
        { type: "button", class: `${GHOST_BUTTON_CLASS} ml-auto`, onclick: () => handlers.onEditStudents() },
        [icon("edit", "h-4 w-4"), "Editar estudiantes"],
      ),
    ]);
  }

  // Estado vacío (sin estudiantes): invita a agregar el primero.
  #emptyCard(handlers) {
    return el("section", { class: "rounded-[var(--lx-r-card)] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5 shadow-[var(--lx-shadow-card)]" }, [
      sectionHeader({ title: "Estudiantes", subtitle: "El grupo es común a todos; agrega los estudiantes que participan.", iconName: "students" }),
      emptyState("students", "Aún no hay estudiantes. Agrega al menos uno."),
      el("div", { class: "mt-3" }, [el("button", { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onAddStudent() }, "+ Agregar estudiante")]),
    ]);
  }

  // Modo edición: el grupo y los estudiantes se editan juntos.
  #editingCard(group, students, handlers) {
    const groupBlock = el("div", { class: "mb-4" }, [
      el("label", { for: "analysis-group", class: "block text-sm font-medium text-slate-700" }, "Grupo"),
      el("div", { class: "mt-1" }, [
        el("input", {
          id: "analysis-group",
          type: "text",
          value: group ?? "",
          placeholder: "N1, N2, N3…",
          class: `${CONTROL_CLASS} w-40`,
          oninput: (event) => handlers.onGroupChange(event.target.value),
        }),
      ]),
    ]);
    const list =
      students.length > 0
        ? el("div", { class: "space-y-2" }, students.map((student) => studentRow(student, handlers)))
        : el("p", { class: "text-sm text-slate-400" }, "Agrega el primer estudiante.");
    const actions = [
      el("button", { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onAddStudent() }, "+ Agregar estudiante"),
      el("button", { type: "button", class: PRIMARY_BUTTON_CLASS, onclick: () => handlers.onDoneStudents() }, [icon("check", "h-4 w-4"), "Listo"]),
    ];
    return el("section", { class: "rounded-[var(--lx-r-card)] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5 shadow-[var(--lx-shadow-card)]" }, [
      sectionHeader({ title: "Estudiantes", subtitle: "El grupo es común a todos; agrega los estudiantes que participan.", iconName: "students" }),
      groupBlock,
      list,
      el("div", { class: "mt-3 flex flex-wrap gap-2" }, actions),
    ]);
  }
}

// Ficha de solo lectura de un estudiante: identificación · nombre.
function studentChip(student) {
  const parts = [student.idNumber, student.fullName].map((value) => (value ?? "").trim()).filter(Boolean);
  const label = parts.length > 0 ? parts.join(" · ") : "(estudiante sin datos)";
  return el("span", { class: "inline-flex items-center gap-1.5 rounded-[var(--lx-r-chip)] border border-[var(--lx-border)] bg-[var(--lx-surface-sunken)] px-2.5 py-1 text-[13px] text-[var(--lx-ink-body)]" }, label);
}

function studentRow(student, handlers) {
  const change = (changes) => handlers.onStudentChange(student.id, changes);
  return el("div", { class: "flex flex-wrap items-center gap-2" }, [
    field("N.º de identificación", student.idNumber, "w-44", (value) => change({ idNumber: value })),
    field("Nombre completo", student.fullName, "w-64", (value) => change({ fullName: value }), { uppercase: true }),
    el(
      "button",
      {
        type: "button",
        class: "rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600",
        title: "Eliminar estudiante",
        "aria-label": "Eliminar estudiante",
        onclick: () => handlers.onRemoveStudent(student.id),
      },
      "🗑",
    ),
  ]);
}

// `uppercase` normaliza la entrada a mayúsculas: se muestra en mayúsculas y se
// guarda en mayúsculas (el estado es la fuente de verdad, así también salen en
// las fichas y el PDF). El placeholder conserva su capitalización original.
function field(placeholder, value, widthClass, onInput, { uppercase = false } = {}) {
  return el("input", {
    type: "text",
    value: value ?? "",
    placeholder,
    class: `${CONTROL_CLASS} ${widthClass}${uppercase ? " uppercase placeholder:normal-case" : ""}`,
    oninput: (event) => onInput(uppercase ? event.target.value.toUpperCase() : event.target.value),
  });
}
