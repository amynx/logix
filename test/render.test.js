// Prueba de humo del pipeline de render: monta la aplicación sobre jsdom y
// verifica que la vista refleja el estado y que la edición actualiza el modelo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { AnalysisView } from "../src/views/analysisView.js";
import { StudentsView } from "../src/views/studentsView.js";
import { InputsView } from "../src/views/inputsView.js";
import { TableView } from "../src/views/tableView.js";
import { ChainView } from "../src/views/chainView.js";
import { AnalysisController } from "../src/controllers/analysisController.js";
import { createAnalysis, addRow, findData } from "../src/models/analysisModel.js";
import { serializeAnalysis } from "../src/services/file/fileService.js";

// Storage falso en memoria para inyectar en el controlador sin IndexedDB.
function fakeStorage(initial = []) {
  const items = new Map(initial.map((analysis) => [analysis.id, analysis]));
  return {
    saved: [],
    async getAllAnalyses() {
      return [...items.values()];
    },
    async getAnalysis(id) {
      return items.get(id);
    },
    async saveAnalysis(analysis) {
      const copy = structuredClone(analysis);
      items.set(copy.id, copy);
      this.saved.push(copy);
    },
    async deleteAnalysis(id) {
      items.delete(id);
    },
  };
}

async function mountApp({ storage = fakeStorage() } = {}) {
  const dom = new JSDOM(
    `<!DOCTYPE html><body><div id="toolbar"></div><div id="analysis-info"></div><div id="students-container"></div><div id="inputs-container"></div><div id="table-container"></div><div id="chain-container"></div><div id="print-area"></div></body>`,
  );
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.FileReader = dom.window.FileReader;
  globalThis.URL.createObjectURL = () => "blob:mock"; // jsdom no lo implementa
  globalThis.URL.revokeObjectURL = () => {};

  const doc = dom.window.document;
  const controller = new AnalysisController({
    analysisView: new AnalysisView({
      toolbarContainer: doc.getElementById("toolbar"),
      infoContainer: doc.getElementById("analysis-info"),
    }),
    studentsView: new StudentsView({ container: doc.getElementById("students-container") }),
    inputsView: new InputsView({ container: doc.getElementById("inputs-container") }),
    tableView: new TableView({ container: doc.getElementById("table-container") }),
    chainView: new ChainView({ container: doc.getElementById("chain-container") }),
    storage,
    saveDelay: 0,
  });
  await controller.start();
  return { dom, controller, doc, storage };
}

function fire(node, type) {
  node.dispatchEvent(new globalThis.window.Event(type));
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

// Declara un dato de entrada en la sección y devuelve su id.
function declareInput(doc, controller, name = "", type = "") {
  const before = new Set(controller.analysis.data.map((d) => d.id));
  [...doc.querySelectorAll("#inputs-container button")].find((b) => b.textContent === "+ Agregar dato").click();
  const entry = controller.analysis.data.find((d) => !before.has(d.id));
  const names = doc.querySelectorAll("#inputs-container input");
  const nameInput = names[names.length - 1];
  if (name) {
    nameInput.value = name;
    fire(nameInput, "input");
  }
  if (type) {
    const selects = doc.querySelectorAll("#inputs-container select");
    const sel = selects[selects.length - 1];
    sel.value = type;
    fire(sel, "change");
  }
  return entry.id;
}

// Referencia un dato de entrada (por id) en la columna de la fila indicada.
function referenceInput(doc, rowIndex, dataId) {
  const cell = doc.querySelectorAll("tbody tr")[rowIndex].querySelectorAll("td")[2];
  const picker = [...cell.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === dataId));
  picker.value = dataId;
  fire(picker, "change");
}

test("renders analysis info and a seeded row with all columns", async () => {
  const { doc } = await mountApp();

  assert.ok(doc.getElementById("analysis-title"), "title input exists");
  assert.ok(doc.getElementById("analysis-description"), "description textarea exists");

  assert.equal(doc.querySelectorAll("thead th").length, 11, "11 header cells (# + 9 columns + actions)");
  assert.equal(doc.querySelectorAll("tbody tr").length, 1, "one seeded row");
  assert.equal(doc.querySelectorAll("tbody tr td").length, 11, "row has 11 cells");
});

