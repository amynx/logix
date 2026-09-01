// Indicador de completitud en vivo: muestra los puntos por completar del análisis
// (o confirma que está completo). No bloquea nada; solo orienta al estudiante.
// Solo se ocupa del DOM; recibe la lista de advertencias ya calculada.

import { el, clear } from "../utils/dom.js";
import { icon } from "./icons.js";

export class CompletenessView {
  constructor({ container }) {
    this.container = container;
  }

  render(warnings) {
    clear(this.container);

    if (warnings.length === 0) {
      this.container.append(
        el("div", { class: "inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700" }, [
          icon("check", "h-4 w-4"),
          "El análisis está completo.",
        ]),
      );
      return;
    }

    this.container.append(
      el("div", { class: "rounded-xl border border-amber-200 bg-amber-50 p-4" }, [
        el("div", { class: "mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800" }, [
          icon("alert", "h-4 w-4"),
          `Por completar (${warnings.length})`,
        ]),
        el("ul", { class: "list-disc space-y-1 pl-5 text-sm text-amber-800" }, warnings.map((warning) => el("li", {}, warning))),
      ]),
    );
  }
}
