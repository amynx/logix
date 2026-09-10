// Navegación por etapas: convierte el análisis en un progreso guiado
// (Problema → Datos → Construcción → Cadena) y muestra UNA etapa a la vez, para
// que la interfaz se sienta como un recorrido y no como un formulario largo.
// El paso superior refleja el estado de cada etapa (✓ hecha / ● en curso /
// ○ pendiente). Solo se ocupa del DOM; el estado de completitud lo aporta el
// controlador desde el modelo.

import { el, clear } from "../utils/dom.js";
import { icon } from "./icons.js";

export const STAGES = [
  {
    id: "problema",
    label: "Problema",
    hint: "Entiende el problema y quién lo resuelve.",
    title: "El problema",
    intro: "Escribe de qué trata. Si tienes el enunciado, úsalo para identificar los datos.",
  },
  {
    id: "datos",
    label: "Datos",
    hint: "Identifica los datos que recibe el programa.",
    title: "Datos de entrada",
    intro: "Transforma lo que dice el enunciado en datos con nombre y tipo. En las actividades solo se reutilizan estos.",
  },
  {
    id: "construccion",
    label: "Construcción",
    hint: "Descompón el proceso paso a paso.",
    title: "Actividades",
    intro: "Descompón el proceso en pasos. Cada paso toma unos datos, hace algo con ellos y produce uno nuevo.",
  },
  {
    id: "cadena",
    label: "Cadena",
    hint: "Observa cómo fluye tu razonamiento.",
    title: "Cadena del análisis",
    intro: "Cómo fluye tu razonamiento: de los datos a la información final.",
  },
];

let activeStage = STAGES[0].id;
let statusById = {}; // { [stageId]: "done" | "todo" } — la activa se resalta aparte
let onChangeCb = null;

export function initStageNav({ onChange } = {}) {
  onChangeCb = onChange ?? null;
  const nav = document.getElementById("stage-nav");
  if (!nav) return; // en pruebas no existe la cabecera; las funciones quedan inertes
  attachFooters();
  renderStepper();
  goToStage(activeStage, { silent: true });
}

// Coloca en cada etapa una barra inferior de avance (Atrás / Continuar) para
// reforzar el recorrido lineal sin impedir saltar libremente desde el paso.
function attachFooters() {
  STAGES.forEach((stage, index) => {
    const wrapper = document.querySelector(`[data-stage="${stage.id}"]`);
    if (!wrapper || wrapper.querySelector("[data-stage-footer]")) return;
    const prev = STAGES[index - 1];
    const next = STAGES[index + 1];
    wrapper.append(
      el("div", { class: "mx-auto mt-8 flex max-w-[82.5rem] items-center justify-between gap-3 border-t border-[var(--lx-border-soft)] px-4 pt-4 sm:px-7", dataset: { stageFooter: "true" } }, [
        prev
          ? el("button", { type: "button", class: "inline-flex h-[34px] items-center gap-1.5 rounded-[var(--lx-r-control)] px-3 text-[13.5px] font-medium text-[var(--lx-ink-muted)] hover:bg-[var(--lx-bg)] hover:text-[var(--lx-ink-body)]", onclick: () => goToStage(prev.id) }, [icon("chevron", "h-4 w-4 rotate-90"), prev.label])
          : el("span", {}),
        next
          ? el("button", { type: "button", class: "inline-flex h-[34px] items-center gap-1.5 rounded-[var(--lx-r-control)] bg-[var(--lx-violet)] px-3.5 text-[13.5px] font-medium text-white hover:bg-[var(--lx-violet-hover)]", onclick: () => goToStage(next.id) }, ["Continuar", icon("chevron", "h-4 w-4 -rotate-90")])
          : el("span", {}),
      ]),
    );
  });
}

export function goToStage(stageId, { silent = false } = {}) {
  if (!STAGES.some((stage) => stage.id === stageId)) return;
  activeStage = stageId;
  document.querySelectorAll("[data-stage]").forEach((node) => {
    node.classList.toggle("hidden", node.dataset.stage !== stageId);
  });
  renderStepper();
  renderStageHeader();
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (!silent && onChangeCb) onChangeCb(stageId);
}

