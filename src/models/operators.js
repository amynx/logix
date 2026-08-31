// Operadores disponibles para construir operaciones, agrupados por tipo, y la
// derivación de una operación (lista de tokens) a texto legible.
//
// Una operación es una lista ordenada de tokens:
//   { kind: "ref", dataId }              → referencia a un dato del catálogo
//   { kind: "op", op }                   → operador (clave de OPERATOR_SYMBOLS)
//   { kind: "literal", value }           → valor fijo escrito por el estudiante
//
// Referenciar datos (en vez de reescribir su nombre) evita inconsistencias y
// permite reutilizar entradas y resultados a lo largo del análisis.

export const OPERATOR_GROUPS = {
  arithmetic: { label: "Aritméticos", operators: { add: "+", sub: "−", mul: "×", div: "÷" } },
  relational: { label: "Relacionales", operators: { eq: "=", ne: "≠", lt: "<", gt: ">", le: "≤", ge: "≥" } },
  logical: { label: "Lógicos", operators: { and: "Y", or: "O", not: "NO" } },
};

export const OPERATOR_SYMBOLS = Object.values(OPERATOR_GROUPS).reduce(
  (symbols, group) => Object.assign(symbols, group.operators),
  {},
);

// Texto legible de una operación. `resolve` mapea un id de dato a su entrada.
export function operationToText(tokens, resolve) {
  return (tokens ?? []).map((token) => tokenToText(token, resolve)).join(" ");
}

function tokenToText(token, resolve) {
  if (token.kind === "ref") {
    const datum = resolve(token.dataId);
    return datum ? datum.name || "(sin nombre)" : "?";
  }
  if (token.kind === "op") return OPERATOR_SYMBOLS[token.op] ?? "?";
  if (token.kind === "literal") return token.value ?? "";
  return "";
}
