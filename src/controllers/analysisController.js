// Controlador del análisis: mantiene la única fuente de verdad (el análisis
// actual) y coordina el flujo acción → estado → (persistencia) → vista.
// La persistencia y el auto-guardado se conectan en pasos posteriores.

import { createAnalysis, updateAnalysisInfo } from "../models/analysisModel.js";

export class AnalysisController {
  constructor({ analysisView }) {
    this.analysisView = analysisView;
    this.analysis = createAnalysis();
  }

  start() {
    this.render();
  }

  render() {
    this.analysisView.renderInfo(this.analysis, {
      onTitleChange: (title) => this.updateInfo({ title }),
      onDescriptionChange: (description) => this.updateInfo({ description }),
    });
  }

  updateInfo(changes) {
    updateAnalysisInfo(this.analysis, changes);
    // El título y la descripción ya están reflejados en el DOM por el propio
    // input, de modo que no se vuelve a renderizar para no perder el foco.
  }
}
