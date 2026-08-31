// Modelo del análisis: fábricas y operaciones sobre el estado.
// Datos planos y serializables, sin dependencias del DOM ni de la persistencia.
// Las operaciones mutan el análisis recibido y refrescan updatedAt, manteniendo
// una única fuente de verdad que el controlador coordina con la vista y el storage.

import { createId } from "../utils/id.js";

// Versión del formato del análisis. La v2 introdujo el catálogo de datos con
// identidad propia (ids); la v3 convierte la operación en una lista de tokens
// (referencias a datos, operadores y literales) en vez de texto libre.
export const ANALYSIS_VERSION = 3;

export function createDataEntry(overrides = {}) {
  return { id: createId(), name: "", type: "", ...overrides };
}

export function createBranch(overrides = {}) {
  return { type: "", value: "", ...overrides };
}

export function createRow(overrides = {}) {
  return {
    id: createId(),
    problem: "",
    inputIds: [],
    condition: "",
    operation: [],
    resultId: null,
    purpose: "",
    subsequentUse: "",
    ifTrue: createBranch(),
    ifFalse: createBranch(),
    ...overrides,
  };
}

export function createAnalysis(overrides = {}) {
  const now = new Date().toISOString();
  return {
    version: ANALYSIS_VERSION,
    id: createId(),
    title: "",
    description: "",
    data: [],
    rows: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Marca el análisis como modificado en este instante.
export function touch(analysis) {
  analysis.updatedAt = new Date().toISOString();
  return analysis;
}

export function addRow(analysis, row = createRow()) {
  analysis.rows.push(row);
  return touch(analysis);
}

// Elimina una fila y limpia el catálogo: el dato que producía deja de tener
// origen, así que se quita junto con sus referencias; las entradas propias que
// queden huérfanas también se descartan. Los datos reutilizados de otras filas
// solo pierden la referencia (su origen los conserva).
export function removeRow(analysis, rowId) {
  const row = analysis.rows.find((candidate) => candidate.id === rowId);
  if (!row) return analysis;

  const producedId = row.resultId;
  const inputIds = [...row.inputIds];
  analysis.rows = analysis.rows.filter((candidate) => candidate.id !== rowId);

  if (producedId) removeData(analysis, producedId);
  for (const dataId of inputIds) {
    if (dataId !== producedId && !isDataReferenced(analysis, dataId)) removeData(analysis, dataId);
  }
  return touch(analysis);
}

// Reordena una fila de una posición a otra, conservando todos sus datos.
export function moveRow(analysis, fromIndex, toIndex) {
  const { rows } = analysis;
  const lastIndex = rows.length - 1;
  if (fromIndex < 0 || fromIndex > lastIndex) return analysis;
  if (toIndex < 0 || toIndex > lastIndex) return analysis;
  if (fromIndex === toIndex) return analysis;

  const [moved] = rows.splice(fromIndex, 1);
  rows.splice(toIndex, 0, moved);
  return touch(analysis);
}

// Aplica cambios superficiales a una fila. Para campos anidados (result, ifTrue,
// ifFalse) el llamador pasa el objeto anidado completo ya combinado.
export function updateRow(analysis, rowId, changes) {
  const row = analysis.rows.find((candidate) => candidate.id === rowId);
  if (!row) return analysis;
  Object.assign(row, changes);
  return touch(analysis);
}

// Actualiza el título y/o la descripción del análisis.
export function updateAnalysisInfo(analysis, changes) {
  Object.assign(analysis, changes);
  return touch(analysis);
}

// --- Catálogo de datos (única fuente de verdad de nombre y tipo) ---

export function findData(analysis, dataId) {
  return analysis.data.find((entry) => entry.id === dataId) ?? null;
}

export function addData(analysis, values = {}) {
  const entry = createDataEntry(values);
  analysis.data.push(entry);
  touch(analysis);
  return entry;
}

export function updateData(analysis, dataId, changes) {
  const entry = findData(analysis, dataId);
  if (!entry) return analysis;
  Object.assign(entry, changes);
  return touch(analysis);
}

// Elimina un dato del catálogo y todas sus referencias en las filas.
export function removeData(analysis, dataId) {
  analysis.data = analysis.data.filter((entry) => entry.id !== dataId);
  for (const row of analysis.rows) {
    row.inputIds = row.inputIds.filter((id) => id !== dataId);
    if (row.resultId === dataId) row.resultId = null;
  }
  return touch(analysis);
}

// Un dato es huérfano si ninguna fila lo consume como entrada ni lo produce.
function isDataReferenced(analysis, dataId) {
  return analysis.rows.some((row) => row.inputIds.includes(dataId) || row.resultId === dataId);
}

// Filas que consumen un dato como entrada (para avisar antes de borrar su origen).
export function rowsUsingData(analysis, dataId) {
  return analysis.rows.filter((row) => row.inputIds.includes(dataId));
}

// --- Referencias fila ↔ dato ---

// Añade un nuevo dato de entrada (vacío) a la fila y lo registra en el catálogo.
export function addRowInput(analysis, rowId) {
  const row = analysis.rows.find((candidate) => candidate.id === rowId);
  if (!row) return null;
  const entry = addData(analysis);
  row.inputIds.push(entry.id);
  touch(analysis);
  return entry;
}

// Reutiliza un dato existente del catálogo como entrada de la fila (comparte id).
export function addExistingRowInput(analysis, rowId, dataId) {
  const row = analysis.rows.find((candidate) => candidate.id === rowId);
  if (!row) return analysis;
  if (!row.inputIds.includes(dataId) && findData(analysis, dataId)) {
    row.inputIds.push(dataId);
    touch(analysis);
  }
  return analysis;
}

// Quita un dato de entrada de la fila; si queda huérfano, lo elimina del catálogo.
export function removeRowInput(analysis, rowId, dataId) {
  const row = analysis.rows.find((candidate) => candidate.id === rowId);
  if (!row) return analysis;
  row.inputIds = row.inputIds.filter((id) => id !== dataId);
  if (!isDataReferenced(analysis, dataId)) removeData(analysis, dataId);
  return touch(analysis);
}

// Edita el dato resultante de la fila. Lo crea de forma diferida la primera vez
// que se le asigna nombre o tipo, leyendo siempre el resultId actual de la fila.
export function updateRowResult(analysis, rowId, changes) {
  const row = analysis.rows.find((candidate) => candidate.id === rowId);
  if (!row) return analysis;
  if (row.resultId) {
    updateData(analysis, row.resultId, changes);
  } else {
    const entry = addData(analysis, changes);
    row.resultId = entry.id;
  }
  return touch(analysis);
}
