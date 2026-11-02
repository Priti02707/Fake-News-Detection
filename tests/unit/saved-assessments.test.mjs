import { test } from "node:test";
import assert from "node:assert/strict";
import { readSavedAssessments } from "../../frontend/saved-assessments.ts";

const analysis = { verdict: "uncertain", model: "logistic", model_name: "Logistic Regression", confidence: null, real_probability: null, word_count: 10, elapsed_ms: 1, reasons: ["Short article"], explanations: [], claims: [{ text: "A specific claim" }] };
const source = { status: "no_matches", message: "No matching sources", results: [] };
const verification = { status: "review_required", assessment: "INSUFFICIENT_EVIDENCE", confidence: null, claim: "The council approved the budget.", checked_at: "2026-11-02T12:00:00Z", reader_notes: "Review date", explanation: "Review exact passages", warnings: [], news: source, fact_checks: source, evidence: [] };
const saved = { id: "report-1", date: "2026-11-02T12:00:00Z", text: "The council approved the budget.", result: analysis };

test("legacy model history and verification-only reports remain usable", () => {
  const reports = readSavedAssessments([saved, { ...saved, id: "source-only", result: null, verification, review: "supports", options: { mode: "verify", claim: "A specific claim", sourceUrl: "", sourceText: "", notes: "Reader context", language: "all" } }]);
  assert.equal(reports.length, 2);
  assert.equal(reports[0].result.verdict, "uncertain");
  assert.equal(reports[1].result, null);
  assert.equal(reports[1].options.notes, "Reader context");
  assert.equal(reports[1].verification.assessment, "INSUFFICIENT_EVIDENCE");
  assert.equal(reports[1].review, "supports");
});

test("corrupt browser records cannot create empty or executable saved reports", () => {
  assert.deepEqual(readSavedAssessments(null), []);
  assert.deepEqual(readSavedAssessments([{ ...saved, result: { verdict: "real" } }, { ...saved, date: "bad date" }]), []);
  const reports = readSavedAssessments([{ ...saved, report: { uncertainty: null }, options: { mode: "verify", notes: {} }, verification: { ...verification, news: { ...source, search_url: "javascript:alert(1)" } } }]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].report, null);
  assert.equal(reports[0].verification, null);
  assert.equal(reports[0].options, undefined);
});
