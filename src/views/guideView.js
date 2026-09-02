// Guía de inicio: un recorrido paso a paso que resalta cada sección y explica qué
// hace, para qué sirve y por qué existe. Es una tarjeta flotante que no bloquea la
// interfaz. Se muestra en la primera visita y puede reabrirse desde la Ayuda.

import { el, clear } from "../utils/dom.js";

const GUIDE_SEEN_KEY = "logix-guide-seen";

const STEPS = [
  {
    title: "Bienvenido a Logix",
    target: null,
    body: "Logix te ayuda a analizar un problema antes de diseñar su algoritmo: identificas los datos, descompones el proceso en pasos y ves cómo se encadena todo. Esta guía recorre cada sección.",
  },
  {
    title: "1 · Estudiantes",
    target: "students-container",
    body: "Registra el grupo (común a todos) y los estudiantes que participan. Sirve para identificar quién realiza el análisis; se incluye al exportar el PDF.",
  },
  {
    title: "2 · Análisis",
    target: "analysis-info",
    body: "Escribe el título y describe el problema del mundo real que vas a resolver. Enmarca el análisis: qué necesidad debe atender el programa.",
  },
  {
    title: "3 · Datos de entrada",
    target: "inputs-container",
    body: "Identifica los datos que el programa recibe (nombre y tipo). Se declaran una vez aquí y luego se reutilizan en las actividades, evitando reescribirlos y cometer errores.",
  },
  {
    title: "4 · Actividades",
    target: "table-container",
    body: "Es el corazón del análisis: descompones el proceso en pasos. En cada uno defines las entradas, una operación o condición y el dato resultante; en las decisiones, los caminos a seguir.",
  },
  {
    title: "5 · Cadena del análisis",
    target: "chain-container",
    body: "Visualiza el análisis completo como un flujo: qué entra, cómo se procesa y qué sale. Te permite revisar de un vistazo que todo esté encadenado.",
  },
  {
    title: "¡Listo para empezar!",
    target: null,
    body: "Pulsa «Ejemplo» para ver un caso completo, usa «Ayuda» o los «?» de cada sección cuando tengas dudas, y recuerda que puedes deshacer con Ctrl+Z. ¡A analizar!",
  },
];

// Abre la guía si el estudiante no la ha visto todavía.
export function maybeStartGuide() {
  let seen = false;
  try {
    seen = localStorage.getItem(GUIDE_SEEN_KEY) === "1";
  } catch {
    seen = false;
  }
  if (!seen) startGuide();
}

// Abre la guía de inicio. Si ya está abierta, no abre otra.
export function startGuide() {
  if (document.getElementById("guide-card")) return;
  let index = 0;

  const card = el("div", {
    id: "guide-card",
    class: "fixed bottom-6 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl",
    role: "dialog",
    "aria-label": "Guía de inicio",
  });

  const clearHighlight = () => document.querySelectorAll(".guide-highlight").forEach((node) => node.classList.remove("guide-highlight"));

  const close = () => {
    clearHighlight();
    card.remove();
    document.removeEventListener("keydown", onKey);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {
      // localStorage puede no estar disponible; no pasa nada.
    }
  };

  const onKey = (event) => {
    if (event.key === "Escape") close();
  };

  const render = () => {
    const step = STEPS[index];
    clearHighlight();
    if (step.target) {
      const section = document.getElementById(step.target);
      if (section) {
        section.classList.add("guide-highlight");
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    const isLast = index === STEPS.length - 1;
    clear(card);
    card.append(
      el("div", { class: "mb-2 flex items-start justify-between gap-3" }, [
        el("h2", { class: "text-base font-semibold text-slate-900" }, step.title),
        el("button", { type: "button", class: "rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700", title: "Cerrar guía", "aria-label": "Cerrar guía", onclick: close }, "✕"),
      ]),
      el("p", { class: "text-sm leading-relaxed text-slate-600" }, step.body),
      el("div", { class: "mt-4 flex items-center justify-between" }, [
        el("div", { class: "flex gap-1" }, STEPS.map((_, i) => el("span", { class: `h-1.5 w-1.5 rounded-full ${i === index ? "bg-indigo-600" : "bg-slate-300"}` }))),
        el("div", { class: "flex gap-2" }, [
          el("button", {
            type: "button",
            class: "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40",
            disabled: index === 0 || null,
            onclick: () => { index -= 1; render(); },
          }, "Anterior"),
          el("button", {
            type: "button",
            class: "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700",
            onclick: () => { if (isLast) close(); else { index += 1; render(); } },
          }, isLast ? "Empezar" : "Siguiente"),
        ]),
      ]),
    );
  };

  document.body.append(card);
  document.addEventListener("keydown", onKey);
  render();
}
