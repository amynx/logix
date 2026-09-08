// Navegación por etapas: convierte el análisis en un progreso guiado
// (Problema → Datos → Construcción → Cadena) y muestra UNA etapa a la vez, para
// que la interfaz se sienta como un recorrido y no como un formulario largo.
// El paso superior refleja el estado de cada etapa (✓ hecha / ● en curso /
// ○ pendiente). Solo se ocupa del DOM; el estado de completitud lo aporta el
// controlador desde el modelo.

import { el, clear } from "../utils/dom.js";
import { icon } from "./icons.js";

export const STAGES = [
  { id: "problema", label: "Problema", hint: "Entiende el problema y quién lo resuelve." },
  { id: "datos", label: "Datos", hint: "Identifica los datos que recibe el programa." },
  { id: "construccion", label: "Construcción", hint: "Descompón el proceso paso a paso." },
  { id: "cadena", label: "Cadena", hint: "Observa cómo fluye tu razonamiento." },
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
      el("div", { class: "mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-4", dataset: { stageFooter: "true" } }, [
        prev
          ? el("button", { type: "button", class: "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700", onclick: () => goToStage(prev.id) }, [icon("chevron", "h-4 w-4 rotate-90"), prev.label])
          : el("span", {}),
        next
          ? el("button", { type: "button", class: "inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700", onclick: () => goToStage(next.id) }, ["Continuar", icon("chevron", "h-4 w-4 -rotate-90")])
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
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (!silent && onChangeCb) onChangeCb(stageId);
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
    if (index > 0) withConnectors.push(el("span", { class: "mx-1 h-px w-4 shrink-0 bg-slate-200 sm:w-8", "aria-hidden": "true" }));
    withConnectors.push(step);
  });

  const active = STAGES.find((stage) => stage.id === activeStage);
  nav.append(
    el("div", { class: "mx-auto max-w-[100rem] px-4 py-2" }, [
      el("div", { class: "flex items-center overflow-x-auto" }, withConnectors),
      active ? el("p", { class: "mt-0.5 text-xs text-slate-400" }, active.hint) : null,
    ]),
  );
}

function stepButton(stage, index) {
  const isActive = stage.id === activeStage;
  const isDone = statusById[stage.id] === "done";
  // El marcador combina estado y número: ✓ hecha, ● activa, número si pendiente.
  const marker = isDone
    ? el("span", { class: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" }, [icon("check", "h-3.5 w-3.5")])
    : el(
        "span",
        {
          class: `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            isActive ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-400"
          }`,
        },
        String(index + 1),
      );
  const label = el(
    "span",
    { class: `text-sm ${isActive ? "font-semibold text-slate-900" : isDone ? "font-medium text-slate-600" : "text-slate-400"}` },
    stage.label,
  );
  return el(
    "button",
    {
      type: "button",
      dataset: { stageStep: stage.id },
      "aria-current": isActive ? "step" : null,
      class: `group flex shrink-0 items-center gap-2 rounded-md px-2 py-1 transition hover:bg-slate-100 ${isActive ? "bg-indigo-50/60" : ""}`,
      onclick: () => goToStage(stage.id),
    },
    [marker, label],
  );
}
