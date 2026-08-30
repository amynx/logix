// Pruebas de la abstracción de persistencia usando fake-indexeddb, que provee
// un IndexedDB en memoria fuera del navegador.

import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";

import { StorageService } from "../src/services/storage/storageService.js";
import { createAnalysis } from "../src/models/analysisModel.js";

test("saves, reads, lists and deletes an analysis", async () => {
  const storage = new StorageService();
  const analysis = createAnalysis({ title: "Calcular promedio" });

  await storage.saveAnalysis(analysis);
  assert.equal((await storage.getAnalysis(analysis.id)).title, "Calcular promedio");

  const all = await storage.getAllAnalyses();
  assert.ok(all.some((item) => item.id === analysis.id), "listed among all analyses");

  await storage.deleteAnalysis(analysis.id);
  assert.equal(await storage.getAnalysis(analysis.id), undefined, "removed after delete");
});

test("saving the same id twice updates instead of duplicating", async () => {
  const storage = new StorageService();
  const analysis = createAnalysis({ title: "Original" });

  await storage.saveAnalysis(analysis);
  await storage.saveAnalysis({ ...analysis, title: "Actualizado" });

  assert.equal((await storage.getAnalysis(analysis.id)).title, "Actualizado");
});
