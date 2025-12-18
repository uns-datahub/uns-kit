#!/usr/bin/env node
/**
 * Generate both UNS dictionary and measurements in one go.
 * This is a small wrapper over generate-uns-dictionary.ts and
 * generate-uns-measurements.ts to make project setup simpler.
 */
import path from "node:path";
import { generateUnsDictionary } from "./generate-uns-dictionary.js";
import { generateUnsMeasurements } from "./generate-uns-measurements.js";

type CliArgs = {
  dictionary: string;
  dictionaryOutput: string;
  measurements: string;
  measurementsOutput: string;
  lang: string;
};

const DEFAULT_DICT_INPUT = "uns-dictionary.json";
const DEFAULT_DICT_OUTPUT = path.resolve(process.cwd(), "src/uns/uns-dictionary.generated.ts");
const DEFAULT_MEAS_INPUT = "uns-measurements.json";
const DEFAULT_MEAS_OUTPUT = path.resolve(process.cwd(), "src/uns/uns-measurements.generated.ts");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  await generateUnsDictionary({
    input: args.dictionary,
    output: args.dictionaryOutput,
    lang: args.lang,
  });

  await generateUnsMeasurements({
    input: args.measurements,
    output: args.measurementsOutput,
    lang: args.lang,
  });

  console.log(
    `Generated reference -> dictionary: ${args.dictionaryOutput}, measurements: ${args.measurementsOutput}`,
  );
}

function parseArgs(argv: string[]): CliArgs {
  let dictionary = DEFAULT_DICT_INPUT;
  let dictionaryOutput = DEFAULT_DICT_OUTPUT;
  let measurements = DEFAULT_MEAS_INPUT;
  let measurementsOutput = DEFAULT_MEAS_OUTPUT;
  let lang = "sl";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dictionary" && argv[i + 1]) {
      dictionary = argv[++i];
      continue;
    }
    if (arg === "--dictionary-output" && argv[i + 1]) {
      dictionaryOutput = argv[++i];
      continue;
    }
    if (arg === "--measurements" && argv[i + 1]) {
      measurements = argv[++i];
      continue;
    }
    if (arg === "--measurements-output" && argv[i + 1]) {
      measurementsOutput = argv[++i];
      continue;
    }
    if (arg === "--lang" && argv[i + 1]) {
      lang = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dictionary, dictionaryOutput, measurements, measurementsOutput, lang };
}

function printHelp(): void {
  console.log(`Usage: tsx packages/uns-core/src/tools/generate-uns-reference.ts [options]

Options:
  --dictionary <file>           Path to uns-dictionary.json (default: ${DEFAULT_DICT_INPUT})
  --dictionary-output <file>    Path to generated dictionary TS (default: ${DEFAULT_DICT_OUTPUT})
  --measurements <file>         Path to uns-measurements.json (default: ${DEFAULT_MEAS_INPUT})
  --measurements-output <file>  Path to generated measurements TS (default: ${DEFAULT_MEAS_OUTPUT})
  --lang <code>                 Preferred description language (default: "sl")
  --help, -h                    Show this help
`);
}

main().catch((err) => {
  console.error("Failed to generate UNS reference:", err);
  process.exitCode = 1;
});
