// Pruebas de las mecánicas del catálogo de datos y las referencias fila ↔ dato.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createAnalysis,
  addRow,
  addRowInput,
  removeRowInput,
  updateRowResult,
  removeData,
  findData,
} from "../src/models/analysisModel.js";

function analysisWithRow() {
  const analysis = createAnalysis({ title: "Demo" });
  const row = addRow(analysis).rows.at(-1);
  return { analysis, row };
}

test("updateRowResult creates the datum lazily and then updates the same one", () => {
  const { analysis, row } = analysisWithRow();

  updateRowResult(analysis, row.id, { name: "promedio" });
  assert.ok(row.resultId);
  assert.equal(analysis.data.length, 1);

  updateRowResult(analysis, row.id, { type: "numeric" });
  assert.equal(analysis.data.length, 1, "no crea un dato nuevo en cada edición");
  assert.equal(findData(analysis, row.resultId).name, "promedio");
  assert.equal(findData(analysis, row.resultId).type, "numeric");
});

test("addRowInput registers a datum and removeRowInput cleans up the orphan", () => {
  const { analysis, row } = analysisWithRow();

  const entry = addRowInput(analysis, row.id);
  assert.equal(row.inputIds.length, 1);
  assert.equal(analysis.data.length, 1);

  removeRowInput(analysis, row.id, entry.id);
  assert.equal(row.inputIds.length, 0);
  assert.equal(analysis.data.length, 0, "el dato huérfano se elimina del catálogo");
});

test("a datum shared by two rows survives removal from one row", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const rowA = addRow(analysis).rows.at(-1);
  const rowB = addRow(analysis).rows.at(-1);

  const entry = addRowInput(analysis, rowA.id);
  rowB.inputIds.push(entry.id); // ambas filas comparten el mismo dato

  removeRowInput(analysis, rowA.id, entry.id);
  assert.equal(analysis.data.length, 1, "sigue referenciado por la otra fila");
  assert.ok(rowB.inputIds.includes(entry.id));
});

test("removeData prunes every reference in the rows", () => {
  const { analysis, row } = analysisWithRow();
  updateRowResult(analysis, row.id, { name: "promedio", type: "numeric" });
  const dataId = row.resultId;

  removeData(analysis, dataId);
  assert.equal(analysis.data.length, 0);
  assert.equal(row.resultId, null);
});
