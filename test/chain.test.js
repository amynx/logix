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
  assert.deepEqual(chain, { entradas: [], proceso: [], salidas: [] });
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

test("decision branches that respond become outputs", () => {
  const analysis = createAnalysis({ title: "Aprobado" });
  const row = addRow(analysis).rows.at(-1);
  updateRow(analysis, row.id, {
    purpose: "decision",
    ifTrue: { type: "response", value: "Mostrar 'aprobó'" },
    ifFalse: { type: "response", value: "Mostrar 'reprobó'" },
  });

  const chain = buildChain(analysis);
  assert.deepEqual(chain.salidas.map((o) => o.label), ["Mostrar 'aprobó'", "Mostrar 'reprobó'"]);
});
