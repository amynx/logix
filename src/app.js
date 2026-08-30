// Punto de entrada: obtiene los contenedores del DOM, construye las vistas y el
// controlador, y arranca la aplicación.

import { AnalysisView } from "./views/analysisView.js";
import { TableView } from "./views/tableView.js";
import { AnalysisController } from "./controllers/analysisController.js";

function main() {
  const analysisView = new AnalysisView({
    infoContainer: document.getElementById("analysis-info"),
  });

  const tableView = new TableView({
    container: document.getElementById("table-container"),
  });

  const controller = new AnalysisController({ analysisView, tableView });
  controller.start();
}

main();