test("dragging a row onto another reorders the analysis", async () => {
  const { doc, controller } = await mountApp();
  controller.addRow(); // dos filas
  const [firstId, secondId] = controller.analysis.rows.map((row) => row.id);

  const firstHandle = doc.querySelectorAll("tbody tr")[0].querySelector("span[draggable]");
  const secondRow = doc.querySelectorAll("tbody tr")[1];
  firstHandle.dispatchEvent(new globalThis.window.Event("dragstart"));
  secondRow.dispatchEvent(new globalThis.window.Event("drop"));

  assert.deepEqual(
    controller.analysis.rows.map((row) => row.id),
    [secondId, firstId],
    "the first row moved below the second",
  );
});

test("adding a row appends a new editable row", async () => {
  const { doc, controller } = await mountApp();
  const addButton = [...doc.querySelectorAll("button")].find((b) => b.textContent === "+ Agregar fila");

  addButton.click();

  assert.equal(controller.analysis.rows.length, 2);
  assert.equal(doc.querySelectorAll("tbody tr").length, 2);
});

test("deleting a row removes it after confirmation", async () => {
  const { doc, controller } = await mountApp();
  controller.addRow(); // dos filas
  const firstRowId = controller.analysis.rows[0].id;

  doc.querySelector("tbody tr td:last-child button").click(); // abre el diálogo
  const confirmButton = [...doc.querySelectorAll("body > div button")].find((b) => b.textContent === "Eliminar");
  confirmButton.click();
  await new Promise((resolve) => setTimeout(resolve)); // esperar la resolución de la promesa

  assert.equal(controller.analysis.rows.length, 1);
  assert.notEqual(controller.analysis.rows[0].id, firstRowId, "se eliminó la primera fila");
});

test("editing the title updates the model without re-rendering", async () => {
  const { doc, controller } = await mountApp();
  const titleInput = doc.getElementById("analysis-title");

  titleInput.value = "Calcular promedio";
  fire(titleInput, "input");

  assert.equal(controller.analysis.title, "Calcular promedio");
});

test("changing purpose updates the model and re-renders the table", async () => {
  const { doc, controller } = await mountApp();
  const purposeSelect = doc.querySelectorAll("tbody tr td")[6].querySelector("select");

  purposeSelect.value = "decision";
  fire(purposeSelect, "change");

  assert.equal(controller.analysis.rows[0].purpose, "decision");
  assert.equal(doc.querySelectorAll("tbody tr").length, 1, "still one row after re-render");
});

test("condition and branches show as 'no aplica' outside of decisions", async () => {
  const { doc } = await mountApp();
  const conditionCell = () => doc.querySelectorAll("tbody tr td")[3];
  const branchCell = () => doc.querySelectorAll("tbody tr td")[8];
  const purposeSelect = () => doc.querySelectorAll("tbody tr td")[6].querySelector("select");

  // Sin propósito aún: la condición sigue disponible; las ramas no aplican.
  assert.equal(conditionCell().querySelectorAll("textarea").length, 1);
  assert.equal(branchCell().querySelectorAll("select, textarea").length, 0);
  assert.match(branchCell().textContent, /—/);

  // Propósito no-decisión: la condición pasa a "no aplica".
  purposeSelect().value = "operation";
  fire(purposeSelect(), "change");
  assert.equal(conditionCell().querySelectorAll("textarea").length, 0);
  assert.match(conditionCell().textContent, /—/);

  // Decisión: condición y ramas disponibles.
  purposeSelect().value = "decision";
  fire(purposeSelect(), "change");
  assert.equal(conditionCell().querySelectorAll("textarea").length, 1);
  assert.ok(branchCell().querySelectorAll("select, textarea").length > 0);
});

test("a row references a declared input, shown as a read-only chip", async () => {
  const { doc, controller } = await mountApp();
  const inputId = declareInput(doc, controller, "nota1", "numeric");
  assert.equal(controller.analysis.rows[0].inputIds.length, 0, "declararlo no lo agrega a la fila");

  referenceInput(doc, 0, inputId);

  assert.deepEqual(controller.analysis.rows[0].inputIds, [inputId]);
  const cell = doc.querySelectorAll("tbody tr td")[2];
  assert.match(cell.textContent, /nota1/);
  assert.equal(cell.querySelectorAll("input").length, 0, "no hay campo editable en la celda");
});

