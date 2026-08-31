// Pruebas de la derivación de una operación (tokens) a texto legible.

import { test } from "node:test";
import assert from "node:assert/strict";

import { operationToText } from "../src/models/operators.js";

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

test("an empty operation is empty text", () => {
  assert.equal(operationToText([], resolve), "");
});
