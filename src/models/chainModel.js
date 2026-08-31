// Derivación pura del análisis a su "cadena" de razonamiento:
// Entradas → Proceso (actividades) → Salida.
// No depende del DOM: transforma el estado en una estructura lista para la vista,
// reutilizando la identidad por id para distinguir datos externos, intermedios y
// finales. Es la base para futuras representaciones (pseudocódigo, diagramas).

import { operationToText } from "./operators.js";

export function buildChain(analysis) {
  const dataById = new Map(analysis.data.map((entry) => [entry.id, entry]));
  const resolve = (id) => dataById.get(id) ?? null;
  const producedIds = new Set(analysis.rows.map((row) => row.resultId).filter(Boolean));

  return {
    entradas: collectInputs(analysis, resolve, producedIds),
    proceso: analysis.rows
      .map((row, index) => buildStep(row, index, resolve, producedIds))
      .filter(Boolean),
    salidas: collectOutputs(analysis, resolve),
  };
}

// Entradas externas: datos que alguna fila consume pero que ninguna produce.
function collectInputs(analysis, resolve, producedIds) {
  const inputs = [];
  const seen = new Set();
  for (const row of analysis.rows) {
    for (const id of row.inputIds) {
      if (producedIds.has(id) || seen.has(id)) continue;
      const datum = resolve(id);
      if (datum) {
        inputs.push(datum);
        seen.add(id);
      }
    }
  }
  return inputs;
}

// Una actividad por fila con contenido, en el orden del análisis.
function buildStep(row, index, resolve, producedIds) {
  const inputs = row.inputIds
    .map(resolve)
    .filter(Boolean)
    .map((datum) => ({ ...datum, produced: producedIds.has(datum.id) }));
  const result = resolve(row.resultId);
  const operation = operationToText(row.operation, resolve);

  const hasContent =
    operation || row.condition.trim() || result || inputs.length > 0 || row.purpose;
  if (!hasContent) return null;

  return {
    rowId: row.id,
    position: index + 1,
    inputs,
    operation,
    condition: row.condition.trim(),
    purpose: row.purpose,
    result,
    ifTrue: row.ifTrue,
    ifFalse: row.ifFalse,
  };
}

// Salidas: la información final del programa (propósito "respuesta") y las ramas
// de decisión que terminan en una respuesta.
function collectOutputs(analysis, resolve) {
  const outputs = [];
  for (const row of analysis.rows) {
    if (row.purpose === "response") {
      const result = resolve(row.resultId);
      const label = (result && result.name.trim()) || row.subsequentUse.trim() || "Respuesta";
      outputs.push({ label, detail: result ? row.subsequentUse.trim() : "" });
    }
    for (const branch of [row.ifTrue, row.ifFalse]) {
      if (branch.type === "response" && branch.value.trim()) {
        outputs.push({ label: branch.value.trim(), detail: "" });
      }
    }
  }
  return outputs;
}
