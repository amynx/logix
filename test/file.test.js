// Pruebas de la (de)serialización y validación de archivos .analisis.
// Solo la parte pura (sin navegador): modelo <-> texto.

import { test } from "node:test";
import assert from "node:assert/strict";

import { serializeAnalysis, deserializeAnalysis, fileNameFor } from "../src/services/file/fileService.js";
import { createAnalysis, addRow, ANALYSIS_VERSION } from "../src/models/analysisModel.js";

test("serialize then deserialize preserves the analysis", () => {
  const analysis = createAnalysis({ title: "Calcular promedio" });
  addRow(analysis);

  const restored = deserializeAnalysis(serializeAnalysis(analysis));

  assert.deepEqual(restored, analysis);
});

test("deserializing invalid JSON throws a friendly error", () => {
  assert.throws(() => deserializeAnalysis("{ not json"), /formato de análisis válido/);
});

test("deserializing a wrong version throws a friendly error", () => {
  const payload = JSON.stringify({ version: ANALYSIS_VERSION + 1, id: "x", rows: [] });
  assert.throws(() => deserializeAnalysis(payload), /versión distinta/);
});

test("deserializing without rows throws a friendly error", () => {
  const payload = JSON.stringify({ version: ANALYSIS_VERSION, id: "x" });
  assert.throws(() => deserializeAnalysis(payload), /incompleto o dañado/);
});

test("builds a slugged file name from the title", () => {
  assert.equal(fileNameFor({ title: "Cálculo del Promedio" }), "calculo_del_promedio.analisis");
  assert.equal(fileNameFor({ title: "" }), "analisis.analisis");
});
