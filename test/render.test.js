// Prueba de humo del pipeline de render: monta la aplicación sobre jsdom y
// verifica que la vista refleja el estado y que la edición actualiza el modelo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { AnalysisView } from "../src/views/analysisView.js";
import { TableView } from "../src/views/tableView.js";
import { AnalysisController } from "../src/controllers/analysisController.js";

function mountApp() {
  const dom = new JSDOM(
    `<!DOCTYPE html><body><div id="analysis-info"></div><div id="table-container"></div></body>`,
  );
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  const controller = new AnalysisController({
    analysisView: new AnalysisView({ infoContainer: dom.window.document.getElementById("analysis-info") }),
    tableView: new TableView({ container: dom.window.document.getElementById("table-container") }),
  });
  controller.start();
  return { dom, controller, doc: dom.window.document };
}

function fire(node, type) {
  node.dispatchEvent(new globalThis.window.Event(type));
}

test("renders analysis info and a seeded row with all columns", () => {
  const { doc } = mountApp();

  assert.ok(doc.getElementById("analysis-title"), "title input exists");
  assert.ok(doc.getElementById("analysis-description"), "description textarea exists");

  assert.equal(doc.querySelectorAll("thead th").length, 11, "11 header cells (# + 9 columns + actions)");
  assert.equal(doc.querySelectorAll("tbody tr").length, 1, "one seeded row");
  assert.equal(doc.querySelectorAll("tbody tr td").length, 11, "row has 11 cells");
});

test("adding a row appends a new editable row", () => {
  const { doc, controller } = mountApp();
  const addButton = [...doc.querySelectorAll("button")].find((b) => b.textContent === "+ Agregar fila");

  addButton.click();

  assert.equal(controller.analysis.rows.length, 2);
  assert.equal(doc.querySelectorAll("tbody tr").length, 2);
});

test("deleting a row removes it after confirmation", async () => {
  const { doc, controller } = mountApp();
  controller.addRow(); // dos filas
  const firstRowId = controller.analysis.rows[0].id;

  doc.querySelector("tbody tr td:last-child button").click(); // abre el diálogo
  const confirmButton = [...doc.querySelectorAll("body > div button")].find((b) => b.textContent === "Eliminar");
  confirmButton.click();
  await new Promise((resolve) => setTimeout(resolve)); // esperar la resolución de la promesa

  assert.equal(controller.analysis.rows.length, 1);
  assert.notEqual(controller.analysis.rows[0].id, firstRowId, "se eliminó la primera fila");
});

test("editing the title updates the model without re-rendering", () => {
  const { doc, controller } = mountApp();
  const titleInput = doc.getElementById("analysis-title");

  titleInput.value = "Calcular promedio";
  fire(titleInput, "input");

  assert.equal(controller.analysis.title, "Calcular promedio");
});

test("changing purpose updates the model and re-renders the table", () => {
  const { doc, controller } = mountApp();
  const purposeSelect = doc.querySelectorAll("tbody tr td")[6].querySelector("select");

  purposeSelect.value = "decision";
  fire(purposeSelect, "change");

  assert.equal(controller.analysis.rows[0].purpose, "decision");
  assert.equal(doc.querySelectorAll("tbody tr").length, 1, "still one row after re-render");
});

test("adding an input datum grows the row's inputs and re-renders", () => {
  const { doc, controller } = mountApp();
  const inputsCell = doc.querySelectorAll("tbody tr td")[2];
  const addButton = [...inputsCell.querySelectorAll("button")].find((b) => b.textContent === "+ dato");

  addButton.click();

  assert.equal(controller.analysis.rows[0].inputs.length, 1);
  assert.equal(doc.querySelectorAll("tbody tr td")[2].querySelectorAll("input").length, 1);
});
