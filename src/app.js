// Punto de entrada: obtiene los contenedores del DOM, construye las vistas, la
// persistencia y el controlador, y arranca la aplicación.

import { AnalysisView } from "./views/analysisView.js";
import { StudentsView } from "./views/studentsView.js";
import { InputsView } from "./views/inputsView.js";
import { TableView } from "./views/tableView.js";
import { ChainView } from "./views/chainView.js";
import { StorageService } from "./services/storage/storageService.js";
import { AnalysisController } from "./controllers/analysisController.js";

function main() {
  const analysisView = new AnalysisView({
    toolbarContainer: document.getElementById("toolbar"),
    infoContainer: document.getElementById("analysis-info"),
  });

  const studentsView = new StudentsView({
    container: document.getElementById("students-container"),
  });

  const inputsView = new InputsView({
    container: document.getElementById("inputs-container"),
  });

  const tableView = new TableView({
    container: document.getElementById("table-container"),
  });

  const chainView = new ChainView({
    container: document.getElementById("chain-container"),
  });

  const controller = new AnalysisController({
    analysisView,
    studentsView,
    inputsView,
    tableView,
    chainView,
    storage: new StorageService(),
  });

  controller.start();
}

main();
