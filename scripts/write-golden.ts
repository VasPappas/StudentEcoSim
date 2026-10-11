/**
 * Regenerate engine/testdata/market-golden.json.
 *
 * Run this only when a rule change is intended: `npm run golden`. The file is
 * the record of what the engine is supposed to produce, so a diff in it is a
 * change in the model and belongs in the model card too.
 */
import { writeFileSync } from "node:fs";
import { createRandom } from "../engine/core/random";
import { runSchedule, summarise } from "../engine/market/replay";
import {
  referenceDays,
  referenceRandomCount,
  referenceRandomSeed,
  referenceSeed,
  referenceSettings,
  referenceTimetable,
} from "../engine/testdata/reference-timetable";

const random = createRandom(referenceRandomSeed);
const firstValues = Array.from({ length: referenceRandomCount }, () => random.nextUint32());

const days = runSchedule(referenceSettings, referenceSeed, referenceTimetable, referenceDays);

const golden = {
  about:
    "Reference run for the stage 1 market. Whole numbers and decimals must match exactly; " +
    "decimals are IEEE 754 doubles written with the shortest text that reads back to the same value.",
  random: { seed: referenceRandomSeed, firstUint32: firstValues },
  market: {
    seed: referenceSeed,
    settings: referenceSettings,
    timetable: referenceTimetable,
    firstDayValues: Array.from(days[0].values),
    firstDayCosts: Array.from(days[0].costs),
    days: days.map(summarise),
  },
};

const path = new URL("../engine/testdata/market-golden.json", import.meta.url);
writeFileSync(path, JSON.stringify(golden, null, 1) + "\n");
console.log(`Wrote ${days.length} days to ${path.pathname}`);
