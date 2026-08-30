// Vista de la cabecera del análisis: barra de herramientas e información
// editable (título y descripción). Solo se ocupa del DOM; no conoce el modelo
// ni la persistencia. Recibe callbacks y notifica los cambios del usuario.

import { el, clear } from "../utils/dom.js";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm " +
  "text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

const LABEL_CLASS = "block text-sm font-medium text-slate-700";
const HELP_CLASS = "mt-1 text-xs text-slate-500";

const SAVE_STATUS = {
  saving: { text: "Guardando…", class: "text-slate-500" },
  saved: { text: "✓ Guardado automáticamente", class: "text-emerald-600" },
  error: { text: "No se pudo guardar", class: "text-red-600" },
};

export class AnalysisView {
  constructor({ toolbarContainer, infoContainer }) {
    this.toolbarContainer = toolbarContainer;
    this.infoContainer = infoContainer;
    this.statusElement = null;
  }

  renderToolbar() {
    clear(this.toolbarContainer);
    this.statusElement = el("span", { class: "text-xs text-slate-400" }, "");
    this.toolbarContainer.append(this.statusElement);
  }

  setSaveStatus(state) {
    if (!this.statusElement) return;
    const status = SAVE_STATUS[state] ?? { text: "", class: "text-slate-400" };
    this.statusElement.textContent = status.text;
    this.statusElement.className = `text-xs ${status.class}`;
  }

  renderInfo(analysis, { onTitleChange, onDescriptionChange }) {
    clear(this.infoContainer);

    const title = el("input", {
      id: "analysis-title",
      type: "text",
      value: analysis.title,
      placeholder: "Ej.: Determinar si un estudiante aprueba",
      class: INPUT_CLASS,
      oninput: (event) => onTitleChange(event.target.value),
    });

    const description = el("textarea", {
      id: "analysis-description",
      rows: 3,
      value: analysis.description,
      placeholder: "Describe el problema del mundo real que se quiere resolver",
      class: `${INPUT_CLASS} resize-y`,
      oninput: (event) => onDescriptionChange(event.target.value),
    });

    this.infoContainer.append(
      el("div", { class: "space-y-4 rounded-lg border border-slate-200 bg-white p-4" }, [
        el("div", {}, [
          el("label", { for: "analysis-title", class: LABEL_CLASS }, "Título del análisis"),
          el("div", { class: "mt-1" }, [title]),
        ]),
        el("div", {}, [
          el("label", { for: "analysis-description", class: LABEL_CLASS }, "Descripción del problema"),
          el("div", { class: "mt-1" }, [description]),
          el("p", { class: HELP_CLASS }, "Contexto general: qué necesidad debe resolver el programa."),
        ]),
      ]),
    );
  }
}
