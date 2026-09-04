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
  addInput,
  formatInputNames,
  removeData,
  listInputs,
  addExistingRowInput,
  removeRowInput,
  updateRowResult,
  findData,
  rowsUsingData,
  addStudent,
  updateStudent,
  removeStudent,
} from "../models/analysisModel.js";
import { createStudentGradeExample } from "../models/exampleAnalysis.js";
import { confirmDialog, messageDialog, selectSectionsDialog } from "../views/dialogs.js";
import { PDF_SECTIONS } from "../views/pdfView.js";
import { exportAnalysis, importAnalysis } from "../services/file/fileService.js";
import { collectAnalysisWarnings, migrateAnalysis } from "../validation/analysisValidation.js";
import { buildChain } from "../models/chainModel.js";
import { inferResultType } from "../models/operators.js";
import { trackEvent } from "../utils/analytics.js";

const DEFAULT_SAVE_DELAY = 500;

// Extrae un valor evidente (el primer número) de un fragmento del enunciado. Si no
// hay ninguno, devuelve "" y el estudiante lo completa. Es solo una ayuda editable.
function valueFromFragment(fragment) {
  const match = String(fragment).match(/-?\d+(?:[.,]\d+)?/);
  return match ? match[0] : "";
}

export class AnalysisController {
  #saveTimer = null;
  #history = []; // instantáneas del análisis para deshacer/rehacer
  #historyIndex = -1;
  #lastRecordAt = 0;
  #restoring = false;

  constructor({ analysisView, studentsView, inputsView, tableView, cardsView, chainView, completenessView, pdfView, storage, saveDelay = DEFAULT_SAVE_DELAY }) {
    this.analysisView = analysisView;
    this.studentsView = studentsView;
    this.inputsView = inputsView;
    this.completenessView = completenessView;
    this.tableView = tableView;
    this.cardsView = cardsView;
    this.viewMode = "table"; // "table" | "cards"
    this.chainView = chainView;
    this.pdfView = pdfView;
    this.storage = storage;
    this.saveDelay = saveDelay;
    this.analysis = null;
    this.editingRows = new Set(); // ids de actividades en modo edición (estado de vista)
    this.editingInputs = false; // sección de datos de entrada en modo edición
    this.editingStudents = false; // sección de estudiantes en modo edición
    this.showStatement = false; // mostrar el enunciado (opcional) en la sección 2
  }

  async start() {
    this.analysisView.renderToolbar({
      onNew: () => this.newAnalysis(),
      onOpenFile: (file) => this.openFile(file),
      onSaveFile: () => this.saveToFile(),
      onExportPdf: () => this.exportPdf(),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
    });
    this.analysisView.renderStatus();
    this.#registerShortcuts();
    const { analysis, editingRowIds } = await this.#recoverOrCreate();
    this.analysis = analysis;
    this.editingRows = new Set(editingRowIds);
    this.showStatement = Boolean(this.analysis.statement?.trim());
    this.render();
    this.#resetHistory();
  }

