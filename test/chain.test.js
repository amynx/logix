// Pruebas de la derivación del análisis a la cadena Entradas → Proceso → Salida.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildChain } from "../src/models/chainModel.js";
import {
  createAnalysis,
  addRow,
  addRowInput,
  addExistingRowInput,
  updateRow,
  updateData,
  updateRowResult,
} from "../src/models/analysisModel.js";

test("an empty analysis yields an empty chain", () => {
  const chain = buildChain(createAnalysis());
  assert.deepEqual(chain, { entradas: [], proceso: [], producidos: [], salidas: [] });
});

test("produced data are listed for reuse in the process", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const row = addRow(analysis).rows.at(-1);
  updateRowResult(analysis, row.id, { name: "promedio", type: "numeric" });

  const chain = buildChain(analysis);
  assert.deepEqual(chain.producidos.map((d) => d.name), ["promedio"]);
});

test("external inputs are those consumed but never produced", () => {
  const analysis = createAnalysis({ title: "Promedio" });
  const row = addRow(analysis).rows.at(-1);
  const nota = addRowInput(analysis, row.id);
  updateData(analysis, nota.id, { name: "nota1", type: "numeric" });
  updateRowResult(analysis, row.id, { name: "promedio", type: "numeric" });

  const chain = buildChain(analysis);
  assert.deepEqual(chain.entradas.map((d) => d.name), ["nota1"]);
  assert.equal(chain.proceso.length, 1);
  assert.equal(chain.proceso[0].result.name, "promedio");
});

test("a produced datum reused downstream is not an external input", () => {
  const analysis = createAnalysis({ title: "Promedio" });
  const producer = addRow(analysis).rows.at(-1);
  updateRowResult(analysis, producer.id, { name: "promedio", type: "numeric" });

  const consumer = addRow(analysis).rows.at(-1);
  addExistingRowInput(analysis, consumer.id, producer.resultId);
  updateRow(analysis, consumer.id, { purpose: "response", subsequentUse: "Mostrar el promedio" });

  const chain = buildChain(analysis);
  assert.equal(chain.entradas.length, 0, "el promedio se produce, no es entrada externa");
  assert.equal(chain.salidas.length, 1);
  assert.equal(chain.salidas[0].label, "Mostrar el promedio");
});

test("decision branches that respond become outputs tagged Sí/No", () => {
  const analysis = createAnalysis({ title: "Aprobado" });
  const row = addRow(analysis).rows.at(-1);
  updateRow(analysis, row.id, {
    purpose: "decision",
    condition: "¿promedio >= 3?",
    ifTrue: { type: "response", value: "Mostrar 'aprobó'" },
    ifFalse: { type: "response", value: "Mostrar 'reprobó'" },
  });

  const chain = buildChain(analysis);
  assert.deepEqual(chain.salidas.map((o) => o.label), ["Mostrar 'aprobó'", "Mostrar 'reprobó'"]);
  assert.deepEqual(chain.salidas.map((o) => o.branch), ["Sí", "No"]);
  assert.equal(chain.salidas[0].condition, "¿promedio >= 3?");
});

test("a process step exposes description, inputs, result and purpose", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const row = addRow(analysis).rows.at(-1);
  const nota = addRowInput(analysis, row.id);
  updateData(analysis, nota.id, { name: "nota1", type: "numeric" });
  updateRowResult(analysis, row.id, { name: "promedio", type: "numeric" });
  updateRow(analysis, row.id, {
    problem: "Obtener el promedio",
    purpose: "operation",
    subsequentUse: "Usarlo para decidir",
  });

  const [step] = buildChain(analysis).proceso;
  assert.equal(step.description, "Obtener el promedio");
  assert.equal(step.inputs[0].name, "nota1");
  assert.equal(step.result.name, "promedio");
  assert.equal(step.purpose, "operation");
  assert.equal(step.purposeDetail, "Usarlo para decidir");
});
