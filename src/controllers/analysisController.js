// Controlador del análisis: mantiene la única fuente de verdad (el análisis
// actual) y coordina el flujo acción → estado → (persistencia) → vista.
// La persistencia y el auto-guardado se conectan en pasos posteriores.

import { createAnalysis, addRow, removeRow, updateRow, updateAnalysisInfo } from "../models/analysisModel.js";
import { confirmDialog } from "../views/confirmDialog.js";

export class AnalysisController {
  constructor({ analysisView, tableView }) {
    this.analysisView = analysisView;
    this.tableView = tableView;
    this.analysis = createAnalysis();
    addRow(this.analysis); // comenzar con una fila lista para editar
  }

  start() {
    this.renderInfo();
    this.renderTable();
  }

  renderInfo() {
    this.analysisView.renderInfo(this.analysis, {
      onTitleChange: (title) => this.updateInfo({ title }),
      onDescriptionChange: (description) => this.updateInfo({ description }),
    });
  }

  renderTable() {
    this.tableView.render(this.analysis, {
      onFieldChange: (rowId, changes) => this.updateRowField(rowId, changes),
      onStructuralChange: (rowId, changes) => this.updateRowStructure(rowId, changes),
      onAddRow: () => this.addRow(),
      onDeleteRow: (rowId) => this.deleteRow(rowId),
    });
  }

  addRow() {
    addRow(this.analysis);
    this.renderTable();
  }

  async deleteRow(rowId) {
    const confirmed = await confirmDialog({
      title: "Eliminar fila",
      message: "Se eliminará esta fila del análisis. Esta acción no se puede deshacer.",
    });
    if (!confirmed) return;
    removeRow(this.analysis, rowId);
    this.renderTable();
  }

  updateInfo(changes) {
    updateAnalysisInfo(this.analysis, changes);
    // El DOM ya refleja el valor escrito; no se re-renderiza para no perder el foco.
  }

  // Cambio que no altera qué controles se muestran: el DOM ya está actualizado.
  updateRowField(rowId, changes) {
    updateRow(this.analysis, rowId, changes);
  }

  // Cambio que altera la estructura de la fila (propósito, datos de entrada):
  // se re-renderiza la tabla para reflejar los controles disponibles.
  updateRowStructure(rowId, changes) {
    updateRow(this.analysis, rowId, changes);
    this.renderTable();
  }
}
