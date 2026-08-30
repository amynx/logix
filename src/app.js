// Punto de entrada: obtiene los contenedores del DOM, construye las vistas y el
// controlador, y arranca la aplicación.

import { AnalysisView } from "./views/analysisView.js";
import { AnalysisController } from "./controllers/analysisController.js";

function main() {
  const analysisView = new AnalysisView({
    infoContainer: document.getElementById("analysis-info"),
  });

  const controller = new AnalysisController({ analysisView });
  controller.start();
}

main();