// Encabezado de la etapa: antetítulo «PASO N DE 4 · ETAPA», título y entradilla.
function renderStageHeader() {
  const host = document.getElementById("stage-header");
  if (!host) return;
  clear(host);
  const index = STAGES.findIndex((stage) => stage.id === activeStage);
  const stage = STAGES[index];
  if (!stage) return;
  host.append(
    el("div", { class: "mb-5" }, [
      el("p", { class: "text-[11.5px] font-semibold uppercase tracking-[0.09em] text-[var(--lx-violet)]" }, `Paso ${index + 1} de ${STAGES.length} · ${stage.label}`),
      el("h1", { class: "mt-1 [font-family:var(--lx-font-display)] text-[26px] font-semibold tracking-[-0.02em] text-[var(--lx-ink)]" }, stage.title),
      el("p", { class: "mt-1 max-w-[62ch] text-[14px] text-[var(--lx-ink-muted)]" }, stage.intro),
    ]),
  );
}

// Trae a la vista la etapa que contiene una sección concreta (p. ej. al saltar a
// una actividad desde un aviso, o durante una guía). Devuelve la etapa mostrada.
export function revealSection(sectionId) {
  const section = document.getElementById(sectionId);
  const wrapper = section?.closest("[data-stage]");
  if (!wrapper) return null;
  if (wrapper.dataset.stage !== activeStage) goToStage(wrapper.dataset.stage);
  return wrapper.dataset.stage;
}

// El controlador informa qué etapas están completas; la activa manda sobre su
// estado (se muestra "en curso" aunque aún no esté completa).
export function setStageStatus(map) {
  statusById = map ?? {};
  renderStepper();
}

export function getActiveStage() {
  return activeStage;
}

function renderStepper() {
  const nav = document.getElementById("stage-nav");
  if (!nav) return;
  clear(nav);

  const steps = STAGES.map((stage, index) => stepButton(stage, index));
  const withConnectors = [];
  steps.forEach((step, index) => {
    if (index > 0) withConnectors.push(el("span", { class: "mx-1.5 h-px w-4 shrink-0 bg-[var(--lx-border)] sm:w-[30px]", "aria-hidden": "true" }));
    withConnectors.push(step);
  });

  const active = STAGES.find((stage) => stage.id === activeStage);
  nav.append(
    el("div", { class: "mx-auto max-w-[82.5rem] px-4 pb-[11px] pt-[10px] sm:px-7" }, [
      el("div", { class: "flex items-center overflow-x-auto" }, withConnectors),
      active ? el("p", { class: "ml-[2px] mt-1 text-[12.5px] text-[var(--lx-ink-muted)]" }, active.hint) : null,
    ]),
  );
}

function stepButton(stage, index) {
  const isActive = stage.id === activeStage;
  const isDone = statusById[stage.id] === "done";
  // Disco de 20px: ✓ blanco sobre verde si la etapa está completa; si no, el número
  // sobre blanco con borde. La etapa actual resalta el botón (fondo/borde violeta).
  const marker = isDone
    ? el("span", { class: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[oklch(0.72_0.14_158)] text-white" }, [icon("check", "h-3 w-3")])
    : el(
        "span",
        { class: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--lx-border)] bg-[var(--lx-surface)] text-[11px] font-semibold text-[var(--lx-ink-muted)]" },
        String(index + 1),
      );
  const label = el(
    "span",
    { class: `text-[14px] ${isActive ? "font-semibold text-[var(--lx-ink)]" : isDone ? "font-medium text-[var(--lx-ink-body)]" : "text-[var(--lx-ink-muted)]"}` },
    stage.label,
  );
  return el(
    "button",
    {
      type: "button",
      dataset: { stageStep: stage.id },
      "aria-current": isActive ? "step" : null,
      class: `group flex shrink-0 items-center gap-2 rounded-[var(--lx-r-control)] border px-[11px] py-[6px] transition ${
        isActive
          ? "border-[oklch(0.90_0.04_300)] bg-[oklch(0.972_0.018_300)]"
          : "border-transparent hover:bg-[var(--lx-bg)]"
      }`,
      onclick: () => goToStage(stage.id),
    },
    [marker, label],
  );
}
