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
