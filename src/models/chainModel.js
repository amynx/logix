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
    producidos: collectProduced(analysis, resolve),
    salidas: collectOutputs(analysis, resolve),
  };
}

// Datos producidos por las operaciones, en orden y sin repetir. Quedan
// disponibles para identificarse y reutilizarse en operaciones posteriores.
function collectProduced(analysis, resolve) {
  const produced = [];
  const seen = new Set();
  for (const row of analysis.rows) {
    if (row.resultId && !seen.has(row.resultId)) {
      const datum = resolve(row.resultId);
      if (datum) {
        produced.push(datum);
        seen.add(row.resultId);
      }
    }
  }
  return produced;
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

// Una actividad por fila con contenido, en el orden del análisis. Se expone cada
// parte por separado para que la tarjeta la presente de forma organizada.
function buildStep(row, index, resolve, producedIds) {
  const inputs = row.inputIds
    .map(resolve)
    .filter(Boolean)
    .map((datum) => ({ ...datum, produced: producedIds.has(datum.id) }));
  const result = resolve(row.resultId);
  const operation = operationToText(row.operation, resolve);
  const condition = row.condition.trim();
  const description = row.problem.trim();

  const hasContent =
    description || operation || condition || result || inputs.length > 0 || row.purpose;
  if (!hasContent) return null;

  return {
    rowId: row.id,
    position: index + 1,
    description,
    inputs,
    condition,
    operation,
    result,
    purpose: row.purpose,
    purposeDetail: operationToText(row.subsequentUse, resolve),
    // Caminos de la decisión (para visualizar cómo la condición afecta el flujo).
    ifTrue: { type: row.ifTrue.type, text: operationToText(row.ifTrue.value, resolve) },
    ifFalse: { type: row.ifFalse.type, text: operationToText(row.ifFalse.value, resolve) },
  };
}

// Salidas: la información final del programa (propósito "respuesta") y las ramas
// de decisión que terminan en una respuesta. Cada salida de una rama indica a qué
// caso corresponde (Sí = la condición se cumple; No = no se cumple) y la pregunta.
function collectOutputs(analysis, resolve) {
  const outputs = [];
  for (const row of analysis.rows) {
    if (row.purpose === "response") {
      const result = resolve(row.resultId);
      const info = operationToText(row.subsequentUse, resolve);
      const label = (result && result.name.trim()) || info || "Respuesta";
      outputs.push({ label, detail: result ? info : "", branch: null, condition: "" });
    }
    const condition = row.condition.trim();
    for (const [branchCase, branch] of [["Sí", row.ifTrue], ["No", row.ifFalse]]) {
      if (branch.type === "response" && branch.value.length > 0) {
        outputs.push({ label: operationToText(branch.value, resolve), detail: "", branch: branchCase, condition });
      }
    }
  }
  return outputs;
}
