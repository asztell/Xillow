/**
 * seed-photos.mjs
 * ---------------
 * Regenerates the curated `photos` arrays in `sample_listings.json`.
 *
 * The sample photos are free, hotlinkable images from Unsplash's CDN,
 * matched to each property's size via its bedroom count:
 *
 *   studio (0-1 beds)  -> apartment buildings / small flats
 *   2 beds             -> small homes & townhomes
 *   3 beds             -> classic family homes
 *   4 beds             -> larger family homes
 *   5+ beds            -> large / luxury homes
 *   (no bed count)     -> a generic mix
 *
 * Each listing keeps its first photo as the exterior, except ~30% of photo
 * listings which lead with a **bedroom** interior instead; the remaining
 * photos are interiors. ~20% of listings (chosen deterministically from a hash
 * of their composite key) intentionally stay photo-less so the UI's branded
 * placeholder remains visible in the demo.
 *
 * Every choice is a pure function of `(source, id)`, so re-running this script
 * (or `npm run seed:photos`) always reproduces the same file. Run it whenever
 * listings are added or removed.
 *
 * All URLs were verified live (HTTP 200) when this file was written.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "..", "sample_listings.json");

/** Unsplash imgix URL: exact 2:1 crop at a size that suits the card strip. */
const U = (id) =>
  `https://images.unsplash.com/photo-${id}?w=960&h=480&fit=crop&auto=format&q=70`;

/** Dwelling-scale facades, keyed by bedroom bucket. */
const EXTERIORS = {
  studio: [
    "1567496898669-ee935f5f647a", // apartment block at dusk
    "1460317442991-0ec209397118", // modern apartment building
    "1545324418-cc1a3fa10c00", // brick apartments with balconies
    "1554435493-93422e8220c8", // small apartment complex
  ].map(U),
  two: [
    "1580587771525-78b9dba3b914", // white brick duplex
    "1600047509807-ba8f99d2cdde", // modest suburban home
    "1523217582562-09d0def993a6", // compact modern house
    "1564013799919-ab600027ffc6", // brick family home
  ].map(U),
  three: [
    "1568605114967-8130f3a36994", // classic family house
    "1570129477492-45c003edd2be", // grey family home
    "1600585154340-be6161a56a0c", // white family home
    "1523217582562-09d0def993a6", // compact modern house
  ].map(U),
  four: [
    "1568605114967-8130f3a36994", // classic family house
    "1570129477492-45c003edd2be", // grey family home
    "1600585154340-be6161a56a0c", // white family home
    "1600047509807-ba8f99d2cdde", // larger suburban home
  ].map(U),
  five: [
    "1512917774080-9991f1c4c750", // grand house at dusk
    "1600596542815-ffad4c1539a9", // luxury home with pool
    "1416331108676-a22ccb276e35", // large contemporary villa
    "1613490493576-7fde63acd811", // modern luxury house
  ].map(U),
  generic: [
    "1568605114967-8130f3a36994",
    "1570129477492-45c003edd2be",
    "1600585154340-be6161a56a0c",
    "1564013799919-ab600027ffc6",
  ].map(U),
};

/** Shared interiors (living rooms + kitchens) for the non-lead photos. */
const INTERIORS = [
  "1522708323590-d24dbb6b0267", // bright apartment living room
  "1502672260266-1c1ef2d93688", // cozy renovated interior
  "1493809842364-78817add7ffb", // modern living room
  "1560448204-e02f11c3d0e2", // small bright apartment
  "1554995207-c18c203602cb", // sofa living room
  "1515263487990-61b07816b324", // white kitchen
  "1556909212-d5b604d0c90d", // open-plan kitchen
].map(U);

/** Bedroom interiors - used as the lead shot for ~30% of photo listings. */
const BEDROOMS = [
  "1616594039964-ae9021a400a0", // modern compact bedroom
  "1616486338812-3dadae4b4ace", // airy bedroom
  "1598928506311-c55ded91a20c", // cozy bedroom
  "1616486029423-aaa4789e8c9a", // bright neutral bedroom
  "1560185007-cde436f6a4d0", // warm lit bedroom
  "1631049307264-da0ec9d70304", // minimalist bedroom
  "1590490360182-c33d57733427", // soft-toned bedroom
].map(U);

function hash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick(pool, n) {
  return pool[n % pool.length];
}

function bucketFor(bedrooms) {
  if (bedrooms == null) return "generic";
  if (bedrooms <= 1) return "studio";
  if (bedrooms === 2) return "two";
  if (bedrooms === 3) return "three";
  if (bedrooms === 4) return "four";
  return "five";
}

// ---------------------------------------------------------------------------
// Driver: decide photos deterministically, then write the file.
const entries = JSON.parse(readFileSync(FILE, "utf8"));

// Deterministically decide which listings get photos, how many, and which of
// those lead with a bedroom (exactly ~30%, by lowest hash rank).
const planned = entries.map((entry) => {
  const seed = hash(`${entry.source}:${entry.id}`);
  const count = seed % 5 === 0 ? 0 : 3 + ((seed >>> 8) % 2); // 3 or 4
  return { entry, seed, count, rng: seed >>> 16 };
});
const withPhotos = planned
  .filter((p) => p.count > 0)
  .sort((a, b) => a.rng - b.rng || a.seed - b.seed);
const bedroomLeads = Math.round(withPhotos.length * 0.3);
withPhotos.forEach((p, i) => {
  p.bedroomLead = i < bedroomLeads;
});

const out = planned.map(({ entry, seed, count, bedroomLead }) => {
  if (count === 0) return { ...entry, photos: [] };
  const leadPool = bedroomLead
    ? BEDROOMS
    : EXTERIORS[bucketFor(entry.bedrooms)];
  const photos = [pick(leadPool, seed)];
  for (let i = 1; i < count; i += 1) {
    // Step 3 (coprime with the 7-item interior pool) so photos within a
    // listing never repeat.
    photos.push(pick(INTERIORS, seed + i * 3));
  }
  return { ...entry, photos };
});
writeFileSync(FILE, `${JSON.stringify(out, null, 2)}\n`);

const summary = {
  total: out.length,
  withPhotos: 0,
  withoutPhotos: 0,
  count3: 0,
  count4: 0,
  bedroomLead: 0,
  exteriorLead: 0,
};
const BEDROOM_URLS = new Set(BEDROOMS);
for (const entry of out) {
  const n = entry.photos.length;
  if (n === 0) summary.withoutPhotos += 1;
  else {
    summary.withPhotos += 1;
    summary[n === 3 ? "count3" : "count4"] += 1;
    if (BEDROOM_URLS.has(entry.photos[0])) summary.bedroomLead += 1;
    else summary.exteriorLead += 1;
  }
}
console.log(`wrote ${summary.total} listings`);
console.log(
  `photos: ${summary.withPhotos} listings (${summary.count3}×3, ${summary.count4}×4), ${summary.withoutPhotos} without`,
);
console.log(
  `leads: ${summary.exteriorLead} exterior, ${summary.bedroomLead} bedroom (${Math.round((summary.bedroomLead / summary.withPhotos) * 100)}% of photo listings)`,
);
