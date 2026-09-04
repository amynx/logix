// Prueba de humo del pipeline de render: monta la aplicación sobre jsdom y
// verifica que la vista refleja el estado y que la edición actualiza el modelo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { AnalysisView } from "../src/views/analysisView.js";
import { StudentsView } from "../src/views/studentsView.js";
import { InputsView } from "../src/views/inputsView.js";
import { TableView } from "../src/views/tableView.js";
import { CardsView } from "../src/views/cardsView.js";
import { ChainView } from "../src/views/chainView.js";
import { CompletenessView } from "../src/views/completenessView.js";
import { PdfView } from "../src/views/pdfView.js";
import { AnalysisController } from "../src/controllers/analysisController.js";
import { setExampleTutorialLoader } from "../src/views/guideView.js";
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
    `<!DOCTYPE html><body><div id="toolbar"></div><div id="save-status"></div><div id="history-controls"></div><div id="analysis-info"></div><div id="students-container"></div><div id="inputs-container"></div><div id="table-container"></div><div id="completeness-container"></div><div id="chain-container"></div><div id="print-area"></div></body>`,
  );
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.FileReader = dom.window.FileReader;
  globalThis.URL.createObjectURL = () => "blob:mock"; // jsdom no lo implementa
  globalThis.URL.revokeObjectURL = () => {};
  dom.window.print = () => {}; // jsdom no implementa la impresión

  const doc = dom.window.document;
  const controller = new AnalysisController({
    analysisView: new AnalysisView({
      toolbarContainer: doc.getElementById("toolbar"),
      infoContainer: doc.getElementById("analysis-info"),
      statusContainer: doc.getElementById("save-status"),
      historyContainer: doc.getElementById("history-controls"),
    }),
    studentsView: new StudentsView({ container: doc.getElementById("students-container") }),
    inputsView: new InputsView({ container: doc.getElementById("inputs-container") }),
    tableView: new TableView({ container: doc.getElementById("table-container") }),
    cardsView: new CardsView({ container: doc.getElementById("table-container") }),
    chainView: new ChainView({ container: doc.getElementById("chain-container") }),
    completenessView: new CompletenessView({ container: doc.getElementById("completeness-container") }),
    pdfView: new PdfView({ container: doc.getElementById("print-area") }),
    storage,
    saveDelay: 0,
  });
  setExampleTutorialLoader(() => controller.loadStudentGradeExample());
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
  const nameInput = [...doc.querySelectorAll('#inputs-container input[placeholder="nombre"]')].at(-1);
  if (name) {
    nameInput.value = name;
    fire(nameInput, "input");
  }
  if (type) {
    // El select de tipo es el que ofrece el tipo pedido (no el de "Formatear nombres").
    const sel = [...doc.querySelectorAll("#inputs-container select")].find((s) => [...s.options].some((o) => o.value === type));
    sel.value = type;
    fire(sel, "change");
  }
  return entry.id;
}

// Referencia un dato de entrada (por id) en la columna de la fila indicada.
function referenceInput(doc, rowIndex, dataId) {
  const cell = doc.querySelectorAll("#table-container tbody tr")[rowIndex].querySelectorAll("td")[2];
  const picker = [...cell.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === dataId));
  picker.value = dataId;
  fire(picker, "change");
}

// Constructor visual de expresiones: agrega un dato o valor (escribiendo el texto)
// o un operador (por su clave, con el botón rápido). `cell` es la celda editable.
function addExprElement(cell, text) {
  const input = cell.querySelector("input[list]");
  input.value = text;
  [...cell.querySelectorAll("button")].find((b) => b.textContent === "Agregar").click();
}
function addExprOperator(cell, opKey) {
  cell.querySelector(`button[data-op="${opKey}"]`).click();
}

test("renders analysis info and a seeded row with all columns", async () => {
  const { doc } = await mountApp();

  assert.ok(doc.getElementById("analysis-title"), "title input exists");
  assert.ok(doc.getElementById("analysis-description"), "description textarea exists");

  assert.equal(doc.querySelectorAll("thead th").length, 12, "12 header cells (# + 10 columns + actions)");
  assert.equal(doc.querySelectorAll("#table-container tbody tr").length, 1, "one seeded row");
  assert.equal(doc.querySelectorAll("#table-container tbody tr td").length, 12, "row has 12 cells");
});

