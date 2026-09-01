// Vista de la sección "Estudiantes": como todo el grupo comparte la misma
// actividad, solo registra el grupo (p. ej. N1, N2, N3). Solo se ocupa del DOM;
// notifica el cambio mediante un callback.

import { el, clear } from "../utils/dom.js";
import { sectionHeader } from "./sectionHeader.js";

const CONTROL_CLASS =
  "w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

export class GroupView {
  constructor({ container }) {
    this.container = container;
  }

  render(group, { onGroupChange }) {
    clear(this.container);

    const input = el("input", {
      id: "analysis-group",
      type: "text",
      value: group ?? "",
      placeholder: "N1, N2, N3…",
      class: CONTROL_CLASS,
      oninput: (event) => onGroupChange(event.target.value),
    });

    this.container.append(
      el("section", { class: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({ step: 1, title: "Estudiantes", subtitle: "Grupo al que pertenecen quienes realizan el análisis.", iconName: "students" }),
        el("div", {}, [
          el("label", { for: "analysis-group", class: "block text-sm font-medium text-slate-700" }, "Grupo"),
          el("div", { class: "mt-1" }, [input]),
        ]),
      ]),
    );
  }
}
