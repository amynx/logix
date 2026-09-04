// Pruebas de la derivación de una operación (tokens) a texto legible.

import { test } from "node:test";
import assert from "node:assert/strict";

import { operationToText, expressionParts, inferResultType } from "../src/models/operators.js";

const resolve = (id) => ({ n1: { name: "nota1" }, n2: { name: "nota2" } }[id] ?? null);

test("renders references, operators and literals as readable text", () => {
  const tokens = [
    { kind: "ref", dataId: "n1" },
    { kind: "op", op: "add" },
    { kind: "ref", dataId: "n2" },
    { kind: "op", op: "div" },
    { kind: "literal", value: "3" },
  ];
  assert.equal(operationToText(tokens, resolve), "nota1 + nota2 ÷ 3");
});

test("a reference to a removed datum renders as ?", () => {
  assert.equal(operationToText([{ kind: "ref", dataId: "missing" }], () => null), "?");
});

test("composes condition references via the condition resolver", () => {
  const tokens = [{ kind: "cond", condId: "x" }, { kind: "op", op: "and" }, { kind: "cond", condId: "y" }];
  const resolveCondition = (id) => ({ x: { label: "C1" }, y: { label: "C2" } })[id] ?? null;
  assert.equal(operationToText(tokens, () => null, resolveCondition), "C1 Y C2");
});

test("an empty operation is empty text", () => {
  assert.equal(operationToText([], resolve), "");
});

test("expressionParts marks data references distinctly from operators and text", () => {
  const parts = expressionParts(
    [{ kind: "ref", dataId: "n1" }, { kind: "op", op: "add" }, { kind: "literal", value: "3" }],
    resolve,
  );
  assert.deepEqual(parts.map((p) => p.kind), ["ref", "op", "literal"]);
  assert.equal(parts[0].text, "nota1");
});

test("inferResultType suggests a type from the operators used", () => {
  const ref = { kind: "ref", dataId: "n1" };
  assert.equal(inferResultType([ref, { kind: "op", op: "add" }, ref]), "numeric");
  assert.equal(inferResultType([ref, { kind: "op", op: "ge" }, { kind: "literal", value: "3" }]), "logical");
  assert.equal(inferResultType([ref]), null, "sin operadores no hay sugerencia");
});
