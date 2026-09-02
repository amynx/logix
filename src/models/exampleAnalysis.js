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

// Ejemplo del tutorial guiado: decidir si un estudiante aprueba una asignatura.
// Encadena suma → promedio → decisión, ideal para explicar la tabla fila por fila.
export function createStudentGradeExample() {
  const analysis = createAnalysis({
    title: "¿El estudiante aprueba la asignatura?",
    description: "A partir de tres notas, calcular el promedio y decidir si el estudiante aprueba según la nota aprobatoria.",
    group: "N1",
  });
  analysis.students = [createStudent({ idNumber: "1001", fullName: "Ana Pérez" })];

  const nota1 = createDataEntry({ name: "nota1", type: "numeric" });
  const nota2 = createDataEntry({ name: "nota2", type: "numeric" });
  const nota3 = createDataEntry({ name: "nota3", type: "numeric" });
  const notaAprobatoria = createDataEntry({ name: "notaAprobatoria", type: "numeric" });
  const sumaNotas = createDataEntry({ name: "sumaNotas", type: "numeric" });
  const promedio = createDataEntry({ name: "promedio", type: "numeric" });
  const aprobado = createDataEntry({ name: "aprobado", type: "logical" });

  analysis.data = [nota1, nota2, nota3, notaAprobatoria, sumaNotas, promedio, aprobado];

  const row1 = createRow({
    problem: "Sumar las tres notas",
    inputIds: [nota1.id, nota2.id, nota3.id],
    operation: [ref(nota1), op("add"), ref(nota2), op("add"), ref(nota3)],
    resultId: sumaNotas.id,
    purpose: "operation",
    subsequentUse: "Se usará para calcular el promedio.",
  });

  const row2 = createRow({
    problem: "Calcular el promedio",
    inputIds: [sumaNotas.id],
    operation: [ref(sumaNotas), op("div"), literal("3")],
    resultId: promedio.id,
    purpose: "operation",
    subsequentUse: "Se comparará con la nota aprobatoria.",
  });

  const row3 = createRow({
    problem: "Decidir si el estudiante aprueba",
    inputIds: [promedio.id, notaAprobatoria.id],
    condition: "¿El promedio es mayor o igual a la nota aprobatoria?",
    operation: [ref(promedio), op("ge"), ref(notaAprobatoria)],
    resultId: aprobado.id,
    purpose: "decision",
    subsequentUse: "Determina si el estudiante aprueba o reprueba.",
    ifTrue: createBranch({ type: "response", value: [literal("Aprueba")] }),
    ifFalse: createBranch({ type: "response", value: [literal("Reprueba")] }),
  });

  row1.usedInRowId = row2.id;
  row2.usedInRowId = row3.id;

  analysis.rows = [row1, row2, row3];
  return analysis;
}