test("editing result name then type keeps both (no stale overwrite)", async () => {
  const { doc, controller } = await mountApp();
  const resultCell = doc.querySelectorAll("tbody tr td")[5];
  const nameInput = resultCell.querySelector("input");
  const typeSelect = resultCell.querySelector("select");

  nameInput.value = "promedio";
  fire(nameInput, "input");
  typeSelect.value = "numeric";
  fire(typeSelect, "change");

  const result = findData(controller.analysis, controller.analysis.rows[0].resultId);
  assert.equal(result.name, "promedio");
  assert.equal(result.type, "numeric");
});

test("a produced result is selectable in another row's input column", async () => {
  const { doc, controller } = await mountApp();

  // La fila 0 produce "buenas".
  const resultName = doc.querySelectorAll("tbody tr td")[5].querySelector("input");
  resultName.value = "buenas";
  fire(resultName, "input");
  const buenasId = controller.analysis.rows[0].resultId;

  // La fila 1 puede referenciarlo desde su columna "Datos de entrada".
  [...doc.querySelectorAll("button")].find((b) => b.textContent === "+ Agregar fila").click();
  const inputsCell = doc.querySelectorAll("tbody tr")[1].querySelectorAll("td")[2];
  const picker = [...inputsCell.querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === buenasId),
  );
  assert.ok(picker, "el resultado aparece en el selector de datos de entrada");

  picker.value = buenasId;
  fire(picker, "change");
  assert.ok(controller.analysis.rows[1].inputIds.includes(buenasId));
});

test("detaching an input from a row keeps it declared globally", async () => {
  const { doc, controller } = await mountApp();
  const inputId = declareInput(doc, controller, "nota1", "numeric");
  referenceInput(doc, 0, inputId);

  const cell = () => doc.querySelectorAll("tbody tr td")[2];
  [...cell().querySelectorAll("button")].find((b) => b.textContent === "×").click();

  assert.equal(controller.analysis.rows[0].inputIds.length, 0, "se quita la referencia");
  assert.ok(findData(controller.analysis, inputId), "el dato declarado persiste");
});

test("removing a declared input from its section deletes it and prunes references", async () => {
  const { doc, controller } = await mountApp();
  const inputId = declareInput(doc, controller, "nota1", "numeric");
  referenceInput(doc, 0, inputId);

  [...doc.querySelectorAll("#inputs-container button")].find((b) => b.title === "Eliminar dato de entrada").click();

  assert.equal(findData(controller.analysis, inputId), null);
  assert.ok(!controller.analysis.rows[0].inputIds.includes(inputId), "la referencia se poda");
});

test("naming a result refreshes other data pickers and keeps focus", async () => {
  const { doc, controller } = await mountApp();
  [...doc.querySelectorAll("button")].find((b) => b.textContent === "+ Agregar fila").click();

  const resultName = () => doc.querySelectorAll("tbody tr")[0].querySelectorAll("td")[5].querySelector("input");
  resultName().focus();
  resultName().value = "promedio";
  fire(resultName(), "input");

  const promedioId = controller.analysis.rows[0].resultId;
  const opCell = doc.querySelectorAll("tbody tr")[1].querySelectorAll("td")[4];
  assert.ok(
    [...opCell.querySelectorAll("select option")].some((o) => o.value === promedioId),
    "otra fila ya puede referenciar el resultado recién nombrado",
  );
  assert.equal(doc.activeElement, resultName(), "el foco permanece en el campo del resultado");
});

test("renaming a declared input updates its references in the rows live", async () => {
  const { doc, controller } = await mountApp();
  const inputId = declareInput(doc, controller, "promedio", "numeric");
  referenceInput(doc, 0, inputId);

  const nameInput = doc.querySelectorAll("#inputs-container input")[0];
  nameInput.value = "promedioFinal";
  fire(nameInput, "input");

  const cell = doc.querySelectorAll("tbody tr td")[2];
  assert.match(cell.textContent, /promedioFinal/, "la ficha de la fila se actualiza al instante");
});

