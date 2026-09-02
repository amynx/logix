// Vista de la cabecera del análisis: barra de herramientas e información
// editable (título y descripción). Solo se ocupa del DOM; no conoce el modelo
// ni la persistencia. Recibe callbacks y notifica los cambios del usuario.

import { el, clear } from "../utils/dom.js";
import { icon } from "./icons.js";
import { sectionHeader } from "./sectionHeader.js";
import { openHelp } from "./helpView.js";
import { startExampleTutorial } from "./guideView.js";
import { toggleTheme } from "../utils/theme.js";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm " +
  "text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

const LABEL_CLASS = "block text-sm font-medium text-slate-700";
const HELP_CLASS = "mt-1 text-xs text-slate-500";

// Botón de la barra: fantasma (por defecto) o primario (índigo sólido). Ocupa todo
// el ancho en el menú móvil y vuelve a su ancho natural en pantallas grandes.
function toolbarButton(label, onClick, iconName, { primary = false } = {}) {
  const base = "inline-flex w-full items-center justify-start gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium md:w-auto md:justify-center";
  const variant = primary
    ? "bg-indigo-600 text-white hover:bg-indigo-700"
    : "border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";
  return el("button", { type: "button", class: `${base} ${variant}`, onclick: onClick }, [
    iconName ? icon(iconName, "h-4 w-4") : null,
    label,
  ]);
}

// Estados del guardado. Se usan etiquetas cortas y un ancho reservado para que el
// cambio de estado no altere el layout del navbar; el icono distingue cada estado.
// Botón compacto (solo icono) para deshacer/rehacer.
function historyButton(iconName, label, onClick) {
  return el(
    "button",
    {
      type: "button",
      class: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:bg-white disabled:hover:text-slate-600",
      title: label,
      "aria-label": label,
      onclick: onClick,
    },
    [icon(iconName, "h-4 w-4")],
  );
}

const SAVE_STATUS = {
  idle: { text: "", pill: "text-transparent", icon: () => null },
  saving: { text: "Guardando…", pill: "bg-slate-100 text-slate-500", icon: spinner },
  saved: { text: "Guardado", pill: "bg-emerald-50 text-emerald-600", icon: () => icon("check", "h-3.5 w-3.5") },
  error: { text: "Sin guardar", pill: "bg-red-50 text-red-600", icon: dot },
};

// Pequeño anillo giratorio para el estado "Guardando…".
function spinner() {
  return el("span", { class: "h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" });
}

// Punto sólido para el estado de error.
function dot() {
  return el("span", { class: "h-2 w-2 rounded-full bg-red-500" });
}

export class AnalysisView {
  constructor({ toolbarContainer, infoContainer, statusContainer, historyContainer }) {
    this.toolbarContainer = toolbarContainer;
    this.infoContainer = infoContainer;
    this.statusContainer = statusContainer;
    this.historyContainer = historyContainer;
    this.statusIcon = null;
    this.statusLabel = null;
  }

  // Indicador de guardado en una ranura estable del header. Reserva un ancho fijo
  // y transiciona solo el color, sin desplazar los demás elementos.
  renderStatus() {
    clear(this.statusContainer);
    this.statusIcon = el("span", { class: "flex h-3.5 w-3.5 items-center justify-center" });
    this.statusLabel = el("span", {}, "");
    this.statusContainer.append(
      el("span", { class: "inline-flex min-w-[6.5rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors" }, [
        this.statusIcon,
        this.statusLabel,
      ]),
    );
    this.setSaveStatus("idle");
  }

  renderToolbar({ onNew, onOpenFile, onSaveFile, onExportPdf, onUndo, onRedo }) {
    clear(this.toolbarContainer);

    const fileInput = el("input", {
      type: "file",
      accept: ".analisis,application/json",
      class: "hidden",
      onchange: (event) => {
        const [file] = event.target.files;
        if (file) onOpenFile(file);
        event.target.value = ""; // permite reabrir el mismo archivo
      },
    });

    // En móvil las acciones se agrupan en un menú desplegable; en pantallas
    // grandes se muestran en línea (md:flex las revela pese a la clase "hidden").
    const menu = el(
      "div",
      {
        class:
          "hidden absolute right-4 top-14 z-30 w-56 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg " +
          "md:flex md:static md:right-auto md:top-auto md:z-auto md:w-auto md:flex-row md:items-center md:gap-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none",
        onclick: (event) => {
          if (event.target.closest("button")) closeMenu();
        },
      },
      [
        toolbarButton("Nuevo análisis", onNew, "new"),
        toolbarButton("Ejemplo guiado", () => startExampleTutorial(), "example"),
        toolbarButton("Abrir análisis", () => fileInput.click(), "open"),
        toolbarButton("Guardar archivo", onSaveFile, "save"),
        toolbarButton("Exportar PDF", onExportPdf, "pdf", { primary: true }),
        toolbarButton("Ayuda", () => openHelp(), "help"),
        toolbarButton("Tema", () => toggleTheme(), "contrast"),
      ],
    );

    const closeMenu = () => menu.classList.replace("flex", "hidden");
    const toggleMenu = () => (menu.classList.contains("hidden") ? menu.classList.replace("hidden", "flex") : closeMenu());

    const hamburger = el(
      "button",
      {
        type: "button",
        class: "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 md:hidden",
        "aria-label": "Abrir menú",
        onclick: (event) => {
          event.stopPropagation();
          toggleMenu();
        },
      },
      [icon("menu", "h-4 w-4"), "Menú"],
    );

    // Cierra el menú móvil al pulsar fuera de él.
    document.addEventListener("click", (event) => {
      if (menu.classList.contains("flex") && !menu.contains(event.target) && !hamburger.contains(event.target)) closeMenu();
    });

    // Deshacer/rehacer: botones compactos junto al indicador de guardado (izquierda).
    this.undoButton = historyButton("undo", "Deshacer", onUndo);
    this.redoButton = historyButton("redo", "Rehacer", onRedo);
    clear(this.historyContainer);
    this.historyContainer.append(this.undoButton, this.redoButton);

    this.toolbarContainer.append(menu, hamburger, fileInput);
  }

  // Habilita o deshabilita los botones de deshacer/rehacer según el historial.
  setHistoryState(canUndo, canRedo) {
    if (this.undoButton) this.undoButton.disabled = !canUndo;
    if (this.redoButton) this.redoButton.disabled = !canRedo;
  }

  setSaveStatus(state) {
    if (!this.statusLabel) return;
    const status = SAVE_STATUS[state] ?? SAVE_STATUS.idle;
    this.statusLabel.textContent = status.text;
    clear(this.statusIcon);
    const iconNode = status.icon();
    if (iconNode) this.statusIcon.append(iconNode);
    this.statusIcon.parentElement.className =
      `inline-flex min-w-[6.5rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${status.pill}`;
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
      el("div", { class: "space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" }, [
        sectionHeader({ step: 2, title: "Análisis", subtitle: "Título y descripción del problema.", iconName: "new" }),
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
