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
  findData,
  rowsUsingData,
} from "../models/analysisModel.js";
import { confirmDialog, messageDialog } from "../views/dialogs.js";
import { exportAnalysis, importAnalysis } from "../services/file/fileService.js";
import { collectAnalysisWarnings } from "../validation/analysisValidation.js";
import { buildChain } from "../models/chainModel.js";
import { inferResultType } from "../models/operators.js";

const DEFAULT_SAVE_DELAY = 500;

export class AnalysisController {
  #saveTimer = null;

  constructor({ analysisView, tableView, chainView, storage, saveDelay = DEFAULT_SAVE_DELAY }) {
    this.analysisView = analysisView;
    this.tableView = tableView;
    this.chainView = chainView;
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
    this.renderChain();
  }

  renderChain() {
    this.chainView.render(buildChain(this.analysis));
  }

  // Tras cualquier cambio del modelo: refresca la cadena derivada y agenda el guardado.
  #afterChange() {
    this.renderChain();
    this.#scheduleSave();
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
      onOperationChange: (rowId, tokensUpdater) => this.updateOperation(rowId, tokensUpdater),
    });
  }

  // Cambia la operación (lista de tokens) y sugiere el tipo del dato resultante
  // cuando aún no tiene uno, según los operadores usados.
  updateOperation(rowId, tokensUpdater) {
    const row = this.analysis.rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    updateRow(this.analysis, rowId, { operation: tokensUpdater(row.operation) });
    this.#suggestResultType(row);
    this.renderTable();
    this.#afterChange();
  }

  // Sugiere y aplica el tipo del dato resultante si aún no tiene uno. Devuelve el
  // tipo aplicado (o null) para que el llamador pueda reflejarlo en la vista.
  #suggestResultType(row) {
    if (!row.resultId) return null;
    const result = findData(this.analysis, row.resultId);
    if (!result || result.type) return null; // no sobrescribir un tipo ya elegido
    const inferred = inferResultType(row.operation);
    if (inferred) {
      updateData(this.analysis, row.resultId, { type: inferred });
      return inferred;
    }
    return null;
  }

  // Edición de nombre/tipo de un dato: el valor ya está en el DOM del control que
  // se edita; solo se sincronizan las fichas de solo lectura que lo reutilizan.
  updateData(dataId, changes) {
    updateData(this.analysis, dataId, changes);
    this.#syncDataReferences(dataId);
    this.#afterChange();
  }

  // El dato resultante se crea de forma diferida leyendo el resultId actual de la fila.
  updateResult(rowId, changes) {
    updateRowResult(this.analysis, rowId, changes);
    const row = this.analysis.rows.find((candidate) => candidate.id === rowId);
    if (row?.resultId) {
      const suggested = this.#suggestResultType(row);
      if (suggested) this.tableView.syncResultType(rowId, suggested);
      this.#syncDataReferences(row.resultId);
    }
    this.#afterChange();
  }

  // Propaga nombre/tipo de un dato a sus fichas reutilizadas sin re-renderizar.
  #syncDataReferences(dataId) {
    const datum = findData(this.analysis, dataId);
    if (datum) this.tableView.syncDataReferences(datum);
  }

  // Añadir/quitar una entrada cambia los controles visibles: se re-renderiza.
  addRowInput(rowId) {
    addRowInput(this.analysis, rowId);
    this.renderTable();
    this.#afterChange();
  }

  reuseInput(rowId, dataId) {
    addExistingRowInput(this.analysis, rowId, dataId);
    this.renderTable();
    this.#afterChange();
  }

  removeRowInput(rowId, dataId) {
    removeRowInput(this.analysis, rowId, dataId);
    this.renderTable();
    this.#afterChange();
  }

  updateInfo(changes) {
    updateAnalysisInfo(this.analysis, changes);
    this.#afterChange();
  }

  updateRowField(rowId, updater) {
    const changes = this.#resolveRowChanges(rowId, updater);
    if (!changes) return;
    updateRow(this.analysis, rowId, changes);
    this.#afterChange();
  }

  updateRowStructure(rowId, updater) {
    const changes = this.#resolveRowChanges(rowId, updater);
    if (!changes) return;
    updateRow(this.analysis, rowId, changes);
    this.renderTable();
    this.#afterChange();
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
    this.#afterChange();
  }

  async deleteRow(rowId) {
    const confirmed = await confirmDialog({
      title: "Eliminar fila",
      message: this.#deleteRowMessage(rowId),
    });
    if (!confirmed) return;
    removeRow(this.analysis, rowId);
    this.renderTable();
    this.#afterChange();
  }

  // Advierte si la fila produce un dato reutilizado por otras filas, porque al
  // borrarla ese dato y sus referencias también desaparecerán.
  #deleteRowMessage(rowId) {
    const row = this.analysis.rows.find((candidate) => candidate.id === rowId);
    const consumers = row?.resultId
      ? rowsUsingData(this.analysis, row.resultId).filter((candidate) => candidate.id !== rowId)
      : [];
    if (consumers.length === 0) {
      return "Se eliminará esta fila del análisis. Esta acción no se puede deshacer.";
    }
    const datum = findData(this.analysis, row.resultId);
    const name = datum?.name ? `"${datum.name}"` : "que produce";
    return `Esta fila produce el dato ${name}, reutilizado en ${consumers.length} fila(s). Al eliminarla, ese dato y sus referencias también se quitarán.`;
  }

  moveRow(fromRowId, toRowId) {
    const { rows } = this.analysis;
    const fromIndex = rows.findIndex((row) => row.id === fromRowId);
    const toIndex = rows.findIndex((row) => row.id === toRowId);
    if (fromIndex === -1 || toIndex === -1) return;
    moveRow(this.analysis, fromIndex, toIndex);
    this.renderTable();
    this.#afterChange();
  }

  // Reemplaza el análisis actual y refresca vista y persistencia. Es el punto
  // único por el que entra un análisis nuevo, importado o recuperado.
  loadAnalysis(analysis) {
    this.analysis = analysis;
    this.render();
    this.#afterChange();
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