test("dragging a row onto another reorders the analysis", async () => {
  const { doc, controller } = await mountApp();
  controller.addRow(); // dos filas
  const [firstId, secondId] = controller.analysis.rows.map((row) => row.id);

  const firstHandle = doc.querySelectorAll("#table-container tbody tr")[0].querySelector("span[draggable]");
  const secondRow = doc.querySelectorAll("#table-container tbody tr")[1];
  firstHandle.dispatchEvent(new globalThis.window.Event("dragstart"));
  secondRow.dispatchEvent(new globalThis.window.Event("drop"));

  assert.deepEqual(
    controller.analysis.rows.map((row) => row.id),
    [secondId, firstId],
    "the first row moved below the second",
  );
});

test("switching to the cards view shows the same activities and preserves order", async () => {
  const { doc, controller } = await mountApp();
  controller.addRow();
  const ids = controller.analysis.rows.map((r) => r.id);

  [...doc.querySelectorAll("#table-container button")].find((b) => b.textContent === "Tarjetas").click();
  assert.equal(controller.viewMode, "cards");
  assert.equal(doc.querySelectorAll("#table-container tbody tr").length, 0, "ya no hay tabla");
  const cards = doc.querySelectorAll("#table-container [data-row-id]");
  assert.equal(cards.length, 2, "una card por actividad");
  assert.deepEqual([...cards].map((c) => c.dataset.rowId), ids, "mismo orden");

  [...doc.querySelectorAll("#table-container button")].find((b) => b.textContent === "Tabla").click();
  assert.equal(controller.viewMode, "table");
  assert.deepEqual(controller.analysis.rows.map((r) => r.id), ids, "los datos y el orden no cambian");
});

