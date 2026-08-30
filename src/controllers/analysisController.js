// Controlador del análisis: mantiene la única fuente de verdad (el análisis
// actual) y coordina el flujo acción → estado → persistencia → vista.
// El auto-guardado es con debounce para no escribir en IndexedDB en cada tecla.

import { createAnalysis, addRow, removeRow, moveRow, updateRow, updateAnalysisInfo } from "../models/analysisModel.js";
import { confirmDialog } from "../views/confirmDialog.js";

const DEFAULT_SAVE_DELAY = 500;

export class AnalysisController {
  #saveTimer = null;

  constructor({ analysisView, tableView, storage, saveDelay = DEFAULT_SAVE_DELAY }) {
    this.analysisView = analysisView;
    this.tableView = tableView;
    this.storage = storage;
    this.saveDelay = saveDelay;
    this.analysis = null;
  }

  async start() {
    this.analysisView.renderToolbar();
    this.analysis = await this.#recoverOrCreate();
    this.render();
  }

  render() {
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
      onMoveRow: (fromRowId, toRowId) => this.moveRow(fromRowId, toRowId),
    });
  }

  updateInfo(changes) {
    updateAnalysisInfo(this.analysis, changes);
    this.#scheduleSave();
  }

  updateRowField(rowId, changes) {
    updateRow(this.analysis, rowId, changes);
    this.#scheduleSave();
  }

  updateRowStructure(rowId, changes) {
    updateRow(this.analysis, rowId, changes);
    this.renderTable();
    this.#scheduleSave();
  }

  addRow() {
    addRow(this.analysis);
    this.renderTable();
    this.#scheduleSave();
  }

  async deleteRow(rowId) {
    const confirmed = await confirmDialog({
      title: "Eliminar fila",
      message: "Se eliminará esta fila del análisis. Esta acción no se puede deshacer.",
    });
    if (!confirmed) return;
    removeRow(this.analysis, rowId);
    this.renderTable();
    this.#scheduleSave();
  }

  moveRow(fromRowId, toRowId) {
    const { rows } = this.analysis;
    const fromIndex = rows.findIndex((row) => row.id === fromRowId);
    const toIndex = rows.findIndex((row) => row.id === toRowId);
    if (fromIndex === -1 || toIndex === -1) return;
    moveRow(this.analysis, fromIndex, toIndex);
    this.renderTable();
    this.#scheduleSave();
  }

  // Recupera el análisis más reciente guardado localmente; si no hay ninguno,
  // crea uno nuevo con una fila lista para editar.
  async #recoverOrCreate() {
    try {
      const stored = await this.storage.getAllAnalyses();
      if (stored && stored.length > 0) {
        return stored.reduce((latest, item) => (item.updatedAt > latest.updatedAt ? item : latest));
      }
    } catch (error) {
      console.error("No se pudo recuperar el análisis guardado:", error);
    }
    const analysis = createAnalysis();
    addRow(analysis);
    return analysis;
  }

  #scheduleSave() {
    this.analysisView.setSaveStatus("saving");
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.#save(), this.saveDelay);
  }

  async #save() {
    try {
      await this.storage.saveAnalysis(this.analysis);
      this.analysisView.setSaveStatus("saved");
    } catch (error) {
      console.error("No se pudo guardar automáticamente:", error);
      this.analysisView.setSaveStatus("error");
    }
  }
}
