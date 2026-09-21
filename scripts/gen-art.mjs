#!/usr/bin/env node
/**
 * Generate game art with Gemini instead of Canva.
 *
 * The rest of the art pipeline (rembg cutouts, sprite-sheet slicing, baked
 * dimensions in src/game/art.ts) only cares about PNGs on disk, so this is a
 * drop-in replacement for the "generate" step.
 *
 *   export GEMINI_API_KEY=...            # from aistudio.google.com
 *   node scripts/gen-art.mjs out.png "a single isometric bakery sprite, ..."
 *
 * Optional: GEMINI_IMAGE_MODEL to pin a different image model.
 */
import { writeFileSync } from 'node:fs';

const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!key) {
  console.error('No GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment.');
  process.exit(1);
}

const [outPath, ...promptParts] = process.argv.slice(2);
const prompt = promptParts.join(' ');
if (!outPath || !prompt) {
  console.error('usage: node scripts/gen-art.mjs <out.png> <prompt…>');
  process.exit(1);
}

const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}\n${(await res.text()).slice(0, 900)}`);
  process.exit(1);
}

const json = await res.json();
const parts = json?.candidates?.[0]?.content?.parts ?? [];
const image = parts.find((p) => p.inlineData?.data);
if (!image) {
  // surface whatever came back so a model-name or safety issue is obvious
  console.error('No image in response:\n' + JSON.stringify(json).slice(0, 900));
  process.exit(1);
}

writeFileSync(outPath, Buffer.from(image.inlineData.data, 'base64'));
console.log(`wrote ${outPath}`);
