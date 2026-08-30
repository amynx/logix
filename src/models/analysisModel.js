// Modelo del análisis: fábricas y operaciones sobre el estado.
// Datos planos y serializables, sin dependencias del DOM ni de la persistencia.
// Las operaciones mutan el análisis recibido y refrescan updatedAt, manteniendo
// una única fuente de verdad que el controlador coordina con la vista y el storage.

import { createId } from "../utils/id.js";

// Versión del formato del análisis. Se incluye en cada análisis para permitir
// migraciones futuras del archivo .analisis sin romper la compatibilidad.
export const ANALYSIS_VERSION = 1;

export function createDataItem(overrides = {}) {
  return { name: "", type: "", ...overrides };
}

export function createBranch(overrides = {}) {
  return { type: "", value: "", ...overrides };
}

export function createRow(overrides = {}) {
  return {
    id: createId(),
    problem: "",
    inputs: [],
    condition: "",
    operation: "",
    result: createDataItem(),
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

export function removeRow(analysis, rowId) {
  analysis.rows = analysis.rows.filter((row) => row.id !== rowId);
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
