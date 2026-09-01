// Vista de la sección "Estudiantes": el grupo es común a todos (un solo campo) y,
// debajo, la lista de estudiantes que participan (identificación y nombre). Solo
// se ocupa del DOM; notifica los cambios mediante callbacks.

import { el, clear } from "../utils/dom.js";
import { sectionHeader, emptyState } from "./sectionHeader.js";

const CONTROL_CLASS =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

const ADD_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

export class StudentsView {
  constructor({ container }) {
    this.container = container;
  }

  render(group, students, handlers) {
    clear(this.container);

    const groupInput = el("input", {
      id: "analysis-group",
      type: "text",
      value: group ?? "",
      placeholder: "N1, N2, N3…",
      class: `${CONTROL_CLASS} w-40`,
      oninput: (event) => handlers.onGroupChange(event.target.value),
    });

    const list =
      students.length > 0
        ? el("div", { class: "space-y-2" }, students.map((student) => studentRow(student, handlers)))
        : emptyState("students", "Aún no hay estudiantes. Agrega al menos uno.");

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({ step: 1, title: "Estudiantes", subtitle: "El grupo es común a todos; agrega los estudiantes que participan.", iconName: "students" }),
        el("div", { class: "mb-4" }, [
          el("label", { for: "analysis-group", class: "block text-sm font-medium text-slate-700" }, "Grupo"),
          el("div", { class: "mt-1" }, [groupInput]),
        ]),
        list,
        el("div", { class: "mt-3" }, [
          el("button", { type: "button", class: ADD_BUTTON_CLASS, onclick: () => handlers.onAddStudent() }, "+ Agregar estudiante"),
        ]),
      ]),
    );
  }
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
