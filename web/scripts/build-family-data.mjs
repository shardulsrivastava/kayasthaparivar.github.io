// Build step: reads the hand-maintained web/data/family.yaml (nested,
// human-friendly schema) and flattens it into the exact same shape as the
// original web/data/family.json, writing web/data/family.generated.json.
//
// This runs as a plain Node script (never bundled into the Next.js client),
// so lib/family.ts can keep doing a simple static `import ... from
// "@/data/family.generated.json"` without ever touching the filesystem or
// YAML at runtime.
//
// Id generation: sequential "p1", "p2", ... in document order (roots first,
// depth-first, spouse immediately after their partner, then children).
// These ids are internal only — nothing in family.yaml references them — so
// it's fine that they don't match any previous scheme.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load } from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const yamlPath = path.join(dataDir, "family.yaml");
const outPath = path.join(dataDir, "family.generated.json");

const doc = load(readFileSync(yamlPath, "utf8"));

if (!doc || !Array.isArray(doc.roots)) {
  throw new Error(
    `family.yaml must have a top-level "roots" list; got: ${JSON.stringify(doc)}`,
  );
}

// --- Devanagari -> Roman transliteration -----------------------------------
//
// Hand-rolled phonetic approximation (not IAST/ITRANS-grade) used only to
// give search a Roman-alphabet string to fuzzy-match against. No npm
// dependency for this on purpose — it's a small, fixed character set.
//
// Key rule: a Devanagari consonant carries an implicit "a" vowel sound
// UNLESS it's followed by a dependent vowel sign (matra, which replaces the
// "a") or a virama/halant (्, which suppresses the vowel entirely, used to
// build consonant clusters like ख्त in बख्तावर).
//
// Long/short vowel pairs (अ/आ, इ/ई, उ/ऊ) are collapsed to the same Roman
// letter (a, i, u) to match how people casually type Hindi names in
// English (e.g. "mevalal", not "meevaalaal") — good enough for fuzzy
// search, not meant to be a precise scholarly transliteration.

// Independent vowels (used when a vowel appears on its own, not attached to
// a consonant - typically word-initial).
const INDEPENDENT_VOWELS = {
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
};

// Dependent vowel signs (matras) that attach to a consonant, replacing its
// implicit "a".
const MATRAS = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

// Consonants, given as their sound WITHOUT the implicit "a" - the caller
// adds "a" back unless a matra/virama says otherwise.
const CONSONANTS = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "ळ": "l",
};

// A nukta (़) after a base consonant marks a Perso-Arabic loan sound
// (mostly present in Urdu-influenced names). Keyed by the base consonant.
const NUKTA_CONSONANTS = {
  "क": "q", "ख": "kh", "ग": "gh", "ज": "z",
  "ड": "r", "ढ": "rh", "फ": "f", "य": "y",
};

const VIRAMA = "्";
const NUKTA = "़";
const ANUSVARA = "ं"; // nasalization, e.g. कं
const CHANDRABINDU = "ँ"; // nasalization, e.g. हँ
const VISARGA = "ः"; // trailing aspiration, e.g. दुःख

// Appends whichever trailing nasal/aspiration mark (if any) sits at
// chars[i], returning the new index.
function consumeTrailingMark(chars, i, append) {
  if (chars[i] === ANUSVARA || chars[i] === CHANDRABINDU) {
    append("n");
    return i + 1;
  }
  if (chars[i] === VISARGA) {
    append("h");
    return i + 1;
  }
  return i;
}

function transliterate(text) {
  const chars = [...text]; // iterate by code point, not UTF-16 unit
  let out = "";
  const append = (s) => {
    out += s;
  };
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    if (CONSONANTS[ch] !== undefined) {
      let sound = CONSONANTS[ch];
      i += 1;
      if (chars[i] === NUKTA && NUKTA_CONSONANTS[ch] !== undefined) {
        sound = NUKTA_CONSONANTS[ch];
        i += 1;
      }
      out += sound;

      if (chars[i] === VIRAMA) {
        // Vowel suppressed - this consonant joins a cluster with the next.
        i += 1;
      } else if (chars[i] !== undefined && MATRAS[chars[i]] !== undefined) {
        out += MATRAS[chars[i]];
        i += 1;
      } else {
        out += "a"; // implicit vowel
      }

      i = consumeTrailingMark(chars, i, append);
      continue;
    }

    if (INDEPENDENT_VOWELS[ch] !== undefined) {
      out += INDEPENDENT_VOWELS[ch];
      i += 1;
      i = consumeTrailingMark(chars, i, append);
      continue;
    }

    if (ch === ANUSVARA || ch === CHANDRABINDU) {
      out += "n";
      i += 1;
      continue;
    }
    if (ch === VISARGA) {
      out += "h";
      i += 1;
      continue;
    }
    if (ch === NUKTA || ch === VIRAMA) {
      // Stray mark with nothing to attach to - drop it.
      i += 1;
      continue;
    }

    // Anything else (spaces, digits, Latin letters, punctuation) passes
    // through unchanged so word boundaries and annotations like "(दामाद)"
    // stay intact.
    out += ch;
    i += 1;
  }

  return out.toLowerCase();
}

let nextId = 1;
function allocateId() {
  return `p${nextId++}`;
}

const people = [];

function photoFor(gender) {
  return gender === "female"
    ? "/photos/placeholder-female.svg"
    : "/photos/placeholder-male.svg";
}

function makePerson(node, parentIds) {
  if (!node.name) {
    throw new Error(`Person node missing required "name": ${JSON.stringify(node)}`);
  }
  if (node.gender !== "male" && node.gender !== "female") {
    throw new Error(
      `Person "${node.name}" has invalid/missing gender (must be "male" or "female"): got ${JSON.stringify(node.gender)}`,
    );
  }

  const id = allocateId();
  const person = {
    id,
    name: node.name,
    nameRoman: transliterate(node.name),
    gender: node.gender,
    birthYear: null,
    deathYear: null,
    location: "",
    occupation: "",
    bio: node.bio ?? "",
    photo: photoFor(node.gender),
    parents: [...parentIds],
    spouses: [],
  };
  people.push(person);
  return person;
}

// Processes one node of the tree: the node itself, its optional spouse, and
// their shared children. `parentIds` are the ids this node's own parents
// (already-created) — empty for roots.
function processNode(node, parentIds) {
  const person = makePerson(node, parentIds);

  let childParentIds = [person.id];

  if (node.spouse) {
    const spouse = makePerson(node.spouse, []);
    person.spouses.push(spouse.id);
    spouse.spouses.push(person.id);
    childParentIds = [person.id, spouse.id];
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      processNode(child, childParentIds);
    }
  }

  return person;
}

for (const root of doc.roots) {
  processNode(root, []);
}

const output = {
  _note:
    doc.note ??
    "Generated from web/data/family.yaml — do not edit this file directly.",
  people,
};

writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

console.log(
  `Generated ${people.length} people from family.yaml -> ${path.relative(process.cwd(), outPath)}`,
);
