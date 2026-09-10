// Vista de la cabecera del análisis: barra de herramientas e información
// editable (título y descripción). Solo se ocupa del DOM; no conoce el modelo
// ni la persistencia. Recibe callbacks y notifica los cambios del usuario.

import { el, clear } from "../utils/dom.js";
import { icon } from "./icons.js";
import { openHelp } from "./helpView.js";
import { startExampleTutorial } from "./guideView.js";
import { toggleTheme } from "../utils/theme.js";
import { trackEvent } from "../utils/analytics.js";
import { capitalizeFirst } from "../models/textNormalization.js";
import { attachMentions } from "./mentionMenu.js";
import { goToStage } from "./stageNav.js";

const INPUT_CLASS =
  "w-full rounded-[var(--lx-r-field)] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-[13px] py-[10px] " +
  "text-[14.5px] text-[var(--lx-ink)] outline-none placeholder:text-[var(--lx-ink-ghost)] " +
  "focus:border-[oklch(0.72_0.09_300)] focus:ring-2 focus:ring-[oklch(0.90_0.05_300)]";

const LABEL_CLASS = "block text-[13px] font-medium text-[var(--lx-ink-body)]";
const HELP_CLASS = "mt-1 text-[12.5px] text-[var(--lx-ink-muted)]";
// Tarjeta base del rediseño (superficie, borde y sombra por token).
const CARD_CLASS = "rounded-[var(--lx-r-card)] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5 shadow-[var(--lx-shadow-card)]";

// Acorta un fragmento largo para mostrarlo en una etiqueta.
function truncate(text, max = 40) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Estilos base de la barra (tokens del rediseño): botón de 34px, radio 9px.
const BAR_BTN_BASE = "inline-flex h-[34px] items-center gap-1.5 rounded-[var(--lx-r-control)] px-3 text-[13.5px] font-medium";
const BAR_GHOST = `${BAR_BTN_BASE} border border-[var(--lx-border)] bg-[var(--lx-surface)] text-[var(--lx-ink-body)] hover:bg-[var(--lx-bg)]`;
const BAR_PRIMARY = `${BAR_BTN_BASE} bg-[var(--lx-violet)] text-white hover:bg-[var(--lx-violet-hover)]`;

// Botón en línea de la barra (escritorio): fantasma o primario (violeta sólido).
function barButton(label, onClick, iconName, { primary = false } = {}) {
  return el("button", { type: "button", class: primary ? BAR_PRIMARY : BAR_GHOST, onclick: onClick }, [
    iconName ? icon(iconName, "h-4 w-4") : null,
    label,
  ]);
}

// Botón cuadrado solo-icono de la barra (p. ej. Tema).
function iconBarButton(iconName, label, onClick) {
  return el(
    "button",
    {
      type: "button",
      class: "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[var(--lx-r-control)] border border-[var(--lx-border)] bg-[var(--lx-surface)] text-[var(--lx-ink-body)] hover:bg-[var(--lx-bg)]",
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
      class: "inline-flex w-full items-center justify-start gap-1.5 rounded-[var(--lx-r-control)] px-3 py-1.5 text-[13.5px] font-medium text-[var(--lx-ink-body)] hover:bg-[var(--lx-bg)] hover:text-[var(--lx-violet)]",
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
      class: `absolute ${align === "left" ? "left-0" : "right-0"} top-full z-30 mt-1 hidden w-56 flex-col gap-1 rounded-[var(--lx-r-panel)] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-2 shadow-[var(--lx-shadow-pop)]`,
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
      class: "inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] text-[var(--lx-ink-body)] hover:bg-[var(--lx-bg)] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-[var(--lx-ink-ghost)]",
      title: label,
      "aria-label": label,
      onclick: onClick,
    },
    [icon(iconName, "h-4 w-4")],
  );
}

const SAVE_STATUS = {
  idle: { text: "", pill: "text-transparent", icon: () => null },
  saving: { text: "Guardando…", pill: "bg-[var(--lx-surface-sunken)] text-[var(--lx-ink-muted)]", icon: spinner },
  saved: { text: "Guardado", pill: "border border-[var(--lx-resultante-border)] bg-[var(--lx-resultante-bg)] text-[var(--lx-resultante-fg)]", icon: () => icon("check", "h-3.5 w-3.5") },
  error: { text: "Sin guardar", pill: "border border-[oklch(0.90_0.05_25)] bg-[oklch(0.96_0.02_25)] text-[oklch(0.55_0.15_25)]", icon: dot },
};

