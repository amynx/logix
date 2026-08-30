// Diálogos modales construidos con HTML + Tailwind. Se evita el elemento nativo
// <dialog> para mantener un comportamiento uniforme y fácil de probar.

import { el } from "../utils/dom.js";

// Muestra un mensaje informativo con un único botón de aceptar. Devuelve una
// promesa que se resuelve al cerrarlo. Útil para errores comprensibles al usuario.
export function messageDialog({ title, message, acceptLabel = "Entendido" }) {
  return new Promise((resolve) => {
    const close = () => {
      overlay.remove();
      resolve();
    };

    const acceptButton = el(
      "button",
      {
        type: "button",
        class: "rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900",
        onclick: close,
      },
      acceptLabel,
    );

    const overlay = el(
      "div",
      {
        class: "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4",
        onclick: (event) => {
          if (event.target === overlay) close();
        },
      },
      [
        el("div", { class: "w-full max-w-sm rounded-lg bg-white p-5 shadow-xl", role: "dialog", "aria-modal": "true" }, [
          el("h2", { class: "text-base font-semibold text-slate-900" }, title),
          el("p", { class: "mt-2 text-sm text-slate-600" }, message),
          el("div", { class: "mt-5 flex justify-end" }, [acceptButton]),
        ]),
      ],
    );

    document.body.append(overlay);
    acceptButton.focus();
  });
}

export function confirmDialog({ title, message, confirmLabel = "Eliminar", cancelLabel = "Cancelar" }) {
  return new Promise((resolve) => {
    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    const confirmButton = el(
      "button",
      {
        type: "button",
        class: "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700",
        onclick: () => close(true),
      },
      confirmLabel,
    );

    const overlay = el(
      "div",
      {
        class: "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4",
        onclick: (event) => {
          if (event.target === overlay) close(false);
        },
      },
      [
        el("div", { class: "w-full max-w-sm rounded-lg bg-white p-5 shadow-xl", role: "dialog", "aria-modal": "true" }, [
          el("h2", { class: "text-base font-semibold text-slate-900" }, title),
          el("p", { class: "mt-2 text-sm text-slate-600" }, message),
          el("div", { class: "mt-5 flex justify-end gap-2" }, [
            el(
              "button",
              {
                type: "button",
                class: "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50",
                onclick: () => close(false),
              },
              cancelLabel,
            ),
            confirmButton,
          ]),
        ]),
      ],
    );

    document.body.append(overlay);
    confirmButton.focus();
  });
}