test("deleting a row warns when its datum is used in another operation", async () => {
  const { doc, controller } = await mountApp();

  // La fila 0 produce "promedio".
  const resultInput = doc.querySelectorAll("tbody tr td")[5].querySelector("input");
  resultInput.value = "promedio";
  fire(resultInput, "input");
  const promedioId = controller.analysis.rows[0].resultId;

  // La fila 1 lo referencia en su operación.
  [...doc.querySelectorAll("button")].find((b) => b.textContent === "+ Agregar fila").click();
  const opCell = doc.querySelectorAll("tbody tr")[1].querySelectorAll("td")[4];
  const dataSelect = [...opCell.querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === promedioId),
  );
  dataSelect.value = promedioId;
  fire(dataSelect, "change");
  const secondRowId = controller.analysis.rows[1].id;

  doc.querySelectorAll("tbody tr")[0].querySelector("td:last-child button").click();
  assert.match(doc.body.textContent, /reutilizado en/, "el aviso menciona la reutilización");
  [...doc.querySelectorAll("body > div button")].find((b) => b.textContent === "Eliminar").click();
  await flush();

  assert.equal(controller.analysis.rows.length, 1);
  assert.equal(findData(controller.analysis, promedioId), null);
  const remaining = controller.analysis.rows.find((r) => r.id === secondRowId);
  assert.ok(
    !remaining.operation.some((t) => t.kind === "ref" && t.dataId === promedioId),
    "la referencia en la operación se poda",
  );
});

test("the operation builder offers all data, not only the row's inputs", async () => {
  const { doc, controller } = await mountApp();
  const inputId = declareInput(doc, controller, "nota1", "numeric");

  // Sin referenciarlo en la columna de entrada, ya está disponible en la operación.
  const opCell = doc.querySelectorAll("tbody tr td")[4];
  const dataSelect = [...opCell.querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === inputId),
  );
  assert.ok(dataSelect, "la operación ofrece el dato aunque la fila no lo consuma como entrada");
});

test("building an operation references data and shows it in the chain", async () => {
  const { doc, controller } = await mountApp();

  // Declara "nota1" y lo referencia en la fila.
  const dataId = declareInput(doc, controller, "nota1", "numeric");
  referenceInput(doc, 0, dataId);

  // Construye la operación: referencia nota1, operador ÷ y literal 3.
  const opCell = () => doc.querySelectorAll("tbody tr td")[4];
  const dataSelect = [...opCell().querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === dataId),
  );
  dataSelect.value = dataId;
  fire(dataSelect, "change");

  const opSelect = [...opCell().querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === "div"),
  );
  opSelect.value = "div";
  fire(opSelect, "change");

  const literal = opCell().querySelector('input[placeholder="valor"]');
  literal.value = "3";
  [...opCell().querySelectorAll("button")].find((b) => b.textContent === "+ valor").click();

  const operation = controller.analysis.rows[0].operation;
  assert.deepEqual(operation.map((t) => t.kind), ["ref", "op", "literal"]);
  assert.equal(operation[0].dataId, dataId);
  assert.match(doc.getElementById("chain-container").textContent, /nota1 ÷ 3/);
});

test("operation tokens can be reordered by drag and drop", async () => {
  const { doc, controller } = await mountApp();
  const opCell = () => doc.querySelectorAll("tbody tr td")[4];
  const addLiteral = (value) => {
    const literal = opCell().querySelector('input[placeholder="valor"]');
    literal.value = value;
    [...opCell().querySelectorAll("button")].find((b) => b.textContent === "+ valor").click();
  };
  addLiteral("A");
  addLiteral("B");

  const chips = opCell().querySelectorAll("span[draggable]");
  fire(chips[1], "dragstart");
  fire(chips[0], "drop");

  assert.deepEqual(controller.analysis.rows[0].operation.map((t) => t.value), ["B", "A"]);
});

test("parentheses are available as grouping operators", async () => {
  const { doc, controller } = await mountApp();
  const opCell = () => doc.querySelectorAll("tbody tr td")[4];
  const opSelect = [...opCell().querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === "lparen"),
  );
  assert.ok(opSelect, "el selector ofrece paréntesis");
  opSelect.value = "lparen";
  fire(opSelect, "change");

  assert.deepEqual(controller.analysis.rows[0].operation, [{ kind: "op", op: "lparen" }]);
});

test("the result type is suggested from the operation when unset", async () => {
  const { doc, controller } = await mountApp();

  const resultName = doc.querySelectorAll("tbody tr td")[5].querySelector("input");
  resultName.value = "promedio";
  fire(resultName, "input");

  const opCell = () => doc.querySelectorAll("tbody tr td")[4];
  const addLiteral = (value) => {
    const literal = opCell().querySelector('input[placeholder="valor"]');
    literal.value = value;
    [...opCell().querySelectorAll("button")].find((b) => b.textContent === "+ valor").click();
  };
  addLiteral("2");
  const opSelect = [...opCell().querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === "add"),
  );
  opSelect.value = "add";
  fire(opSelect, "change");
  addLiteral("3");

  const result = findData(controller.analysis, controller.analysis.rows[0].resultId);
  assert.equal(result.type, "numeric", "operación aritmética sugiere Numérico");
});

