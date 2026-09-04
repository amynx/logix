// Pruebas de la normalización de texto de presentación (capitalización y forma
// de pregunta).

import { test } from "node:test";
import assert from "node:assert/strict";

import { capitalizeFirst, formatAsQuestion } from "../src/models/textNormalization.js";

test("capitalizeFirst capitaliza la primera letra sin alterar el resto", () => {
  assert.equal(
    capitalizeFirst("calcular el promedio de las notas"),
    "Calcular el promedio de las notas",
  );
});

test("capitalizeFirst respeta un texto ya capitalizado", () => {
  assert.equal(capitalizeFirst("Calcular el promedio"), "Calcular el promedio");
});

test("capitalizeFirst salta espacios y signos iniciales", () => {
  assert.equal(capitalizeFirst("  «ácido»"), "  «Ácido»");
});

test("capitalizeFirst deja intacto un texto sin letras", () => {
  assert.equal(capitalizeFirst("123 + 45"), "123 + 45");
  assert.equal(capitalizeFirst(""), "");
});

test("formatAsQuestion agrega ambos signos y capitaliza", () => {
  assert.equal(formatAsQuestion("el estudiante aprueba"), "¿El estudiante aprueba?");
});

test("formatAsQuestion no duplica signos ya presentes", () => {
  assert.equal(formatAsQuestion("¿el estudiante aprueba"), "¿El estudiante aprueba?");
  assert.equal(formatAsQuestion("el estudiante aprueba?"), "¿El estudiante aprueba?");
  assert.equal(formatAsQuestion("¿el estudiante aprueba?"), "¿El estudiante aprueba?");
});

test("formatAsQuestion conserva vacío un campo vacío", () => {
  assert.equal(formatAsQuestion(""), "");
  assert.equal(formatAsQuestion("   "), "");
  assert.equal(formatAsQuestion("¿?"), "");
});
