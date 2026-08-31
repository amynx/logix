// Vista de la sección "Estudiantes": registra la información de quienes realizan
// el análisis (número de identificación, nombre completo y grupo). Admite varios
// estudiantes. Solo se ocupa del DOM; notifica los cambios mediante callbacks.

import { el, clear } from "../utils/dom.js";

const CONTROL_CLASS =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300";

export class StudentsView {
  constructor({ container }) {
    this.container = container;
  }

  render(students, handlers) {
    clear(this.container);

    const list =
      students.length > 0
        ? el("div", { class: "space-y-2" }, students.map((student) => studentRow(student, handlers)))
        : el("p", { class: "text-sm text-slate-400" }, "Aún no hay estudiantes. Agrega al menos uno.");

    this.container.append(
      el("section", { class: "rounded-lg border border-slate-200 bg-white p-4" }, [
        el("div", { class: "mb-3" }, [
          el("h2", { class: "text-sm font-semibold text-slate-700" }, "Estudiantes"),
          el("p", { class: "text-xs text-slate-400" }, "Se incluye al exportar el análisis."),
        ]),
        list,
        el("div", { class: "mt-3" }, [
          el(
            "button",
            {
              type: "button",
              class:
                "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium " +
                "text-slate-700 hover:bg-slate-50",
              onclick: () => handlers.onAddStudent(),
            },
            "+ Agregar estudiante",
          ),
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
    field("Grupo (N1, N2…)", student.group, "w-28", (value) => change({ group: value })),
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