test("editing in the cards view updates the same analysis", async () => {
  const { doc, controller } = await mountApp();
  [...doc.querySelectorAll("#table-container button")].find((b) => b.textContent === "Tarjetas").click();

  const resultName = doc.querySelector('[data-focus-key^="res-name:"]');
  resultName.value = "promedio";
  fire(resultName, "input");

  const result = findData(controller.analysis, controller.analysis.rows[0].resultId);
  assert.equal(result.name, "promedio");

  [...doc.querySelectorAll("#table-container button")].find((b) => b.textContent === "Tabla").click();
  assert.equal(doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input").value, "promedio", "se ve igual en la tabla");
});

test("a card toggles between edit and view mode", async () => {
  const { doc, controller } = await mountApp();
  [...doc.querySelectorAll("#table-container button")].find((b) => b.textContent === "Tarjetas").click();

  const card = () => doc.querySelector("#table-container [data-row-id]");
  const rowId = card().dataset.rowId;
  const btn = (re) => [...card().querySelectorAll("button")].find((b) => re.test(b.textContent));

  // La actividad inicial arranca en modo edición (aún no tiene información que ver).
  assert.equal(card().dataset.editing, "true");
  assert.ok(btn(/Listo/), "muestra «Listo» durante la edición");

  btn(/Listo/).click();
  assert.equal(controller.editingRows.has(rowId), false, "deja de estar en edición");
  assert.equal(card().dataset.editing, "false");
  assert.ok(btn(/Editar/), "muestra «Editar» en visualización");

  btn(/Editar/).click();
  assert.equal(controller.editingRows.has(rowId), true, "vuelve a edición");
  assert.equal(card().dataset.editing, "true");
});

test("finishing edit in the table shows the read-only summary with an Editar action", async () => {
  const { doc, controller } = await mountApp();

  // Registra un resultado y termina la edición de la fila inicial.
  const resultName = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultName.value = "promedio";
  fire(resultName, "input");
  const rowId = controller.analysis.rows[0].id;

  [...doc.querySelector("#table-container tbody tr").querySelectorAll("button")].find((b) => /Listo/.test(b.textContent)).click();

  assert.equal(controller.editingRows.has(rowId), false);
  const row = doc.querySelector("#table-container tbody tr");
  assert.equal(row.dataset.editing, "false");
  assert.equal(row.querySelectorAll("input, select, textarea").length, 0, "sin controles en visualización");
  assert.match(row.querySelectorAll("td")[5].textContent, /promedio/, "muestra la información registrada");
  assert.ok([...row.querySelectorAll("button")].some((b) => /Editar/.test(b.textContent)), "ofrece «Editar»");
});

test("cards can be reordered by drag and drop", async () => {
  const { doc, controller } = await mountApp();
  controller.addRow();
  const [firstId, secondId] = controller.analysis.rows.map((r) => r.id);

  [...doc.querySelectorAll("#table-container button")].find((b) => b.textContent === "Tarjetas").click();
  const cards = doc.querySelectorAll("#table-container [data-row-id]");
  cards[0].querySelector("span[draggable]").dispatchEvent(new globalThis.window.Event("dragstart"));
  cards[1].dispatchEvent(new globalThis.window.Event("drop"));

  assert.deepEqual(controller.analysis.rows.map((r) => r.id), [secondId, firstId], "el orden cambia igual que en la tabla");
});

test("adding a row appends a new editable row", async () => {
  const { doc, controller } = await mountApp();
  const addButton = [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación"));

  addButton.click();

  assert.equal(controller.analysis.rows.length, 2);
  assert.equal(doc.querySelectorAll("#table-container tbody tr").length, 2);
});

test("deleting a row removes it after confirmation", async () => {
  const { doc, controller } = await mountApp();
  controller.addRow(); // dos filas
  const firstRowId = controller.analysis.rows[0].id;

  doc.querySelector('tbody tr [title="Eliminar actividad"]').click(); // abre el diálogo
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
  const purposeSelect = doc.querySelectorAll("#table-container tbody tr td")[6].querySelector("select");

  purposeSelect.value = "decision";
  fire(purposeSelect, "change");

  assert.equal(controller.analysis.rows[0].purpose, "decision");
  assert.equal(doc.querySelectorAll("#table-container tbody tr").length, 1, "still one row after re-render");
});

test("the condition is optional per activity and a decision always uses it", async () => {
  const { doc } = await mountApp();
  const conditionCell = () => doc.querySelectorAll("#table-container tbody tr td")[3];
  const branchCell = () => doc.querySelectorAll("#table-container tbody tr td")[9];
  const purposeSelect = () => doc.querySelectorAll("#table-container tbody tr td")[6].querySelector("select");
  const conditionToggle = () => conditionCell().querySelector('input[type="checkbox"]');

  // Sin propósito: la condición es opcional; se ofrece un interruptor, no un campo
  // ni un "no aplica" que parezca olvidado.
  assert.ok(conditionToggle(), "hay un interruptor para activar la condición");
  assert.equal(conditionCell().querySelectorAll("textarea").length, 0);
  assert.doesNotMatch(conditionCell().textContent, /—/);
  assert.equal(branchCell().querySelectorAll("select, textarea").length, 0);

  // Activar el interruptor revela el campo de condición.
  conditionToggle().checked = true;
  fire(conditionToggle(), "change");
  assert.equal(conditionCell().querySelectorAll("textarea").length, 1);

  // Propósito no-decisión: la condición sigue siendo opcional (interruptor).
  purposeSelect().value = "operation";
  fire(purposeSelect(), "change");
  assert.ok(conditionCell().querySelector('input[type="checkbox"]'), "sigue opcional");

  // Decisión: la condición es intrínseca (campo siempre) y las ramas están disponibles.
  purposeSelect().value = "decision";
  fire(purposeSelect(), "change");
  assert.equal(conditionCell().querySelectorAll("textarea").length, 1);
  assert.equal(conditionCell().querySelector('input[type="checkbox"]'), null, "la decisión no muestra interruptor");
  assert.ok(branchCell().querySelectorAll("select, textarea").length > 0);
});

test("a row references a declared input, shown as a read-only chip", async () => {
  const { doc, controller } = await mountApp();
  const inputId = declareInput(doc, controller, "nota1", "numeric");
  assert.equal(controller.analysis.rows[0].inputIds.length, 0, "declararlo no lo agrega a la fila");

  referenceInput(doc, 0, inputId);

  assert.deepEqual(controller.analysis.rows[0].inputIds, [inputId]);
  const cell = doc.querySelectorAll("#table-container tbody tr td")[2];
  assert.match(cell.textContent, /nota1/);
  assert.equal(cell.querySelectorAll("input").length, 0, "no hay campo editable en la celda");
});

test("editing result name then type keeps both (no stale overwrite)", async () => {
  const { doc, controller } = await mountApp();
  const resultCell = doc.querySelectorAll("#table-container tbody tr td")[5];
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
  const resultName = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultName.value = "buenas";
  fire(resultName, "input");
  const buenasId = controller.analysis.rows[0].resultId;

  // La fila 1 puede referenciarlo desde su columna "Datos de entrada".
  [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación")).click();
  const inputsCell = doc.querySelectorAll("#table-container tbody tr")[1].querySelectorAll("td")[2];
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

  const cell = () => doc.querySelectorAll("#table-container tbody tr td")[2];
  [...cell().querySelectorAll("button")].find((b) => b.textContent === "×").click();

  assert.equal(controller.analysis.rows[0].inputIds.length, 0, "se quita la referencia");
  assert.ok(findData(controller.analysis, inputId), "el dato declarado persiste");
});

test("the students section collapses to read-only chips when done", async () => {
  const { doc } = await mountApp();
  [...doc.querySelectorAll("#students-container button")].find((b) => b.textContent === "+ Agregar estudiante").click();
  const inputs = () => doc.querySelectorAll("#students-container input:not(#analysis-group)");
  inputs()[0].value = "1001";
  fire(inputs()[0], "input");
  inputs()[1].value = "Ana Pérez";
  fire(inputs()[1], "input");
  assert.ok(inputs().length > 0, "en edición hay campos del estudiante");

  const btn = (re) => [...doc.querySelectorAll("#students-container button")].find((b) => re.test(b.textContent));
  btn(/Listo/).click();
  assert.equal(inputs().length, 0, "en visualización se ocultan los controles del estudiante");
  assert.match(doc.getElementById("students-container").textContent, /ANA PÉREZ/, "muestra el estudiante registrado en mayúsculas");
  assert.equal(doc.getElementById("analysis-group"), null, "el grupo también se colapsa en visualización");

  btn(/Editar estudiantes/).click();
  assert.ok(inputs().length > 0, "los controles reaparecen para editar");
  assert.ok(doc.getElementById("analysis-group"), "el grupo vuelve a ser editable");
});

test("the inputs section collapses to read-only chips when done", async () => {
  const { doc, controller } = await mountApp();
  declareInput(doc, controller, "edad", "numeric");
  assert.ok(doc.querySelector('#inputs-container input[type="text"]'), "en edición hay campos");

  const btn = (re) => [...doc.querySelectorAll("#inputs-container button")].find((b) => re.test(b.textContent));
  btn(/Listo/).click();
  assert.equal(doc.querySelector("#inputs-container input"), null, "en visualización se ocultan los controles");
  assert.match(doc.getElementById("inputs-container").textContent, /edad/, "muestra el dato registrado");

  btn(/Editar datos/).click();
  assert.ok(doc.querySelector("#inputs-container input"), "los controles reaparecen para agregar más");
});

test("selecting a fragment of the statement adds it as an input datum", async () => {
  const { doc, controller } = await mountApp();
  // El enunciado es opcional: se activa con la casilla antes de usarlo.
  assert.equal(doc.getElementById("analysis-statement"), null, "el enunciado está oculto por defecto");
  doc.querySelector("#analysis-info input[type='checkbox']").click();

  const statement = doc.getElementById("analysis-statement");
  assert.ok(statement, "al activarlo aparece el campo de enunciado");

  statement.value = "Una empresa produce 500 unidades utilizando 10 trabajadores.";
  fire(statement, "input");
  const start = statement.value.indexOf("500 unidades");
  statement.setSelectionRange(start, start + "500 unidades".length);
  fire(statement, "mouseup");

  const addBtn = [...doc.querySelectorAll("#analysis-info button")].find((b) => /como dato de entrada/.test(b.textContent));
  assert.ok(addBtn, "aparece la acción para agregar la selección");
  addBtn.click();

  assert.equal(controller.analysis.data.length, 1, "se agrega un dato");
  const entry = controller.analysis.data[0];
  assert.equal(entry.source, "500 unidades", "conserva el fragmento de origen");
  assert.equal(entry.value, "500", "extrae el valor evidente");
  assert.equal(entry.name, "", "el nombre lo pone el estudiante");
});

test("formatting input names applies the chosen convention", async () => {
  const { doc, controller } = await mountApp();
  const declare = (name) => {
    [...doc.querySelectorAll("#inputs-container button")].find((b) => b.textContent === "+ Agregar dato").click();
    const nameInput = [...doc.querySelectorAll('#inputs-container input[placeholder="nombre"]')].at(-1);
    nameInput.value = name;
    fire(nameInput, "input");
  };
  declare("unidades producidas");
  declare("cantidad trabajadores");

  const formatSelect = [...doc.querySelectorAll("#inputs-container select")].find((s) => [...s.options].some((o) => o.value === "camel"));
  assert.ok(formatSelect, "hay un selector de formateo");
  formatSelect.value = "camel";
  fire(formatSelect, "change");

  assert.deepEqual(controller.analysis.data.map((d) => d.name), ["unidadesProducidas", "cantidadTrabajadores"]);
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
  [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación")).click();

  const resultName = () => doc.querySelectorAll("#table-container tbody tr")[0].querySelectorAll("td")[5].querySelector("input");
  resultName().focus();
  resultName().value = "promedio";
  fire(resultName(), "input");

  const opCell = doc.querySelectorAll("#table-container tbody tr")[1].querySelectorAll("td")[4];
  assert.ok(
    [...opCell.querySelectorAll("datalist option")].some((o) => o.value === "promedio"),
    "otra fila ya puede referenciar el resultado recién nombrado",
  );
  assert.equal(doc.activeElement, resultName(), "el foco permanece en el campo del resultado");
});

test("renaming a declared input updates its references in the rows live", async () => {
  const { doc, controller } = await mountApp();
  const inputId = declareInput(doc, controller, "promedio", "numeric");
  referenceInput(doc, 0, inputId);

  const nameInput = doc.querySelector('#inputs-container input[placeholder="nombre"]');
  nameInput.value = "promedioFinal";
  fire(nameInput, "input");

  const cell = doc.querySelectorAll("#table-container tbody tr td")[2];
  assert.match(cell.textContent, /promedioFinal/, "la ficha de la fila se actualiza al instante");
});

test("deleting a row warns when its datum is used in another operation", async () => {
  const { doc, controller } = await mountApp();

  // La fila 0 produce "promedio".
  const resultInput = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultInput.value = "promedio";
  fire(resultInput, "input");
  const promedioId = controller.analysis.rows[0].resultId;

  // La fila 1 lo referencia en su operación.
  [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación")).click();
  const opCell = doc.querySelectorAll("#table-container tbody tr")[1].querySelectorAll("td")[4];
  addExprElement(opCell, "promedio");
  const secondRowId = controller.analysis.rows[1].id;

  doc.querySelectorAll("#table-container tbody tr")[0].querySelector('[title="Eliminar actividad"]').click();
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
  const opCell = doc.querySelectorAll("#table-container tbody tr td")[4];
  assert.ok(
    [...opCell.querySelectorAll("datalist option")].some((o) => o.value === "nota1"),
    "la operación ofrece el dato aunque la fila no lo consuma como entrada",
  );
});

test("building an operation references data and shows it in the chain", async () => {
  const { doc, controller } = await mountApp();

  // Declara "nota1" y lo referencia en la fila.
  const dataId = declareInput(doc, controller, "nota1", "numeric");
  referenceInput(doc, 0, dataId);

  // Construye la operación: referencia nota1, operador ÷ y valor 3.
  const opCell = () => doc.querySelectorAll("#table-container tbody tr td")[4];
  addExprElement(opCell(), "nota1");
  addExprOperator(opCell(), "div");
  addExprElement(opCell(), "3");

  const operation = controller.analysis.rows[0].operation;
  assert.deepEqual(operation.map((t) => t.kind), ["ref", "op", "literal"]);
  assert.equal(operation[0].dataId, dataId);
  assert.match(doc.getElementById("chain-container").textContent, /nota1 ÷ 3/);
});

test("operation tokens can be reordered by drag and drop", async () => {
  const { doc, controller } = await mountApp();
  const opCell = () => doc.querySelectorAll("#table-container tbody tr td")[4];
  addExprElement(opCell(), "A");
  addExprElement(opCell(), "B");

  const chips = opCell().querySelectorAll("span[draggable]");
  fire(chips[1], "dragstart");
  fire(chips[0], "drop");

  assert.deepEqual(controller.analysis.rows[0].operation.map((t) => t.value), ["B", "A"]);
});

test("parentheses are available as grouping operators", async () => {
  const { doc, controller } = await mountApp();
  const opCell = () => doc.querySelectorAll("#table-container tbody tr td")[4];
  assert.ok(opCell().querySelector('button[data-op="lparen"]'), "hay botón de paréntesis");
  addExprOperator(opCell(), "lparen");

  assert.deepEqual(controller.analysis.rows[0].operation, [{ kind: "op", op: "lparen" }]);
});

test("the result type is suggested from the operation when unset", async () => {
  const { doc, controller } = await mountApp();

  const resultName = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultName.value = "promedio";
  fire(resultName, "input");

  const opCell = () => doc.querySelectorAll("#table-container tbody tr td")[4];
  addExprElement(opCell(), "2");
  addExprOperator(opCell(), "add");
  addExprElement(opCell(), "3");

  const result = findData(controller.analysis, controller.analysis.rows[0].resultId);
  assert.equal(result.type, "numeric", "operación aritmética sugiere Numérico");
});

test("the result type is suggested when the result is named after the operation", async () => {
  const { doc, controller } = await mountApp();

  // Primero se construye la operación 2 + 3...
  const opCell = () => doc.querySelectorAll("#table-container tbody tr td")[4];
  addExprElement(opCell(), "2");
  addExprOperator(opCell(), "add");
  addExprElement(opCell(), "3");

  // ...y luego se nombra el resultado.
  const resultName = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultName.value = "suma";
  fire(resultName, "input");

  const result = findData(controller.analysis, controller.analysis.rows[0].resultId);
  assert.equal(result.type, "numeric");
  const typeSelect = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("select");
  assert.equal(typeSelect.value, "numeric", "el select refleja la sugerencia");
});

test("the condition is a free-text natural-language question", async () => {
  const { doc, controller } = await mountApp();

  // La condición es opcional: se activa con su interruptor antes de escribirla.
  const conditionCell = () => doc.querySelectorAll("#table-container tbody tr td")[3];
  const toggle = conditionCell().querySelector('input[type="checkbox"]');
  toggle.checked = true;
  fire(toggle, "change");

  const conditionField = conditionCell().querySelector("textarea");
  assert.ok(conditionField, "la condición es un campo de texto, no un constructor");

  conditionField.value = "¿El promedio es mayor o igual a 3?";
  fire(conditionField, "input");

  assert.equal(controller.analysis.rows[0].condition, "¿El promedio es mayor o igual a 3?");
});

test("the students section records a shared group and the participants", async () => {
  const { doc, controller } = await mountApp();

  // Agregar un estudiante entra en edición y muestra el grupo y los campos juntos.
  [...doc.querySelectorAll("#students-container button")].find((b) => b.textContent === "+ Agregar estudiante").click();
  assert.equal(controller.analysis.students.length, 1);

  // El grupo es un único campo compartido, editable junto con los estudiantes.
  const groupInput = doc.getElementById("analysis-group");
  assert.ok(groupInput, "hay un campo de grupo en edición");
  groupInput.value = "N1";
  fire(groupInput, "input");
  assert.equal(controller.analysis.group, "N1");

  const studentInputs = doc.querySelectorAll("#students-container input:not(#analysis-group)");
  studentInputs[0].value = "123";
  fire(studentInputs[0], "input");
  studentInputs[1].value = "Ana Pérez";
  fire(studentInputs[1], "input");

  const student = controller.analysis.students[0];
  assert.equal(student.idNumber, "123");
  assert.equal(student.fullName, "ANA PÉREZ", "el nombre se guarda en mayúsculas");
  assert.equal(student.group, undefined, "el estudiante no tiene grupo propio");
});

test("the branch builder appears only when the path is a response", async () => {
  const { doc } = await mountApp();
  const purpose = doc.querySelectorAll("#table-container tbody tr td")[6].querySelector("select");
  purpose.value = "decision";
  fire(purpose, "change");

  const branchCell = () => doc.querySelectorAll("#table-container tbody tr td")[9];
  const typeSelect = () => branchCell().querySelector("select");

  assert.equal(branchCell().querySelector("input[list]"), null, "sin tipo: sin constructor");

  typeSelect().value = "operation";
  fire(typeSelect(), "change");
  assert.equal(branchCell().querySelector("input[list]"), null, "operación: sin constructor");

  typeSelect().value = "response";
  fire(typeSelect(), "change");
  assert.ok(branchCell().querySelector("input[list]"), "respuesta: aparece el constructor de expresión");
});

test("a decision branch response can reference existing data", async () => {
  const { doc, controller } = await mountApp();

  // La fila 0 produce "promedio".
  const resultName = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultName.value = "promedio";
  fire(resultName, "input");
  const promedioId = controller.analysis.rows[0].resultId;

  // Fila 1: decisión con rama "Si se cumple" de tipo Respuesta que referencia el dato.
  [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación")).click();
  const row1 = () => doc.querySelectorAll("#table-container tbody tr")[1];
  row1().querySelectorAll("td")[6].querySelector("select").value = "decision";
  fire(row1().querySelectorAll("td")[6].querySelector("select"), "change");

  const branchCell = () => row1().querySelectorAll("td")[9];
  branchCell().querySelector("select").value = "response"; // el tipo de la rama
  fire(branchCell().querySelector("select"), "change");

  // Ahora aparece el constructor de la respuesta: se referencia el dato por nombre.
  addExprElement(branchCell(), "promedio");

  const tokens = controller.analysis.rows[1].ifTrue.value;
  assert.deepEqual(tokens.map((t) => t.kind), ["ref"]);
  assert.equal(tokens[0].dataId, promedioId);
});

test("a produced datum can stay pending and later link to a new activity", async () => {
  const { doc, controller } = await mountApp();

  // La fila 0 produce "buenas": aparece el selector de actividad asociada.
  const resultName = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultName.value = "buenas";
  fire(resultName, "input");

  const usedInSelect = () => doc.querySelectorAll("#table-container tbody tr td")[7].querySelector("select");
  assert.ok(usedInSelect(), "hay selector cuando la fila produce un dato");

  // Aún no existe la actividad destino: se deja pendiente de asignación.
  usedInSelect().value = "pending";
  fire(usedInSelect(), "change");
  assert.equal(controller.analysis.rows[0].usedInRowId, "pending");

  // Se crea la actividad destino y se vincula el dato con ella.
  [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación")).click();
  const targetId = controller.analysis.rows[1].id;
  assert.ok([...usedInSelect().options].some((o) => o.value === targetId), "la nueva actividad es opción");
  usedInSelect().value = targetId;
  fire(usedInSelect(), "change");
  assert.equal(controller.analysis.rows[0].usedInRowId, targetId);
});

test("deleting the target activity reverts the link to pending", async () => {
  const { doc, controller } = await mountApp();

  const resultName = doc.querySelectorAll("#table-container tbody tr td")[5].querySelector("input");
  resultName.value = "buenas";
  fire(resultName, "input");
  [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación")).click();
  const [sourceId, targetId] = controller.analysis.rows.map((r) => r.id);
  controller.setUsedIn(sourceId, targetId);

  // Se elimina la actividad destino: la relación no se pierde, queda pendiente.
  doc.querySelectorAll("#table-container tbody tr")[1].querySelector('[title="Eliminar actividad"]').click();
  [...doc.querySelectorAll("body > div button")].find((b) => b.textContent === "Eliminar").click();
  await flush();

  assert.equal(controller.analysis.rows.length, 1);
  assert.equal(controller.analysis.rows[0].usedInRowId, "pending", "la relación queda pendiente de asignación");
});

test("the chain panel reflects external inputs and final outputs live", async () => {
  const { doc, controller } = await mountApp();
  const chainText = () => doc.getElementById("chain-container").textContent;

  // "nota1" declarado como dato de entrada aparece en las ENTRADAS de la cadena.
  declareInput(doc, controller, "nota1", "numeric");

  const purposeSelect = doc.querySelectorAll("#table-container tbody tr td")[6].querySelector("select");
  purposeSelect.value = "response";
  fire(purposeSelect, "change");

  // El comentario es texto libre.
  const comment = doc.querySelectorAll("#table-container tbody tr td")[8].querySelector("textarea");
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

test("exporting to PDF includes only the selected sections plus the timestamp", async () => {
  const { doc, controller } = await mountApp();
  controller.analysis.title = "Mi análisis";
  controller.analysis.group = "N1";
  controller.addStudent();
  controller.analysis.students[0].fullName = "Ana Pérez";

  [...doc.querySelectorAll("#toolbar button")].find((b) => b.textContent === "Exportar PDF").click();

  // Desmarca todo excepto "Información de los estudiantes".
  const checks = [...doc.querySelectorAll('[role="dialog"] input[type="checkbox"]')];
  assert.ok(checks.every((c) => c.checked), "todas marcadas por defecto");
  checks.forEach((c) => {
    if (c.dataset.key !== "students") c.checked = false;
  });
  [...doc.querySelectorAll("body > div button")].find((b) => b.textContent === "Generar PDF").click();
  await flush();

  const printText = doc.getElementById("print-area").textContent;
  assert.match(printText, /Información de los estudiantes/);
  assert.match(printText, /Grupo: N1/);
  assert.match(printText, /Ana Pérez/);
  assert.match(printText, /Exportado:/, "muestra la fecha y hora automática");
  assert.doesNotMatch(printText, /Tabla de datos/, "no incluye lo no seleccionado");
});

test("toolbar exposes the file group and key actions", async () => {
  const { doc } = await mountApp();
  const labels = new Set([...doc.querySelectorAll("#toolbar button")].map((b) => b.textContent.trim()).filter(Boolean));
  // "Archivo" agrupa nuevo/abrir/guardar; "Menú" despliega todo en móvil.
  const expected = ["Archivo", "Nuevo análisis", "Abrir análisis", "Guardar archivo", "Exportar PDF", "Ejemplo guiado", "Ayuda", "Tema", "Menú"];
  for (const label of expected) {
    assert.ok(labels.has(label), `falta la acción «${label}»`);
  }
});

test("the guided example button loads the sample and opens the tutorial", async () => {
  const { doc, controller } = await mountApp();
  [...doc.querySelectorAll("#toolbar button")].find((b) => b.textContent === "Ejemplo guiado").click();

  assert.match(controller.analysis.title, /estudiante aprueba/i);
  assert.equal(controller.analysis.rows.length, 3);
  assert.ok(controller.analysis.data.length >= 5, "trae datos de entrada y producidos");
  assert.ok(doc.getElementById("guide-card"), "se abre el tutorial guiado");
  const decision = controller.analysis.rows[2];
  assert.equal(decision.purpose, "decision");
  assert.ok(decision.operation.some((t) => t.kind === "ref"), "la decisión referencia datos");
});

test("the completeness indicator lists pending items and clears when complete", async () => {
  const { doc } = await mountApp();
  const panel = () => doc.getElementById("completeness-container");
  // Análisis nuevo sin título: hay pendientes en vivo.
  assert.match(panel().textContent, /Por completar/);
  assert.match(panel().textContent, /título/);

  // El ejemplo guiado está completo: el indicador lo confirma.
  [...doc.querySelectorAll("#toolbar button")].find((b) => b.textContent === "Ejemplo guiado").click();
  assert.match(panel().textContent, /completo/);
});

test("undo and redo revert and reapply a change", async () => {
  const { doc, controller } = await mountApp();
  const title = () => doc.getElementById("analysis-title");

  title().value = "Mi título";
  fire(title(), "input");
  assert.equal(controller.analysis.title, "Mi título");

  controller.undo();
  assert.equal(controller.analysis.title, "", "deshacer revierte el cambio");

  controller.redo();
  assert.equal(controller.analysis.title, "Mi título", "rehacer lo reaplica");
});

test("adding then undoing an activity restores the previous count", async () => {
  const { doc, controller } = await mountApp();
  const addButton = [...doc.querySelectorAll("button")].find((b) => b.textContent.includes("Agregar operación"));

  addButton.click();
  assert.equal(controller.analysis.rows.length, 2);

  controller.undo();
  assert.equal(controller.analysis.rows.length, 1, "deshacer quita la actividad agregada");
});

test("the theme button toggles dark mode", async () => {
  const { doc } = await mountApp();
  const button = [...doc.querySelectorAll("#toolbar button")].find((b) => b.textContent === "Tema");
  assert.ok(button, "hay un botón de tema");

  const before = doc.documentElement.classList.contains("dark");
  button.click();
  assert.notEqual(doc.documentElement.classList.contains("dark"), before, "cambia el modo");
  button.click();
  assert.equal(doc.documentElement.classList.contains("dark"), before, "vuelve al estado inicial");
});

test("the save indicator lives in a stable slot outside the toolbar", async () => {
  const { doc, controller } = await mountApp();
  const slot = doc.getElementById("save-status");
  assert.ok(slot, "existe la ranura del indicador");
  assert.equal(doc.querySelector("#toolbar #save-status"), null, "no está dentro del toolbar");

  controller.analysisView.setSaveStatus("saving");
  assert.match(slot.textContent, /Guardando/);
  controller.analysisView.setSaveStatus("saved");
  assert.match(slot.textContent, /Guardado/);
});

test("the help button opens the documentation dialog", async () => {
  const { doc } = await mountApp();
  [...doc.querySelectorAll("#toolbar button")].find((b) => b.textContent === "Ayuda").click();

  const dialog = doc.querySelector('[role="dialog"]');
  assert.ok(dialog, "se abre un diálogo");
  assert.match(dialog.textContent, /Cómo usar Logix/);
  assert.match(dialog.textContent, /Cómo se construyen las operaciones/);
  // Guía pedagógica ampliada (convenciones, condiciones y expresiones).
  assert.match(dialog.textContent, /cantidadUnidadesProducidas/);
  assert.match(dialog.textContent, /Jerarquía de operadores/);
});

test("a section help button opens the panel on the relevant tab", async () => {
  const { doc } = await mountApp();
  const hint = [...doc.querySelectorAll("#inputs-container button")].find((b) => b.textContent === "?");
  assert.ok(hint, "la sección de datos de entrada tiene un ? de ayuda");

  hint.click();
  const dialog = doc.querySelector('[role="dialog"]');
  const active = [...dialog.querySelectorAll("button")].find((b) => b.className.includes("bg-indigo-600"));
  assert.equal(active.textContent, "Datos y operaciones", "abre la pestaña de datos y operaciones");
});

test("the help dialog groups content into tabs", async () => {
  const { doc } = await mountApp();
  [...doc.querySelectorAll("#toolbar button")].find((b) => b.textContent === "Ayuda").click();
  const dialog = doc.querySelector('[role="dialog"]');
  const tabLabels = ["Interfaz", "Datos y operaciones", "Condiciones y expresiones"];
  tabLabels.forEach((label) => {
    assert.ok([...dialog.querySelectorAll("button")].some((b) => b.textContent === label), `pestaña «${label}»`);
  });
});

test("creating a new analysis resets to a single empty row", async () => {
  const { doc, controller } = await mountApp();
  const previousId = controller.analysis.id;
  controller.addRow(); // el actual tiene 2 filas

  controller.newAnalysis();

  assert.notEqual(controller.analysis.id, previousId);
  assert.equal(controller.analysis.rows.length, 1);
  assert.equal(doc.querySelectorAll("#table-container tbody tr").length, 1);
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
  assert.equal(doc.querySelectorAll("#table-container tbody tr").length, 2);
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