// Pequeño anillo giratorio para el estado "Guardando…".
function spinner() {
  return el("span", { class: "h-3 w-3 animate-spin rounded-full border-2 border-[var(--lx-border)] border-t-[var(--lx-ink-muted)]" });
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
      { type: "button", class: BAR_GHOST },
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
      barButton("Guía", () => window.open("guia.html", "_blank", "noopener"), "book"),
      barButton("Ayuda", () => openHelp(), "help"),
      iconBarButton("contrast", "Tema", toggleThemeTracked),
    ]);

    // Menú móvil: una hamburguesa con todas las acciones en una lista plana.
    const hamburger = el(
      "button",
      { type: "button", class: BAR_GHOST, "aria-label": "Abrir menú" },
      [icon("menu", "h-4 w-4"), "Menú"],
    );
    const mobileMenu = dropdownMenu(hamburger, [
      menuItem("Nuevo análisis", onNew, "new"),
      menuItem("Abrir análisis", () => fileInput.click(), "open"),
      menuItem("Guardar archivo", onSaveFile, "save"),
      menuItem("Exportar PDF", onExportPdf, "pdf"),
      menuItem("Ejemplo guiado", () => startExampleTutorial(), "example"),
      menuItem("Guía", () => window.open("guia.html", "_blank", "noopener"), "book"),
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

  renderInfo(analysis, { onTitleChange, onDescriptionChange, onStatementChange, onAddDataFromSelection, isFragmentAdded, showStatement, onToggleStatement, getDataMentions }) {
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
    if (getDataMentions) attachMentions(description, getDataMentions);

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
        selectionBar.append(el("span", { class: "text-[12.5px] text-[var(--lx-ink-muted)]" }, "Selecciona un fragmento del enunciado para agregarlo como dato de entrada."));
        return;
      }
      if (isFragmentAdded(fragment)) {
        selectionBar.append(el("span", { class: "inline-flex items-center gap-1.5 text-[12.5px] text-[var(--lx-resultante-fg)]" }, [icon("check", "h-3.5 w-3.5"), `«${truncate(fragment)}» ya está en Datos de entrada.`]));
        return;
      }
      selectionBar.append(
        el(
          "button",
          {
            type: "button",
            class: "inline-flex items-center gap-1.5 rounded-[var(--lx-r-control)] border border-[var(--lx-entrada-border)] bg-[var(--lx-entrada-bg)] px-2.5 py-1 text-[13px] font-medium text-[var(--lx-entrada-fg)] hover:brightness-95",
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

    // Casilla-botón "Tengo el enunciado del problema": una fila completa con un
    // cuadro que se rellena de violeta y muestra ✓ cuando está activa.
    const statementToggle = el(
      "button",
      {
        type: "button",
        class: "flex w-full items-center gap-2.5 rounded-[var(--lx-r-field)] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 py-2.5 text-left text-[13.5px] font-medium text-[var(--lx-ink-body)] hover:bg-[var(--lx-bg)]",
        "aria-pressed": String(Boolean(showStatement)),
        onclick: () => onToggleStatement(),
      },
      [
        el(
          "span",
          { class: `flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border ${showStatement ? "border-[var(--lx-violet)] bg-[var(--lx-violet)] text-white" : "border-[var(--lx-border)]"}` },
          showStatement ? [icon("check", "h-3 w-3")] : [],
        ),
        "Tengo el enunciado del problema",
      ],
    );

    // Recuento de fragmentos ya convertidos en datos de entrada (llevan `source`).
    const addedCount = analysis.data.filter((entry) => (entry.source ?? "").trim()).length;
    const statementFooter = el("div", { class: "mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px]" }, [
      el("span", { class: "text-[var(--lx-ink-muted)]" }, addedCount > 0 ? `${addedCount} ${addedCount === 1 ? "fragmento agregado" : "fragmentos agregados"} como datos` : "Aún no has agregado fragmentos."),
      el("button", { type: "button", class: "inline-flex items-center gap-1 font-medium text-[var(--lx-violet)] hover:underline", onclick: () => goToStage("datos") }, ["Ver los datos", icon("chevron", "h-3.5 w-3.5 -rotate-90")]),
    ]);

    // Izquierda: "De qué trata" (título y descripción). Derecha: "El enunciado".
    const numeral = (n) => el("span", { class: "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--lx-surface-sunken)] text-[11px] font-semibold text-[var(--lx-ink-muted)]" }, String(n));
    const cardTitle = (n, text) => el("div", { class: "mb-4 flex items-center gap-2" }, [numeral(n), el("h2", { class: "[font-family:var(--lx-font-display)] text-[16px] font-semibold tracking-[-0.01em] text-[var(--lx-ink)]" }, text)]);

    const leftCard = el("div", { class: `flex-1 basis-[380px] ${CARD_CLASS}` }, [
      cardTitle(1, "De qué trata"),
      el("div", { class: "space-y-4" }, [
        el("div", {}, [
          el("label", { for: "analysis-title", class: LABEL_CLASS }, "Título del análisis"),
          el("div", { class: "mt-1.5" }, [title]),
        ]),
        el("div", {}, [
          el("label", { for: "analysis-description", class: LABEL_CLASS }, "Descripción del problema"),
          el("div", { class: "mt-1.5" }, [description]),
          el("p", { class: HELP_CLASS }, "Contexto general: qué necesidad debe resolver el programa."),
        ]),
      ]),
    ]);

    const rightCard = el("div", { class: `flex-[1.3] basis-[440px] ${CARD_CLASS} border-[oklch(0.90_0.03_300)]` }, [
      cardTitle(2, "El enunciado"),
      statementToggle,
      showStatement
        ? el("div", { class: "mt-3 space-y-2" }, [statement, selectionBar, statementFooter])
        : el("p", { class: HELP_CLASS + " mt-3" }, "Si lo activas, podrás pegar el enunciado y seleccionar fragmentos para convertirlos en datos de entrada. Si no, los declararás a mano en la etapa Datos."),
    ]);

    this.infoContainer.append(el("div", { class: "flex flex-wrap items-start gap-[22px]" }, [leftCard, rightCard]));

    if (showStatement) {
      updateSelectionBar();
      autoGrow();
    }
  }
}
