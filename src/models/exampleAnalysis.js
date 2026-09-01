// Análisis de ejemplo, completo, para que el estudiante vea un caso terminado que
// pueda imitar y editar. Se construye con las mismas fábricas del modelo (ids
// frescos, referencias por id), así que es un análisis normal más.

import { createAnalysis, createRow, createDataEntry, createStudent, createBranch } from "./analysisModel.js";

const ref = (datum) => ({ kind: "ref", dataId: datum.id });
const op = (operator) => ({ kind: "op", op: operator });
const literal = (value) => ({ kind: "literal", value });

export function createExampleAnalysis() {
  const analysis = createAnalysis({
    title: "Autorizar una orden de producción",
    description:
      "Una fábrica debe decidir si autoriza una orden: comprueba que las unidades buenas cubran lo solicitado y que el costo no supere el presupuesto.",
    group: "N1",
  });
  analysis.students = [createStudent({ idNumber: "1001", fullName: "Ana Pérez" })];

  // Datos de entrada declarados.
  const producidas = createDataEntry({ name: "cantidadUnidadesProducidas", type: "numeric" });
  const defectuosas = createDataEntry({ name: "cantidadUnidadesDefectuosas", type: "numeric" });
  const solicitadas = createDataEntry({ name: "cantidadUnidadesSolicitadas", type: "numeric" });
  const costoUnidad = createDataEntry({ name: "costoProduccionPorUnidad", type: "numeric" });
  const presupuesto = createDataEntry({ name: "presupuestoMaximoOrden", type: "numeric" });

  // Datos producidos por las operaciones.
  const buenas = createDataEntry({ name: "cantidadUnidadesBuenas", type: "numeric" });
  const costoTotal = createDataEntry({ name: "costoTotalProduccion", type: "numeric" });
  const ordenAutorizada = createDataEntry({ name: "ordenAutorizada", type: "logical" });

  analysis.data = [producidas, defectuosas, solicitadas, costoUnidad, presupuesto, buenas, costoTotal, ordenAutorizada];

  const row1 = createRow({
    problem: "Calcular la cantidad de unidades buenas",
    inputIds: [producidas.id, defectuosas.id],
    operation: [ref(producidas), op("sub"), ref(defectuosas)],
    resultId: buenas.id,
    purpose: "operation",
    subsequentUse: "Se usará para comprobar si la orden puede autorizarse.",
  });

  const row2 = createRow({
    problem: "Calcular el costo total de producción",
    inputIds: [solicitadas.id, costoUnidad.id],
    operation: [ref(solicitadas), op("mul"), ref(costoUnidad)],
    resultId: costoTotal.id,
    purpose: "operation",
    subsequentUse: "Se comparará con el presupuesto máximo de la orden.",
  });

  const row3 = createRow({
    problem: "Comprobar si la orden puede autorizarse",
    inputIds: [buenas.id, solicitadas.id, costoTotal.id, presupuesto.id],
    condition: "¿Las unidades buenas cubren lo solicitado y el costo no supera el presupuesto?",
    operation: [ref(buenas), op("ge"), ref(solicitadas), op("and"), ref(costoTotal), op("le"), ref(presupuesto)],
    resultId: ordenAutorizada.id,
    purpose: "decision",
    subsequentUse: "Determina si la orden se autoriza o se rechaza.",
    ifTrue: createBranch({ type: "response", value: [literal("Orden autorizada")] }),
    ifFalse: createBranch({ type: "response", value: [literal("Orden rechazada")] }),
  });

  // Los resultados de las dos primeras actividades se usan en la decisión.
  row1.usedInRowId = row3.id;
  row2.usedInRowId = row3.id;

  analysis.rows = [row1, row2, row3];
  return analysis;
}