test("the result type is suggested when the result is named after the operation", async () => {
  const { doc, controller } = await mountApp();

  // Primero se construye la operación 2 + 3...
  const opCell = () => doc.querySelectorAll("tbody tr td")[4];
  const addLiteral = (value) => {
    const literal = opCell().querySelector('input[placeholder="valor"]');
    literal.value = value;
    [...opCell().querySelectorAll("button")].find((b) => b.textContent === "+ valor").click();
  };
  addLiteral("2");
  const opSelect = [...opCell().querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === "add"),
  );
  opSelect.value = "add";
  fire(opSelect, "change");
  addLiteral("3");

  // ...y luego se nombra el resultado.
  const resultName = doc.querySelectorAll("tbody tr td")[5].querySelector("input");
  resultName.value = "suma";
  fire(resultName, "input");

  const result = findData(controller.analysis, controller.analysis.rows[0].resultId);
  assert.equal(result.type, "numeric");
  const typeSelect = doc.querySelectorAll("tbody tr td")[5].querySelector("select");
  assert.equal(typeSelect.value, "numeric", "el select refleja la sugerencia");
});

test("the condition is a free-text natural-language question", async () => {
  const { doc, controller } = await mountApp();

  const conditionField = doc.querySelectorAll("tbody tr td")[3].querySelector("textarea");
  assert.ok(conditionField, "la condición es un campo de texto, no un constructor");

  conditionField.value = "¿El promedio es mayor o igual a 3?";
  fire(conditionField, "input");

  assert.equal(controller.analysis.rows[0].condition, "¿El promedio es mayor o igual a 3?");
});

test("the students section records identification, name and group", async () => {
  const { doc, controller } = await mountApp();
  [...doc.querySelectorAll("#students-container button")].find((b) => b.textContent === "+ Agregar estudiante").click();
  assert.equal(controller.analysis.students.length, 1);

  const inputs = doc.querySelectorAll("#students-container input");
  const set = (input, value) => {
    input.value = value;
    fire(input, "input");
  };
  set(inputs[0], "123");
  set(inputs[1], "Ana Pérez");
  set(inputs[2], "N1");

  const student = controller.analysis.students[0];
  assert.equal(student.idNumber, "123");
  assert.equal(student.fullName, "Ana Pérez");
  assert.equal(student.group, "N1");
});

test("the branch builder appears only when the path is a response", async () => {
  const { doc } = await mountApp();
  const purpose = doc.querySelectorAll("tbody tr td")[6].querySelector("select");
  purpose.value = "decision";
  fire(purpose, "change");

  const branchCell = () => doc.querySelectorAll("tbody tr td")[8];
  const typeSelect = () => branchCell().querySelector("select");

  assert.equal(branchCell().querySelectorAll("select").length, 1, "sin tipo: solo el selector");

  typeSelect().value = "operation";
  fire(typeSelect(), "change");
  assert.equal(branchCell().querySelectorAll("select").length, 1, "operación: sin constructor");

  typeSelect().value = "response";
  fire(typeSelect(), "change");
  assert.ok(branchCell().querySelectorAll("select").length > 1, "respuesta: aparece el constructor");
});

test("a decision branch response can reference existing data", async () => {
  const { doc, controller } = await mountApp();

  // La fila 0 produce "promedio".
  const resultName = doc.querySelectorAll("tbody tr td")[5].querySelector("input");
  resultName.value = "promedio";
  fire(resultName, "input");
  const promedioId = controller.analysis.rows[0].resultId;

  // Fila 1: decisión con rama "Si se cumple" de tipo Respuesta que referencia el dato.
  [...doc.querySelectorAll("button")].find((b) => b.textContent === "+ Agregar fila").click();
  const row1 = () => doc.querySelectorAll("tbody tr")[1];
  row1().querySelectorAll("td")[6].querySelector("select").value = "decision";
  fire(row1().querySelectorAll("td")[6].querySelector("select"), "change");

  const branchCell = () => row1().querySelectorAll("td")[8];
  branchCell().querySelector("select").value = "response"; // el tipo de la rama
  fire(branchCell().querySelector("select"), "change");

  // Ahora aparece el constructor de la respuesta: se referencia el dato.
  const dataSelect = [...branchCell().querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === promedioId),
  );
  dataSelect.value = promedioId;
  fire(dataSelect, "change");

  const tokens = controller.analysis.rows[1].ifTrue.value;
  assert.deepEqual(tokens.map((t) => t.kind), ["ref"]);
  assert.equal(tokens[0].dataId, promedioId);
});