  // Ctrl/Cmd+Z deshace y Ctrl/Cmd+Shift+Z (o Ctrl+Y) rehace. Dentro de un campo se
  // respeta el deshacer nativo del texto.
  #registerShortcuts() {
    document.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        this.redo();
      }
    });
  }

  render() {
    this.renderStudents();
    this.renderInfo();
    this.renderInputs();
    this.renderTable();
    this.renderCompleteness();
    this.renderChain();
  }

  renderCompleteness() {
    this.completenessView.render(collectAnalysisWarnings(this.analysis));
  }

  renderStudents() {
    this.studentsView.render(this.analysis.group, this.analysis.students, this.editingStudents, {
      onGroupChange: (group) => this.updateInfo({ group }),
      onAddStudent: () => this.addStudent(),
      onStudentChange: (studentId, changes) => this.updateStudent(studentId, changes),
      onRemoveStudent: (studentId) => this.removeStudent(studentId),
      onEditStudents: () => this.setEditingStudents(true),
      onDoneStudents: () => this.setEditingStudents(false),
    });
  }

  setEditingStudents(editing) {
    this.editingStudents = editing;
    this.renderStudents();
  }

  // Agregar un estudiante entra (o permanece) en modo edición para completarlo.
  addStudent() {
    addStudent(this.analysis);
    this.editingStudents = true;
    this.renderStudents();
    this.#afterChange();
  }

  // El campo editado conserva el foco; la sección no se re-renderiza al teclear.
  updateStudent(studentId, changes) {
    updateStudent(this.analysis, studentId, changes);
    this.#afterChange();
  }

  removeStudent(studentId) {
    removeStudent(this.analysis, studentId);
    this.renderStudents();
    this.#afterChange();
  }

  renderInputs() {
    this.inputsView.render(listInputs(this.analysis), this.editingInputs, {
      onAddInput: () => this.addInput(),
      onInputChange: (dataId, changes) => this.updateInput(dataId, changes),
      onRemoveInput: (dataId) => this.removeInput(dataId),
      onEditInputs: () => this.setEditingInputs(true),
      onDoneInputs: () => this.setEditingInputs(false),
      onFormatNames: (convention) => this.formatInputNames(convention),
    }, this.showStatement);
  }

  // Aplica la convención elegida a los nombres de los datos de entrada (a petición
  // del estudiante). Se re-renderiza la tabla para reflejar los nombres en las fichas.
  formatInputNames(convention) {
    formatInputNames(this.analysis, convention);
    this.renderInputs();
    this.renderTable();
    this.#afterChange();
    trackEvent("format_input_names", { convention });
  }

  setEditingInputs(editing) {
    this.editingInputs = editing;
    this.renderInputs();
  }

  // Alta de un dato de entrada: aparece en la sección y en los selectores de las filas.
  // Agregar un dato entra (o permanece) en modo edición para poder completarlo.
  addInput() {
    addInput(this.analysis);
    this.editingInputs = true;
    this.renderInputs();
    this.renderTable();
    this.#afterChange();
    trackEvent("add_input");
  }

  // Edición de un dato de entrada desde su sección. Se re-renderiza la tabla (para
  // reflejar las fichas), sin tocar la sección: el campo editado conserva el foco.
  updateInput(dataId, changes) {
    updateData(this.analysis, dataId, changes);
    this.renderTable();
    this.#afterChange();
  }

  removeInput(dataId) {
    removeData(this.analysis, dataId);
    this.renderInputs();
    this.renderTable();
    this.#afterChange();
  }

  renderChain() {
    this.chainView.render(buildChain(this.analysis));
  }

  // Tras cualquier cambio del modelo: refresca la cadena derivada y agenda el guardado.
  #afterChange() {
    this.#recordHistory();
    this.renderCompleteness();
    this.renderChain();
    this.#scheduleSave();
  }

  // --- Historial (deshacer / rehacer) ---

  // Registra el estado tras un cambio. Los cambios muy seguidos (p. ej. teclear)
  // se agrupan en una sola entrada para que deshacer no vaya carácter por carácter.
  #recordHistory() {
    if (this.#restoring) return;
    if (this.#historyIndex < this.#history.length - 1) {
      this.#history.splice(this.#historyIndex + 1); // descarta el "rehacer" pendiente
    }
    const snapshot = structuredClone(this.analysis);
    const now = Date.now();
    if (now - this.#lastRecordAt < 600 && this.#historyIndex > 0) {
      this.#history[this.#historyIndex] = snapshot;
    } else {
      this.#history.push(snapshot);
      this.#historyIndex = this.#history.length - 1;
      if (this.#history.length > 100) {
        this.#history.shift();
        this.#historyIndex--;
      }
    }
    this.#lastRecordAt = now;
    this.#updateHistoryButtons();
  }

  #resetHistory() {
    this.#history = [structuredClone(this.analysis)];
    this.#historyIndex = 0;
    this.#lastRecordAt = 0;
    this.#updateHistoryButtons();
  }

  undo() {
    if (this.#historyIndex <= 0) return;
    this.#historyIndex--;
    this.#restoreFromHistory();
  }

  redo() {
    if (this.#historyIndex >= this.#history.length - 1) return;
    this.#historyIndex++;
    this.#restoreFromHistory();
  }

  #restoreFromHistory() {
    this.#restoring = true;
    this.analysis = structuredClone(this.#history[this.#historyIndex]);
    // Descarta el modo edición de filas que ya no existen tras restaurar.
    this.editingRows = new Set([...this.editingRows].filter((id) => this.analysis.rows.some((row) => row.id === id)));
    this.render();
    this.#restoring = false;
    this.#scheduleSave();
    this.#updateHistoryButtons();
  }

  #updateHistoryButtons() {
    this.analysisView.setHistoryState(this.#historyIndex > 0, this.#historyIndex < this.#history.length - 1);
  }

  renderInfo() {
    this.analysisView.renderInfo(this.analysis, {
      onTitleChange: (title) => this.updateInfo({ title }),
      onDescriptionChange: (description) => this.updateInfo({ description }),
      onStatementChange: (statement) => this.updateInfo({ statement }),
      onAddDataFromSelection: (fragment) => this.addDataFromSelection(fragment),
      isFragmentAdded: (fragment) => this.analysis.data.some((entry) => (entry.source ?? "").trim() === fragment),
      showStatement: this.showStatement,
      onToggleStatement: () => this.toggleStatement(),
    });
  }

  // El enunciado es opcional: se muestra u oculta según lo necesite el estudiante.
  toggleStatement() {
    this.showStatement = !this.showStatement;
    this.renderInfo();
    this.renderInputs(); // la estructura de columnas de la sección 3 depende del enunciado
  }

  // Convierte un fragmento seleccionado del enunciado en un dato de entrada: guarda
  // el fragmento como origen y extrae un valor evidente (editable). El estudiante
  // completa el tipo y el nombre. No decide el nombre por él.
  addDataFromSelection(fragment) {
    const text = fragment.trim();
    if (!text) return;
    addInput(this.analysis, { source: text, value: valueFromFragment(text) });
    this.editingInputs = true;
    this.renderInputs();
    this.renderTable();
    this.#afterChange();
    trackEvent("add_data_from_selection");
  }

  // Vista activa de las actividades (tabla o tarjetas): ambas comparten handlers.
  #activityView() {
    return this.viewMode === "cards" ? this.cardsView : this.tableView;
  }

  setViewMode(mode) {
    if (mode === this.viewMode) return;
    this.viewMode = mode;
    this.renderTable();
  }

  // Alterna una actividad entre modo edición y modo visualización. Es estado de
  // vista (no se persiste): al terminar, la actividad muestra solo su información.
  setRowEditing(rowId, editing) {
    if (editing) this.editingRows.add(rowId);
    else this.editingRows.delete(rowId);
    this.renderTable();
  }

  renderTable() {
    this.#activityView().render(this.analysis, this.#tableHandlers(), this.viewMode);
  }

  // Re-render que conserva el foco y el cursor: para cambios de datos (crear/
  // renombrar) que deben refrescar los selectores de otras celdas al vuelo.
  #renderTableKeepingFocus() {
    this.#activityView().renderKeepingFocus(this.analysis, this.#tableHandlers(), this.viewMode);
  }

  #tableHandlers() {
    return {
      onSetViewMode: (mode) => this.setViewMode(mode),
      isRowEditing: (rowId) => this.editingRows.has(rowId),
      onEditRow: (rowId) => this.setRowEditing(rowId, true),
      onDoneRow: (rowId) => this.setRowEditing(rowId, false),
      onFieldChange: (rowId, changes) => this.updateRowField(rowId, changes),
      onStructuralChange: (rowId, changes) => this.updateRowStructure(rowId, changes),
      onAddRow: () => this.addRow(),
      onDeleteRow: (rowId) => this.deleteRow(rowId),
      onMoveRow: (fromRowId, toRowId) => this.moveRow(fromRowId, toRowId),
      onDataChange: (dataId, changes) => this.updateData(dataId, changes),
      onResultChange: (rowId, changes) => this.updateResult(rowId, changes),
      onReuseInput: (rowId, dataId) => this.reuseInput(rowId, dataId),
      onRemoveRowInput: (rowId, dataId) => this.removeRowInput(rowId, dataId),
      onUsedInChange: (rowId, usedInRowId) => this.setUsedIn(rowId, usedInRowId),
      onOperationChange: (rowId, tokensUpdater) => this.updateOperation(rowId, tokensUpdater),
    };
  }

  // Cambia la operación (lista de tokens) y sugiere el tipo del dato resultante
  // cuando aún no tiene uno, según los operadores usados.
  updateOperation(rowId, tokensUpdater) {
    const row = this.analysis.rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    updateRow(this.analysis, rowId, { operation: tokensUpdater(row.operation) });
    this.#suggestResultType(row);
    this.#renderTableKeepingFocus(); // conserva el foco del constructor de expresiones
    this.#afterChange();
  }

  // Sugiere y aplica el tipo del dato resultante si aún no tiene uno.
  #suggestResultType(row) {
    if (!row.resultId) return;
    const result = findData(this.analysis, row.resultId);
    if (!result || result.type) return; // no sobrescribir un tipo ya elegido
    const inferred = inferResultType(row.operation);
    if (inferred) updateData(this.analysis, row.resultId, { type: inferred });
  }

  // Edición de nombre/tipo de un dato: se re-renderiza la tabla conservando el
  // foco, de modo que las referencias y selectores de otras celdas se actualicen
  // al instante (nombre en fichas reutilizadas, opciones de "+ dato", etc.).
  updateData(dataId, changes) {
    updateData(this.analysis, dataId, changes);
    this.#renderTableKeepingFocus();
    this.#afterChange();
  }

  // El dato resultante se crea de forma diferida leyendo el resultId actual de la
  // fila. Al crearlo, otras celdas ya pueden referenciarlo (re-render con foco).
  updateResult(rowId, changes) {
    updateRowResult(this.analysis, rowId, changes);
    const row = this.analysis.rows.find((candidate) => candidate.id === rowId);
    if (row) this.#suggestResultType(row);
    this.#renderTableKeepingFocus();
    this.#afterChange();
  }

  // Vincula (o desvincula) el dato producido de la fila con la actividad donde se
  // usará. El valor puede ser "" (sin asignar), "pending" o el id de una actividad.
  setUsedIn(rowId, usedInRowId) {
    updateRow(this.analysis, rowId, { usedInRowId });
    this.#renderTableKeepingFocus();
    this.#afterChange();
  }

  // Al reutilizar un dato en la fila se conserva la posición de scroll (no debe
  // saltar a otra tarjeta) para no interrumpir la construcción de la expresión.
  reuseInput(rowId, dataId) {
    addExistingRowInput(this.analysis, rowId, dataId);
    this.#renderTableKeepingFocus();
    this.#afterChange();
  }

  removeRowInput(rowId, dataId) {
    removeRowInput(this.analysis, rowId, dataId);
    this.#renderTableKeepingFocus();
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
    this.#renderTableKeepingFocus(); // conserva el foco del constructor en las ramas
    this.#afterChange();
  }

  // Resuelve el actualizador contra la fila actual del modelo, de modo que cada
  // cambio parta del estado fresco y no de una copia capturada en el render.
  #resolveRowChanges(rowId, updater) {
    const row = this.analysis.rows.find((candidate) => candidate.id === rowId);
    return row ? updater(row) : null;
  }

  // Una actividad nueva se abre en modo edición: aún no tiene información que ver.
  addRow() {
    addRow(this.analysis);
    const newRow = this.analysis.rows[this.analysis.rows.length - 1];
    this.editingRows.add(newRow.id);
    this.renderTable();
    this.#afterChange();
    trackEvent("add_activity");
  }

  async deleteRow(rowId) {
    const confirmed = await confirmDialog({
      title: "Eliminar fila",
      message: this.#deleteRowMessage(rowId),
    });
    if (!confirmed) return;
    removeRow(this.analysis, rowId);
    this.editingRows.delete(rowId);
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
  loadAnalysis(analysis, editingRowIds = []) {
    this.analysis = analysis;
    this.editingRows = new Set(editingRowIds);
    this.editingInputs = false; // la sección de datos empieza en modo visualización
    this.editingStudents = false; // la sección de estudiantes también
    this.showStatement = Boolean(analysis.statement?.trim()); // muestra el enunciado si lo trae
    this.render();
    this.#afterChange();
    this.#resetHistory(); // un análisis cargado empieza un historial nuevo
  }

  newAnalysis() {
    const analysis = createAnalysis();
    addRow(analysis);
    const seededRow = analysis.rows[analysis.rows.length - 1];
    this.loadAnalysis(analysis, [seededRow.id]);
    trackEvent("new_analysis");
  }

  // Carga un análisis de ejemplo completo (en modo visualización) para aprender de
  // un caso terminado. Es un análisis nuevo más; el anterior sigue en el historial.
  // Carga el ejemplo del tutorial guiado (¿el estudiante aprueba?). Abre la sección
  // de datos en edición para que se vea la traza fragmento → valor → nombre.
  loadStudentGradeExample() {
    this.loadAnalysis(createStudentGradeExample());
    this.editingInputs = true;
    this.renderInputs();
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
    trackEvent("save_file");
  }

  // Exporta a PDF: el usuario elige las secciones; la fecha/hora es automática.
  async exportPdf() {
    const sections = await selectSectionsDialog(PDF_SECTIONS, { title: "Exportar a PDF" });
    if (!sections) return;
    this.pdfView.print(this.analysis, { sections, exportedAt: new Date().toISOString() });
    trackEvent("export_pdf", { sections: sections.length });
  }

  async openFile(file) {
    try {
      const analysis = await importAnalysis(file);
      this.loadAnalysis(analysis);
      trackEvent("open_file");
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
        const latest = stored.reduce((newest, item) => (item.updatedAt > newest.updatedAt ? item : newest));
        // Migra por si el auto-guardado quedó en un formato anterior. Un análisis
        // recuperado se muestra en modo visualización (sin ninguna fila en edición).
        return { analysis: migrateAnalysis(latest), editingRowIds: [] };
      }
    } catch (error) {
      console.error("No se pudo recuperar el análisis guardado:", error);
    }
    // Análisis nuevo: su fila inicial se abre en modo edición.
    const analysis = createAnalysis();
    addRow(analysis);
    const seededRow = analysis.rows[analysis.rows.length - 1];
    return { analysis, editingRowIds: [seededRow.id] };
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
