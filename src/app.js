// Punto de entrada: obtiene los contenedores del DOM, construye las vistas, la
// persistencia y el controlador, y arranca la aplicación.

import { AnalysisView } from "./views/analysisView.js";
import { TableView } from "./views/tableView.js";
import { StorageService } from "./services/storage/storageService.js";
import { AnalysisController } from "./controllers/analysisController.js";

function main() {
  const analysisView = new AnalysisView({
    toolbarContainer: document.getElementById("toolbar"),
    infoContainer: document.getElementById("analysis-info"),
  });

  const tableView = new TableView({
    container: document.getElementById("table-container"),
  });

  const controller = new AnalysisController({
    analysisView,
    tableView,
    storage: new StorageService(),
  });

  controller.start();
}

main();
