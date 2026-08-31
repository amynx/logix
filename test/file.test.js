// Pruebas de la (de)serialización y validación de archivos .analisis.
// Solo la parte pura (sin navegador): modelo <-> texto.

import { test } from "node:test";
import assert from "node:assert/strict";

import { serializeAnalysis, deserializeAnalysis, fileNameFor } from "../src/services/file/fileService.js";
import { collectAnalysisWarnings } from "../src/validation/analysisValidation.js";
import { createAnalysis, createRow, addRow, ANALYSIS_VERSION } from "../src/models/analysisModel.js";

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

test("migrates a v2 operation string into a preserved literal token", () => {
  const v2 = {
    version: 2,
    id: "a",
    title: "Demo",
    description: "",
    data: [],
    rows: [
      {
        id: "r",
        problem: "",
        inputIds: [],
        condition: "",
        operation: "sumar las notas",
        resultId: null,
        purpose: "",
        subsequentUse: "",
        ifTrue: { type: "", value: "" },
        ifFalse: { type: "", value: "" },
      },
    ],
    createdAt: "x",
    updatedAt: "y",
  };

  const migrated = deserializeAnalysis(JSON.stringify(v2));

  assert.equal(migrated.version, ANALYSIS_VERSION);
  assert.deepEqual(migrated.rows[0].operation, [{ kind: "literal", value: "sumar las notas" }]);
});

test("keeps the condition as natural-language text through migration", () => {
  const v3 = {
    version: 3,
    id: "a",
    title: "Demo",
    description: "",
    data: [],
    rows: [
      {
        id: "r",
        problem: "",
        inputIds: [],
        condition: "¿el promedio es alto?",
        operation: [],
        resultId: null,
        purpose: "decision",
        subsequentUse: "",
        ifTrue: { type: "", value: "" },
        ifFalse: { type: "", value: "" },
      },
    ],
    createdAt: "x",
    updatedAt: "y",
  };

  const migrated = deserializeAnalysis(JSON.stringify(v3));

  assert.equal(migrated.version, ANALYSIS_VERSION);
  assert.equal(migrated.rows[0].condition, "¿el promedio es alto?");
});

test("migrates old files: comment stays text, path detail becomes an expression", () => {
  const v5 = {
    version: 5,
    id: "a",
    title: "Demo",
    description: "",
    data: [],
    rows: [
      {
        id: "r",
        problem: "",
        inputIds: [],
        condition: "",
        operation: [],
        resultId: null,
        purpose: "response",
        subsequentUse: "Mostrar el promedio",
        ifTrue: { type: "response", value: "Aprobó" },
        ifFalse: { type: "", value: "" },
      },
    ],
    createdAt: "x",
    updatedAt: "y",
  };

  const migrated = deserializeAnalysis(JSON.stringify(v5));

  assert.equal(migrated.version, ANALYSIS_VERSION);
  assert.equal(migrated.rows[0].subsequentUse, "Mostrar el promedio", "el comentario vuelve a texto");
  assert.deepEqual(migrated.rows[0].ifTrue.value, [{ kind: "literal", value: "Aprobó" }], "el detalle de la rama es expresión");
  assert.deepEqual(migrated.rows[0].ifFalse.value, []);
});

test("deserializing a future version throws a friendly error", () => {
  const payload = JSON.stringify({ version: ANALYSIS_VERSION + 1, id: "x", rows: [] });
  assert.throws(() => deserializeAnalysis(payload), /versión distinta/);
});

test("migrates a v1 file to the data catalog and relinks by name", () => {
  const v1 = {
    version: 1,
    id: "a1",
    title: "Promedio",
    description: "",
    rows: [
      {
        id: "r1",
        inputs: [{ name: "nota1", type: "numeric" }],
        operation: "sumar y dividir",
        result: { name: "promedio", type: "numeric" },
        purpose: "operation",
      },
      {
        id: "r2",
        inputs: [{ name: "promedio", type: "numeric" }],
        condition: "¿promedio >= 3?",
        result: { name: "", type: "" },
        purpose: "decision",
      },
    ],
    createdAt: "x",
    updatedAt: "y",
  };

  const migrated = deserializeAnalysis(JSON.stringify(v1));

  assert.equal(migrated.version, ANALYSIS_VERSION);
  const [r1, r2] = migrated.rows;
  assert.ok(r1.resultId, "the operation row produces a datum");
  assert.equal(r2.inputIds.length, 1);
  assert.equal(r2.inputIds[0], r1.resultId, "the reused 'promedio' links to the produced datum");
  assert.ok(migrated.data.some((d) => d.name === "nota1"));
});

test("builds a slugged file name from the title", () => {
  assert.equal(fileNameFor({ title: "Cálculo del Promedio" }), "calculo_del_promedio.analisis");
  assert.equal(fileNameFor({ title: "" }), "analisis.analisis");
});

test("warns about an empty title", () => {
  const analysis = createAnalysis();
  addRow(analysis);
  assert.ok(collectAnalysisWarnings(analysis).some((w) => /título/.test(w)));
});

test("warns when an operation produces an unnamed result", () => {
  const analysis = createAnalysis({ title: "Demo" });
  addRow(analysis, createRow({ operation: "Sumar las notas" }));
  assert.ok(collectAnalysisWarnings(analysis).some((w) => /sin nombre/.test(w)));
});

test("warns when a decision has no condition", () => {
  const analysis = createAnalysis({ title: "Demo" });
  addRow(analysis, createRow({ purpose: "decision" }));
  assert.ok(collectAnalysisWarnings(analysis).some((w) => /condición/.test(w)));
});

test("no warnings for a titled analysis without problematic rows", () => {
  const analysis = createAnalysis({ title: "Demo" });
  assert.deepEqual(collectAnalysisWarnings(analysis), []);
});
