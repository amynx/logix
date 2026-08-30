// Validación del análisis en los límites del sistema.
// validateImportedAnalysis comprueba que un objeto proveniente de un archivo
// tenga la forma y versión esperadas antes de convertirlo en estado interno.
// Lanza mensajes comprensibles para el estudiante (no errores técnicos).

import { ANALYSIS_VERSION } from "../models/analysisModel.js";

const INVALID_FORMAT = "El archivo seleccionado no tiene un formato de análisis válido.";

export function validateImportedAnalysis(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(INVALID_FORMAT);
  }
  if (data.version !== ANALYSIS_VERSION) {
    const found = data.version ?? "desconocida";
    throw new Error(`El archivo fue creado con una versión distinta (v${found}) y no se puede abrir en esta versión.`);
  }
  if (!Array.isArray(data.rows)) {
    throw new Error("El archivo de análisis está incompleto o dañado.");
  }
  return true;
}

// Advertencias no bloqueantes para orientar al estudiante (sección 22).
// No impiden editar ni guardar: solo señalan puntos por completar. La validación
// es pura y no depende de la interfaz.
export function collectAnalysisWarnings(analysis) {
  const warnings = [];
  if (!analysis.title.trim()) {
    warnings.push("El análisis no tiene título.");
  }

  analysis.rows.forEach((row, index) => {
    const position = index + 1;
    if (row.operation.trim() && !row.result.name.trim()) {
      warnings.push(`Fila ${position}: la operación produce un dato sin nombre.`);
    }
    if (row.result.name.trim() && !row.result.type) {
      warnings.push(`Fila ${position}: el dato "${row.result.name}" no tiene tipo.`);
    }
    if (row.purpose === "decision" && !row.condition.trim()) {
      warnings.push(`Fila ${position}: la decisión no tiene una condición (pregunta) definida.`);
    }
    if (row.purpose === "response" && !row.subsequentUse.trim()) {
      warnings.push(`Fila ${position}: falta indicar qué información se proporcionará.`);
    }
  });

  return warnings;
}
