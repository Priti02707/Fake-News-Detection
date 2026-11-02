import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewVisual, buildTimeline, frameSampleTimes } from '../../frontend/multimodal.ts';

const comparison = (claimScore, alternativeScore) => ({ model: 'synthetic-unit-fixture', revision: 'fixture', claim: 'a city flood', alternative: 'a dry street', matches: [{ label: 'a dry street', score: alternativeScore }, { label: 'a city flood', score: claimScore }], scope: 'test' });
const video = (segments = [], frames = []) => ({ filename: 'synthetic.webm', kind: 'video', language: 'en', original_text: '', segments, frames });
const frame = (text, timestamp = 2) => ({ id: 'frame-1', timestamp, width: 640, height: 360, text, scene_change: .2, ocr_status: 'text_found' });

test('relative visual mismatch follows the named claim regardless of result order', () => {
  assert.equal(reviewVisual(comparison(.1, .9)).status, 'potential_mismatch');
  assert.match(reviewVisual(comparison(.1, .9)).explanation, /does not establish/);
  assert.equal(reviewVisual(comparison(.9, .1)).status, 'no_relative_mismatch');
  assert.match(reviewVisual(comparison(.9, .1)).explanation, /remain unverified/);
});

test('ambiguous, missing, legacy and malformed comparisons are inconclusive', () => {
  assert.equal(reviewVisual(comparison(.5, .5)).status, 'inconclusive');
  assert.equal(reviewVisual().status, 'inconclusive');
  assert.equal(reviewVisual({ ...comparison(.1, .9), claim: undefined }).status, 'inconclusive');
  for (const invalid of [NaN, Infinity, -1, 2]) assert.equal(reviewVisual(comparison(invalid, .9)).status, 'inconclusive');
  assert.equal(reviewVisual({ ...comparison(.1, .9), alternative: 'a city flood' }).status, 'inconclusive');
});

test('visual review margin handles its declared boundary', () => {
  assert.equal(reviewVisual(comparison(.4, .6)).status, 'potential_mismatch');
  assert.equal(reviewVisual(comparison(.4001, .5999)).status, 'inconclusive');
});

test('timeline is chronological and preserves speech/frame provenance', () => {
  const result = buildTimeline(video([{ text: 'Later spoken words', start: 8, end: 10 }, { text: 'Earlier spoken words', start: 0, end: 2 }], [frame('Visible written words', 4)]));
  assert.deepEqual(result.map(item => [item.timestamp, item.channel]), [[0, 'speech'], [4, 'frame'], [8, 'speech']]);
  assert.equal(result[1].frameId, 'frame-1');
  assert.ok(result.every(item => !('truth_probability' in item) && !('verdict' in item)));
});

test('negation differences are review flags only when wording is aligned in time', () => {
  const speech = { text: 'The city council approved the transport budget.', start: 1, end: 4 };
  const result = buildTimeline(video([speech], [frame('The city council did not approve the transport budget.')]));
  assert.ok(result.find(item => item.channel === 'frame').reasons.some(reason => reason.includes('negation')));
  const distant = buildTimeline(video([{ ...speech, start: 20, end: 22 }], [frame('The city council did not approve the transport budget.')]));
  assert.ok(distant.every(item => item.reasons.every(reason => !reason.includes('negation'))));
});

test('different nearby topics are disclosed as potentially ordinary narration', () => {
  const result = buildTimeline(video([{ text: 'Botanical gardens grow tropical flowers.', start: 1, end: 4 }], [frame('City council transport budget approved')]));
  assert.match(result.find(item => item.channel === 'frame').reasons.join(' '), /ordinary narration/);
});

test('invalid/untimed speech is omitted and failed OCR remains visible', () => {
  const result = buildTimeline(video([{ text: 'No known timestamp' }, { text: 'Invalid time', start: NaN }, { text: 'Late time', start: 61 }], [{ ...frame(''), ocr_status: 'failed' }]));
  assert.equal(result.length, 1);
  assert.match(result[0].reasons.join(' '), /could not be read/);
  assert.deepEqual(buildTimeline({ ...video(), kind: 'image' }), []);
});

test('timeline caps metadata, bounds excerpts and drops reversed end times', () => {
  const result = buildTimeline(video(Array.from({ length: 200 }, (_, i) => ({ text: 'x'.repeat(500), start: i / 10, end: 0 }))));
  assert.equal(result.length, 150);
  assert.ok(result.every(item => item.text.length <= 300));
  assert.equal(result[1].end, undefined);
});

test('bounded frame sampling spans a full 60-second clip', () => {
  const times = frameSampleTimes(60, 2, 6);
  assert.equal(times.length, 6);
  assert.equal(times[0], .05);
  assert.ok(times.at(-1) > 59.9 && times.at(-1) < 60);
  assert.ok(times.every((value, i) => i === 0 || value > times[i - 1]));
});

test('short clips sample within duration and invalid sampling is rejected', () => {
  assert.deepEqual(frameSampleTimes(.01, 5, 6), [.005]);
  for (const args of [[Infinity, 2, 6], [61, 2, 6], [10, 0, 6], [10, 2, 500], [10, 2, 1.5]]) assert.throws(() => frameSampleTimes(...args));
});
