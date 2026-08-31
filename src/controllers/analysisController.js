// Controlador del análisis: mantiene la única fuente de verdad (el análisis
// actual) y coordina el flujo acción → estado → persistencia → vista.
// El auto-guardado es con debounce para no escribir en IndexedDB en cada tecla.

import {
  createAnalysis,
  addRow,
  removeRow,
  moveRow,
  updateRow,
  updateAnalysisInfo,
  updateData,
  addRowInput,
  addExistingRowInput,
  removeRowInput,
  updateRowResult,
} from "../models/analysisModel.js";
import { confirmDialog, messageDialog } from "../views/dialogs.js";
import { exportAnalysis, importAnalysis } from "../services/file/fileService.js";
import { collectAnalysisWarnings } from "../validation/analysisValidation.js";

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
    this.analysisView.renderToolbar({
      onNew: () => this.newAnalysis(),
      onOpenFile: (file) => this.openFile(file),
      onSaveFile: () => this.saveToFile(),
    });
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
      onDataChange: (dataId, changes) => this.updateData(dataId, changes),
      onResultChange: (rowId, changes) => this.updateResult(rowId, changes),
      onAddRowInput: (rowId) => this.addRowInput(rowId),
      onReuseInput: (rowId, dataId) => this.reuseInput(rowId, dataId),
      onRemoveRowInput: (rowId, dataId) => this.removeRowInput(rowId, dataId),
    });
  }

  // Edición de nombre/tipo de un dato: el valor ya está en el DOM; no se re-renderiza.
  updateData(dataId, changes) {
    updateData(this.analysis, dataId, changes);
    this.#scheduleSave();
  }

  // El dato resultante se crea de forma diferida leyendo el resultId actual de la fila.
  updateResult(rowId, changes) {
    updateRowResult(this.analysis, rowId, changes);
    this.#scheduleSave();
  }

  // Añadir/quitar una entrada cambia los controles visibles: se re-renderiza.
  addRowInput(rowId) {
    addRowInput(this.analysis, rowId);
    this.renderTable();
    this.#scheduleSave();
  }

  reuseInput(rowId, dataId) {
    addExistingRowInput(this.analysis, rowId, dataId);
    this.renderTable();
    this.#scheduleSave();
  }

  removeRowInput(rowId, dataId) {
    removeRowInput(this.analysis, rowId, dataId);
    this.renderTable();
    this.#scheduleSave();
  }

  updateInfo(changes) {
    updateAnalysisInfo(this.analysis, changes);
    this.#scheduleSave();
  }

  updateRowField(rowId, updater) {
    const changes = this.#resolveRowChanges(rowId, updater);
    if (!changes) return;
    updateRow(this.analysis, rowId, changes);
    this.#scheduleSave();
  }

  updateRowStructure(rowId, updater) {
    const changes = this.#resolveRowChanges(rowId, updater);
    if (!changes) return;
    updateRow(this.analysis, rowId, changes);
    this.renderTable();
    this.#scheduleSave();
  }

  // Resuelve el actualizador contra la fila actual del modelo, de modo que cada
  // cambio parta del estado fresco y no de una copia capturada en el render.
  #resolveRowChanges(rowId, updater) {
    const row = this.analysis.rows.find((candidate) => candidate.id === rowId);
    return row ? updater(row) : null;
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

  // Reemplaza el análisis actual y refresca vista y persistencia. Es el punto
  // único por el que entra un análisis nuevo, importado o recuperado.
  loadAnalysis(analysis) {
    this.analysis = analysis;
    this.render();
    this.#scheduleSave();
  }

  newAnalysis() {
    const analysis = createAnalysis();
    addRow(analysis);
    this.loadAnalysis(analysis);
  }

  async saveToFile() {
    const warnings = collectAnalysisWarnings(this.analysis);
    if (warnings.length > 0) {
      const proceed = await confirmDialog({
        title: "Revisa el análisis antes de guardar",
        message: "Hay algunos puntos por completar. Puedes guardarlo igualmente:",
        details: warnings,
        confirmLabel: "Guardar de todos modos",
        cancelLabel: "Revisar",
      });
      if (!proceed) return;
    }
    exportAnalysis(this.analysis);
  }

  async openFile(file) {
    try {
      const analysis = await importAnalysis(file);
      this.loadAnalysis(analysis);
    } catch (error) {
      // Aviso informativo: no se bloquea el flujo esperando a que se cierre.
      messageDialog({ title: "No se pudo abrir el análisis", message: error.message });
    }
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
