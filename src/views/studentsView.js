// Vista de la sección "Estudiantes": el grupo es común a todos (un solo campo,
// siempre editable) y, debajo, la lista de estudiantes. La lista tiene dos modos:
// edición (campos + controles) y visualización (solo la información, en fichas),
// para que la sección quede limpia al terminar. Solo se ocupa del DOM.

import { el, clear } from "../utils/dom.js";
import { sectionHeader, emptyState } from "./sectionHeader.js";
import { icon } from "./icons.js";

const CONTROL_CLASS =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

const GHOST_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700";

export class StudentsView {
  constructor({ container }) {
    this.container = container;
  }

  render(group, students, editing, handlers) {
    clear(this.container);

    const addButton = el("button", { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onAddStudent() }, "+ Agregar estudiante");

    let groupBlock;
    let list;
    let actions;
    if (editing) {
      // Modo edición: el grupo y los estudiantes se editan juntos.
      groupBlock = el("div", { class: "mb-4" }, [
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
      list =
        students.length > 0
          ? el("div", { class: "space-y-2" }, students.map((student) => studentRow(student, handlers)))
          : el("p", { class: "text-sm text-slate-400" }, "Agrega el primer estudiante.");
      actions = [
        addButton,
        el("button", { type: "button", class: PRIMARY_BUTTON_CLASS, onclick: () => handlers.onDoneStudents() }, [icon("check", "h-4 w-4"), "Listo"]),
      ];
    } else {
      // Modo visualización: grupo y estudiantes de solo lectura.
      groupBlock = el("div", { class: "mb-4 text-sm" }, [
        el("span", { class: "font-medium text-slate-700" }, "Grupo: "),
        group ? el("span", { class: "text-slate-700" }, group) : el("span", { class: "text-slate-400" }, "sin asignar"),
      ]);
      if (students.length > 0) {
        list = el("div", { class: "flex flex-wrap gap-2" }, students.map(studentChip));
        actions = [el("button", { type: "button", class: GHOST_BUTTON_CLASS, onclick: () => handlers.onEditStudents() }, [icon("edit", "h-4 w-4"), "Editar estudiantes"])];
      } else {
        list = emptyState("students", "Aún no hay estudiantes. Agrega al menos uno.");
        actions = [addButton];
      }
    }

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({ step: 1, title: "Estudiantes", subtitle: "El grupo es común a todos; agrega los estudiantes que participan.", iconName: "students" }),
        groupBlock,
        list,
        el("div", { class: "mt-3 flex flex-wrap gap-2" }, actions),
      ]),
    );
  }
}

// Ficha de solo lectura de un estudiante: identificación · nombre.
function studentChip(student) {
  const parts = [student.idNumber, student.fullName].map((value) => (value ?? "").trim()).filter(Boolean);
  const label = parts.length > 0 ? parts.join(" · ") : "(estudiante sin datos)";
  return el("span", { class: "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700" }, label);
}

function studentRow(student, handlers) {
  const change = (changes) => handlers.onStudentChange(student.id, changes);
  return el("div", { class: "flex flex-wrap items-center gap-2" }, [
    field("N.º de identificación", student.idNumber, "w-44", (value) => change({ idNumber: value })),
    field("Nombre completo", student.fullName, "w-64", (value) => change({ fullName: value })),
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

function field(placeholder, value, widthClass, onInput) {
  return el("input", {
    type: "text",
    value: value ?? "",
    placeholder,
    class: `${CONTROL_CLASS} ${widthClass}`,
    oninput: (event) => onInput(event.target.value),
  });
}
