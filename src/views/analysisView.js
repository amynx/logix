// Vista de la cabecera del análisis: barra de herramientas e información
// editable (título y descripción). Solo se ocupa del DOM; no conoce el modelo
// ni la persistencia. Recibe callbacks y notifica los cambios del usuario.

import { el, clear } from "../utils/dom.js";
import { icon } from "./icons.js";
import { sectionHeader } from "./sectionHeader.js";
import { openHelp } from "./helpView.js";
import { startExampleTutorial } from "./guideView.js";
import { toggleTheme } from "../utils/theme.js";
import { trackEvent } from "../utils/analytics.js";
import { capitalizeFirst } from "../models/textNormalization.js";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm " +
  "text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

const LABEL_CLASS = "block text-sm font-medium text-slate-700";
const HELP_CLASS = "mt-1 text-xs text-slate-500";

// Acorta un fragmento largo para mostrarlo en una etiqueta.
function truncate(text, max = 40) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Botón en línea de la barra (escritorio): fantasma o primario (índigo sólido).
function barButton(label, onClick, iconName, { primary = false } = {}) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium";
  const variant = primary
    ? "bg-indigo-600 text-white hover:bg-indigo-700"
    : "border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";
  return el("button", { type: "button", class: `${base} ${variant}`, onclick: onClick }, [
    iconName ? icon(iconName, "h-4 w-4") : null,
    label,
  ]);
}

// Botón solo-icono de la barra (p. ej. Tema).
function iconBarButton(iconName, label, onClick) {
  return el(
    "button",
    {
      type: "button",
      class: "inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700",
      title: label,
      "aria-label": label,
      onclick: onClick,
    },
    [icon(iconName, "h-4 w-4")],
  );
}

// Opción a todo el ancho para un menú desplegable (Archivo / menú móvil).
function menuItem(label, onClick, iconName) {
  return el(
    "button",
    {
      type: "button",
      class: "inline-flex w-full items-center justify-start gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700",
      onclick: onClick,
    },
    [iconName ? icon(iconName, "h-4 w-4") : null, label],
  );
}

