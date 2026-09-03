// Pruebas de las mecánicas del catálogo de datos y las referencias fila ↔ dato.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createAnalysis,
  addRow,
  addInput,
  listInputs,
  addExistingRowInput,
  removeRowInput,
  removeRow,
  updateRowResult,
  removeData,
  findData,
  updateAnalysisInfo,
  addStudent,
  updateStudent,
  removeStudent,
  formatInputNames,
} from "../src/models/analysisModel.js";
import { applyNameConvention } from "../src/models/nameConventions.js";

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

test("input data are declared globally; rows only reference them", () => {
  const { analysis, row } = analysisWithRow();

  const entry = addInput(analysis);
  assert.equal(analysis.data.length, 1);
  assert.equal(row.inputIds.length, 0, "declararlo no lo agrega a ninguna fila");

  addExistingRowInput(analysis, row.id, entry.id);
  assert.equal(row.inputIds.length, 1);

  removeRowInput(analysis, row.id, entry.id);
  assert.equal(row.inputIds.length, 0);
  assert.equal(analysis.data.length, 1, "el dato declarado persiste al quitar la referencia");
});

test("listInputs returns the data that no operation produces", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const row = addRow(analysis).rows.at(-1);
  const input = addInput(analysis);
  updateRowResult(analysis, row.id, { name: "promedio", type: "numeric" });

  const inputs = listInputs(analysis);
  assert.deepEqual(inputs.map((d) => d.id), [input.id], "el resultado producido no es entrada");
});

test("addExistingRowInput reuses a datum without duplicating it", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const rowA = addRow(analysis).rows.at(-1);
  const rowB = addRow(analysis).rows.at(-1);
  updateRowResult(analysis, rowA.id, { name: "promedio", type: "numeric" });
  const dataId = rowA.resultId;

  addExistingRowInput(analysis, rowB.id, dataId);
  assert.ok(rowB.inputIds.includes(dataId));
  assert.equal(analysis.data.length, 1, "no duplica el dato");

  addExistingRowInput(analysis, rowB.id, dataId); // idempotente
  assert.equal(rowB.inputIds.filter((id) => id === dataId).length, 1);
});

test("removeRow deletes the produced datum and prunes its references", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const producer = addRow(analysis).rows.at(-1);
  const consumer = addRow(analysis).rows.at(-1);
  updateRowResult(analysis, producer.id, { name: "promedio", type: "numeric" });
  addExistingRowInput(analysis, consumer.id, producer.resultId);
  const dataId = producer.resultId;

  removeRow(analysis, producer.id);
  assert.equal(analysis.rows.length, 1);
  assert.equal(findData(analysis, dataId), null, "el dato producido se elimina");
  assert.ok(!consumer.inputIds.includes(dataId), "se poda la referencia colgante");
});

test("removeRow keeps a datum whose origin row remains", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const producer = addRow(analysis).rows.at(-1);
  const consumer = addRow(analysis).rows.at(-1);
  updateRowResult(analysis, producer.id, { name: "x", type: "numeric" });
  addExistingRowInput(analysis, consumer.id, producer.resultId);
  const dataId = producer.resultId;

  removeRow(analysis, consumer.id); // se borra el consumidor, no el origen
  assert.ok(findData(analysis, dataId), "el dato permanece porque su origen sigue");
  assert.equal(producer.resultId, dataId);
});

test("a datum keeps its source fragment and value; the analysis has a statement", () => {
  const analysis = createAnalysis({ title: "Demo" });
  assert.equal(analysis.statement, "", "el análisis empieza sin enunciado");

  const input = addInput(analysis, { source: "500 unidades", value: "500" });
  assert.equal(input.source, "500 unidades");
  assert.equal(input.value, "500");
  assert.equal(input.name, "", "el nombre lo pone el estudiante");
  assert.equal(input.type, "");
});

test("applyNameConvention formats a readable name per convention", () => {
  assert.equal(applyNameConvention("unidades producidas", "camel"), "unidadesProducidas");
  assert.equal(applyNameConvention("unidades producidas", "snake"), "unidades_producidas");
  assert.equal(applyNameConvention("unidades producidas", "pascal"), "UnidadesProducidas");
  assert.equal(applyNameConvention("", "camel"), "", "un nombre vacío no cambia");
  assert.equal(applyNameConvention("yaEnCamel", "snake"), "ya_en_camel", "re-convierte camelCase");
});

test("formatInputNames applies a convention only to declared inputs", () => {
  const analysis = createAnalysis({ title: "Demo" });
  addInput(analysis, { name: "unidades producidas" });
  addInput(analysis, { name: "" }); // vacío: no cambia
  addInput(analysis, { name: "cantidad trabajadores" });

  formatInputNames(analysis, "camel");
  const names = listInputs(analysis).map((entry) => entry.name);
  assert.deepEqual(names, ["unidadesProducidas", "", "cantidadTrabajadores"]);
});

test("the analysis records a single group shared by all students", () => {
  const analysis = createAnalysis({ title: "Demo" });
  assert.equal(analysis.group, "", "empieza sin grupo");

  updateAnalysisInfo(analysis, { group: "N1" });
  assert.equal(analysis.group, "N1");
});

test("students can be added, edited and removed (without their own group)", () => {
  const analysis = createAnalysis({ title: "Demo" });
  const student = addStudent(analysis);
  assert.equal(analysis.students.length, 1);
  assert.equal(student.group, undefined, "el estudiante no lleva grupo propio");

  updateStudent(analysis, student.id, { idNumber: "123", fullName: "Ana Pérez" });
  assert.deepEqual(
    { idNumber: analysis.students[0].idNumber, fullName: analysis.students[0].fullName },
    { idNumber: "123", fullName: "Ana Pérez" },
  );

  removeStudent(analysis, student.id);
  assert.equal(analysis.students.length, 0);
});

test("removeData prunes every reference in the rows", () => {
  const { analysis, row } = analysisWithRow();
  updateRowResult(analysis, row.id, { name: "promedio", type: "numeric" });
  const dataId = row.resultId;

  removeData(analysis, dataId);
  assert.equal(analysis.data.length, 0);
  assert.equal(row.resultId, null);
});
