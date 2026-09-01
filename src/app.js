// Punto de entrada: obtiene los contenedores del DOM, construye las vistas, la
// persistencia y el controlador, y arranca la aplicación.

import { AnalysisView } from "./views/analysisView.js";
import { GroupView } from "./views/groupView.js";
import { InputsView } from "./views/inputsView.js";
import { TableView } from "./views/tableView.js";
import { CardsView } from "./views/cardsView.js";
import { ChainView } from "./views/chainView.js";
import { PdfView } from "./views/pdfView.js";
import { StorageService } from "./services/storage/storageService.js";
import { AnalysisController } from "./controllers/analysisController.js";

function main() {
  const analysisView = new AnalysisView({
    toolbarContainer: document.getElementById("toolbar"),
    infoContainer: document.getElementById("analysis-info"),
  });

  const groupView = new GroupView({
    container: document.getElementById("group-container"),
  });

  const inputsView = new InputsView({
    container: document.getElementById("inputs-container"),
  });

  const tableView = new TableView({
    container: document.getElementById("table-container"),
  });

  const cardsView = new CardsView({
    container: document.getElementById("table-container"),
  });

  const chainView = new ChainView({
    container: document.getElementById("chain-container"),
  });

  const pdfView = new PdfView({
    container: document.getElementById("print-area"),
  });

  const controller = new AnalysisController({
    analysisView,
    groupView,
    inputsView,
    tableView,
    cardsView,
    chainView,
    pdfView,
    storage: new StorageService(),
  });

  controller.start();
}

main();