// Menú desplegable: el disparador abre un panel de opciones. Cierra al elegir una,
// pulsar fuera o volver a pulsar el disparador. `align` fija el borde del panel.
function dropdownMenu(trigger, items, { align = "right" } = {}) {
  const panel = el(
    "div",
    {
      class: `absolute ${align === "left" ? "left-0" : "right-0"} top-full z-30 mt-1 hidden w-56 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg`,
      onclick: (event) => {
        if (event.target.closest("button")) close();
      },
    },
    items,
  );
  const close = () => panel.classList.replace("flex", "hidden");
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    panel.classList.contains("hidden") ? panel.classList.replace("hidden", "flex") : close();
  });
  const wrapper = el("div", { class: "relative" }, [trigger, panel]);
  document.addEventListener("click", (event) => {
    if (panel.classList.contains("flex") && !wrapper.contains(event.target)) close();
  });
  return wrapper;
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
    // La etiqueta se oculta en móvil (solo el icono) para no desbordar la cabecera.
    this.statusLabel = el("span", { class: "hidden md:inline" }, "");
    this.statusContainer.append(
      el("span", { class: "inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors md:min-w-[6.5rem] md:px-2.5" }, [
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

    const toggleThemeTracked = () => trackEvent("toggle_theme", { dark: toggleTheme() });

    // Barra de escritorio: las acciones de archivo se agrupan en "Archivo" y las
    // acciones clave quedan a la vista.
    const archivoTrigger = el(
      "button",
      { type: "button", class: "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700" },
      [icon("folder", "h-4 w-4"), "Archivo", icon("chevron", "h-3.5 w-3.5")],
    );
    const archivo = dropdownMenu(
      archivoTrigger,
      [
        menuItem("Nuevo análisis", onNew, "new"),
        menuItem("Abrir análisis", () => fileInput.click(), "open"),
        menuItem("Guardar archivo", onSaveFile, "save"),
      ],
      { align: "left" },
    );
    const desktopBar = el("div", { class: "hidden items-center gap-2 md:flex" }, [
      archivo,
      barButton("Exportar PDF", onExportPdf, "pdf", { primary: true }),
      barButton("Ejemplo guiado", () => startExampleTutorial(), "example"),
      barButton("Ayuda", () => openHelp(), "help"),
      iconBarButton("contrast", "Tema", toggleThemeTracked),
    ]);

    // Menú móvil: una hamburguesa con todas las acciones en una lista plana.
    const hamburger = el(
      "button",
      { type: "button", class: "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50", "aria-label": "Abrir menú" },
      [icon("menu", "h-4 w-4"), "Menú"],
    );
    const mobileMenu = dropdownMenu(hamburger, [
      menuItem("Nuevo análisis", onNew, "new"),
      menuItem("Abrir análisis", () => fileInput.click(), "open"),
      menuItem("Guardar archivo", onSaveFile, "save"),
      menuItem("Exportar PDF", onExportPdf, "pdf"),
      menuItem("Ejemplo guiado", () => startExampleTutorial(), "example"),
      menuItem("Ayuda", () => openHelp(), "help"),
      menuItem("Tema", toggleThemeTracked, "contrast"),
    ]);
    mobileMenu.classList.add("md:hidden");

    // Deshacer/rehacer: botones compactos junto al indicador de guardado (izquierda).
    this.undoButton = historyButton("undo", "Deshacer", onUndo);
    this.redoButton = historyButton("redo", "Rehacer", onRedo);
    clear(this.historyContainer);
    this.historyContainer.append(this.undoButton, this.redoButton);

    this.toolbarContainer.append(desktopBar, mobileMenu, fileInput);
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
      `inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors md:min-w-[6.5rem] md:px-2.5 ${status.pill}`;
  }

  renderInfo(analysis, { onTitleChange, onDescriptionChange, onStatementChange, onAddDataFromSelection, isFragmentAdded, showStatement, onToggleStatement }) {
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
      // Capitaliza la presentación al desenfocar, sin interrumpir la escritura.
      onblur: (event) => {
        const normalized = capitalizeFirst(event.target.value);
        if (normalized !== event.target.value) {
          event.target.value = normalized;
          onDescriptionChange(normalized);
        }
      },
    });

    // Enunciado del problema: el texto sobre el que se identifican los datos. El
    // textarea crece con el contenido (conserva saltos de línea y párrafos) hasta
    // un máximo, para que un enunciado largo no quede apretado.
    const statement = el("textarea", {
      id: "analysis-statement",
      value: analysis.statement,
      placeholder: "Pega aquí el enunciado completo del problema. Luego selecciona un fragmento (p. ej. «500 unidades») para agregarlo como dato de entrada.",
      class: `${INPUT_CLASS} min-h-[7rem] max-h-[36rem] resize-none overflow-y-auto leading-relaxed`,
      oninput: (event) => {
        onStatementChange(event.target.value);
        autoGrow();
      },
      onmouseup: () => updateSelectionBar(),
      onkeyup: () => updateSelectionBar(),
      onselect: () => updateSelectionBar(),
    });
    const autoGrow = () => {
      statement.style.height = "auto";
      statement.style.height = `${statement.scrollHeight}px`;
    };

    const selectionBar = el("div", { class: "mt-2 flex min-h-[2rem] items-center" });
    const selectedFragment = () => statement.value.substring(statement.selectionStart, statement.selectionEnd).trim();

    const updateSelectionBar = () => {
      clear(selectionBar);
      const fragment = selectedFragment();
      if (!fragment) {
        selectionBar.append(el("span", { class: "text-xs text-slate-400" }, "Selecciona un fragmento del enunciado para agregarlo como dato de entrada."));
        return;
      }
      if (isFragmentAdded(fragment)) {
        selectionBar.append(el("span", { class: "inline-flex items-center gap-1.5 text-xs text-emerald-600" }, [icon("check", "h-3.5 w-3.5"), `«${truncate(fragment)}» ya está en Datos de entrada.`]));
        return;
      }
      selectionBar.append(
        el(
          "button",
          {
            type: "button",
            class: "inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-100",
            // Evita que el botón robe el foco y pierda la selección del textarea.
            onmousedown: (event) => event.preventDefault(),
            onclick: () => {
              onAddDataFromSelection(selectedFragment());
              updateSelectionBar();
            },
          },
          [icon("data", "h-4 w-4"), `Agregar «${truncate(fragment)}» como dato de entrada`],
        ),
      );
    };

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
        el("div", {}, [
          el("label", { class: "flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700" }, [
            el("input", { type: "checkbox", checked: showStatement || null, class: "h-4 w-4 rounded border-slate-300", onchange: () => onToggleStatement() }),
            "Usar el enunciado del problema para identificar los datos (opcional)",
          ]),
          el("p", { class: HELP_CLASS }, "Pega el enunciado completo y selecciona fragmentos para agregarlos como datos de entrada. Si no lo necesitas, déjalo desactivado."),
          showStatement
            ? el("div", { class: "mt-2" }, [statement, selectionBar])
            : null,
        ]),
      ]),
    );

    if (showStatement) {
      updateSelectionBar();
      autoGrow();
    }
  }
}