test("the chain panel reflects external inputs and final outputs live", async () => {
  const { doc, controller } = await mountApp();
  const chainText = () => doc.getElementById("chain-container").textContent;

  // "nota1" declarado como dato de entrada aparece en las ENTRADAS de la cadena.
  declareInput(doc, controller, "nota1", "numeric");

  const purposeSelect = doc.querySelectorAll("tbody tr td")[6].querySelector("select");
  purposeSelect.value = "response";
  fire(purposeSelect, "change");

  // El comentario es texto libre.
  const comment = doc.querySelectorAll("tbody tr td")[7].querySelector("textarea");
  comment.value = "Mostrar el resultado";
  fire(comment, "input");

  const text = chainText();
  assert.match(text, /Entradas/);
  assert.match(text, /nota1/);
  assert.match(text, /Salida/);
  assert.match(text, /Mostrar el resultado/);
});

test("recovers the most recently updated analysis on start", async () => {
  const older = createAnalysis({ title: "Viejo", updatedAt: "2026-01-01T00:00:00.000Z" });
  const newer = createAnalysis({ title: "Reciente", updatedAt: "2026-06-01T00:00:00.000Z" });
  const { controller } = await mountApp({ storage: fakeStorage([older, newer]) });

  assert.equal(controller.analysis.id, newer.id);
  assert.equal(controller.analysis.title, "Reciente");
});

test("auto-saves the analysis after an edit", async () => {
  const { doc, controller, storage } = await mountApp();
  const titleInput = doc.getElementById("analysis-title");

  titleInput.value = "Calcular promedio";
  fire(titleInput, "input");
  await flush();

  const lastSaved = storage.saved.at(-1);
  assert.equal(lastSaved.id, controller.analysis.id);
  assert.equal(lastSaved.title, "Calcular promedio");
});

test("toolbar exposes new, open and save actions", async () => {
  const { doc } = await mountApp();
  const labels = [...doc.querySelectorAll("#toolbar button")].map((b) => b.textContent);
  assert.deepEqual(labels, ["Nuevo análisis", "Abrir análisis", "Guardar archivo"]);
});

test("creating a new analysis resets to a single empty row", async () => {
  const { doc, controller } = await mountApp();
  const previousId = controller.analysis.id;
  controller.addRow(); // el actual tiene 2 filas

  controller.newAnalysis();

  assert.notEqual(controller.analysis.id, previousId);
  assert.equal(controller.analysis.rows.length, 1);
  assert.equal(doc.querySelectorAll("tbody tr").length, 1);
});

test("opening a valid file loads it into the editor", async () => {
  const { dom, doc, controller } = await mountApp();
  const source = createAnalysis({ title: "Importado" });
  addRow(source);
  addRow(source);
  const file = new dom.window.File([serializeAnalysis(source)], "demo.analisis", { type: "application/json" });

  await controller.openFile(file);

  assert.equal(controller.analysis.id, source.id);
  assert.equal(doc.getElementById("analysis-title").value, "Importado");
  assert.equal(doc.querySelectorAll("tbody tr").length, 2);
});

test("opening an invalid file shows a friendly message and keeps the analysis", async () => {
  const { dom, doc, controller } = await mountApp();
  const currentId = controller.analysis.id;
  const file = new dom.window.File(["{ not json"], "broken.analisis", { type: "application/json" });

  await controller.openFile(file);

  assert.equal(controller.analysis.id, currentId, "analysis unchanged after failed import");
  assert.match(doc.body.textContent, /formato de análisis válido/);
});

test("saving warns about incomplete analysis and can be cancelled", async () => {
  const { doc, controller } = await mountApp(); // título vacío => hay advertencia
  const saving = controller.saveToFile();

  assert.match(doc.body.textContent, /puntos por completar/);
  [...doc.querySelectorAll("button")].find((b) => b.textContent === "Revisar").click();
  await saving;
});

test("saving a complete analysis exports without warnings", async () => {
  const { doc, controller } = await mountApp();
  controller.analysis.title = "Análisis listo"; // sin filas problemáticas

  await controller.saveToFile();

  assert.doesNotMatch(doc.body.textContent, /puntos por completar/);
});
