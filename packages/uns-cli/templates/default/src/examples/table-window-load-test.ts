/**
 * Moving-window table load test.
 *
 * Publishes time buckets as UNS table messages with:
 * - `time` (bucket identity; uses `intervalStart`)
 * - `intervalStart` / `intervalEnd` (bucket boundaries)
 * - `windowStart` / `windowEnd` (snapshot window boundaries)
 *
 * This is meant to validate `uns-archiver` ingest modes:
 * - `dedup`: upsert by (eventId + time + symbols). Missing buckets can be marked via `deleted: true`.
 * - `window_replace`: delete rows in the window, then insert the snapshot (omitting missing buckets).
 *
 * Run:
 *   pnpm exec tsx src/examples/table-window-load-test.ts
 *
 * Optional args:
 *   --run=all|1|2|3
 *   --mode=window_replace|dedup|append
 *   --bucketMinutes=30
 *   --windowHours=2
 *   --stepHours=1
 *   --anchorEnd=2026-02-04T12:00:00.000Z
 *   --dataGroup=production_window
 *   --delayMs=0
 *   --pause=true
 */

import { randomUUID } from "node:crypto";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ConfigFile, logger } from "@uns-kit/core";
import UnsMqttProxy from "@uns-kit/core/uns-mqtt/uns-mqtt-proxy.js";
import { registerAttributeDescriptions, registerObjectTypeDescriptions } from "@uns-kit/core/uns/uns-dictionary-registry.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";
import type { ISO8601, IUnsMessage, IUnsTableColumn } from "@uns-kit/core/uns/uns-interfaces.js";
import {
  GeneratedAttributes,
  GeneratedAttributeDescriptions,
  GeneratedObjectTypes,
  GeneratedObjectTypeDescriptions,
} from "../uns/uns-dictionary.generated.js";
import { resolveGeneratedAsset } from "../uns/uns-assets.js";
import { GeneratedPhysicalMeasurements } from "../uns/uns-measurements.generated.js";

type RunSelection = "all" | "1" | "2" | "3";
type IngestMode = "append" | "dedup" | "window_replace";

type CliArgs = {
  run: RunSelection;
  mode: IngestMode;
  bucketMinutes: number;
  windowHours: number;
  stepHours: number;
  anchorEnd: Date;
  dataGroup: string;
  delayMs: number;
  pause: boolean;
};

const DEFAULTS: Omit<CliArgs, "anchorEnd"> & { anchorEnd?: Date } = {
  run: "all",
  mode: "window_replace",
  bucketMinutes: 30,
  windowHours: 2,
  stepHours: 1,
  dataGroup: "production_window",
  delayMs: 0,
  pause: true,
};

function parseArgs(argv: string[]): Partial<CliArgs> {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const raw = token.slice(2);
    const eqIdx = raw.indexOf("=");
    if (eqIdx !== -1) {
      map.set(raw.slice(0, eqIdx), raw.slice(eqIdx + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      map.set(raw, next);
      i++;
    } else {
      map.set(raw, "true");
    }
  }

  const run = map.get("run") ?? map.get("iteration");
  const mode = map.get("mode");
  const bucketMinutes = map.get("bucketMinutes") ?? map.get("bucket-minutes");
  const windowHours = map.get("windowHours") ?? map.get("window-hours");
  const stepHours = map.get("stepHours") ?? map.get("step-hours");
  const anchorEnd = map.get("anchorEnd") ?? map.get("anchor-end");
  const dataGroup = map.get("dataGroup") ?? map.get("data-group");
  const delayMs = map.get("delayMs") ?? map.get("delay-ms");
  const pause = map.get("pause");

  const parsed: Partial<CliArgs> = {};
  if (run && (run === "all" || run === "1" || run === "2" || run === "3")) parsed.run = run;
  if (mode && (mode === "append" || mode === "dedup" || mode === "window_replace")) parsed.mode = mode;
  if (bucketMinutes) parsed.bucketMinutes = Number(bucketMinutes);
  if (windowHours) parsed.windowHours = Number(windowHours);
  if (stepHours) parsed.stepHours = Number(stepHours);
  if (dataGroup) parsed.dataGroup = dataGroup;
  if (delayMs) parsed.delayMs = Number(delayMs);
  if (pause !== undefined) {
    const normalized = pause.trim().toLowerCase();
    parsed.pause = !(normalized === "false" || normalized === "0" || normalized === "n" || normalized === "no");
  }
  if (anchorEnd) {
    const d = new Date(anchorEnd);
    if (!Number.isNaN(d.getTime())) parsed.anchorEnd = d;
  }
  return parsed;
}

function floorToHourUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildIterations(anchorEnd: Date, windowHours: number, stepHours: number): Array<{ idx: 1 | 2 | 3; startMs: number; endMs: number }> {
  const stepMs = stepHours * 60 * 60 * 1000;
  const windowMs = windowHours * 60 * 60 * 1000;
  const end3 = anchorEnd.getTime();
  const end2 = end3 - stepMs;
  const end1 = end3 - 2 * stepMs;
  return [
    { idx: 1, startMs: end1 - windowMs, endMs: end1 },
    { idx: 2, startMs: end2 - windowMs, endMs: end2 },
    { idx: 3, startMs: end3 - windowMs, endMs: end3 },
  ];
}

function buildColumns(producedKg: number, scrapKg: number): IUnsTableColumn[] {
  return [
    { name: "producedKg", type: "double", value: producedKg, uom: GeneratedPhysicalMeasurements.Kilogram },
    { name: "scrapKg", type: "double", value: scrapKg, uom: GeneratedPhysicalMeasurements.Kilogram },
  ];
}

function simulateProducedKg(bucketIndex: number, iteration: number): number {
  const wave = Math.sin(bucketIndex / 10) * 3 + Math.sin(bucketIndex / 3) * 0.5;
  const value = 100 + (bucketIndex % 50) * 0.2 + wave + iteration * 0.25;
  return Number(value.toFixed(3));
}

function simulateScrapKg(producedKg: number, bucketIndex: number, iteration: number): number {
  const ratio = 0.02 + (Math.sin(bucketIndex / 17) + 1) * 0.003;
  const value = producedKg * ratio + iteration * 0.01;
  return Number(value.toFixed(3));
}

function isMissingBucket(iteration: 1 | 2 | 3, bucketStartMs: number, windowStartMs: number, windowEndMs: number, bucketMs: number): boolean {
  const oneHourMs = 60 * 60 * 1000;
  const bucketIndex = Math.floor(bucketStartMs / bucketMs);
  const inLastHour = bucketStartMs >= windowEndMs - oneHourMs;
  const inFirstHour = bucketStartMs < windowStartMs + oneHourMs;
  const missingEveryIter1 = 3;
  const missingEveryIter2 = 4;

  if (iteration === 1) return inLastHour && bucketIndex % missingEveryIter1 === 0;
  if (iteration === 2) return inLastHour && bucketIndex % missingEveryIter2 === 0;
  return inFirstHour && bucketIndex % missingEveryIter2 === 0;
}

async function main() {
  const args = { ...DEFAULTS, ...parseArgs(process.argv.slice(2)) } as Omit<CliArgs, "anchorEnd"> & Partial<Pick<CliArgs, "anchorEnd">>;
  const anchorEnd = args.anchorEnd ?? floorToHourUtc(new Date());
  const cli: CliArgs = { ...args, anchorEnd };

  if (!Number.isFinite(cli.bucketMinutes) || cli.bucketMinutes <= 0) {
    throw new Error(`Invalid --bucketMinutes=${String(cli.bucketMinutes)}`);
  }
  if (!Number.isFinite(cli.windowHours) || cli.windowHours <= 0) {
    throw new Error(`Invalid --windowHours=${String(cli.windowHours)}`);
  }
  if (!Number.isFinite(cli.stepHours) || cli.stepHours <= 0) {
    throw new Error(`Invalid --stepHours=${String(cli.stepHours)}`);
  }
  if (!Number.isFinite(cli.delayMs) || cli.delayMs < 0) {
    throw new Error(`Invalid --delayMs=${String(cli.delayMs)}`);
  }

  const config = await ConfigFile.loadConfig();
  registerObjectTypeDescriptions(GeneratedObjectTypeDescriptions);
  registerAttributeDescriptions(GeneratedAttributeDescriptions);

  const topic: UnsTopics = "enterprise/site/area/line/";
  const asset = resolveGeneratedAsset("asset");
  const assetDescription = "Load test asset";
  const objectType = GeneratedObjectTypes["process-segment"];
  const objectId = "main";
  const attribute = GeneratedAttributes["output-quantity"];

  const outputHost = config.output?.host!;
  const shouldPause = cli.pause && !!process.stdin.isTTY;

  const rl = readline.createInterface({ input, output });
  let mqttOutput: UnsMqttProxy | undefined;
  try {
    const proceed =
      !process.stdin.isTTY
        ? "y"
        : await rl.question(`Run moving-window table load test on output broker ${outputHost}? (Y/n) `);
    if (proceed.trim() && proceed.trim().toLowerCase() !== "y") {
      logger.info("Aborted.");
      return;
    }

    const processName = config.uns.processName!;
    const instanceName = "tableWindowLoadTest";
    const clientIdBase = config.output?.clientId ?? `${processName}-${instanceName}`;
    const clientId = `${clientIdBase}-${randomUUID()}`;
    mqttOutput = new UnsMqttProxy(
      outputHost,
      processName,
      instanceName,
      { publishThrottlingDelay: 0, clientId, defaultPublishOptions: { qos: 1 } },
      true,
    );
    mqttOutput.event.on("unsProxyProducedTopics", (event) => {
      void mqttOutput?.publishMessage(event.statusTopic, JSON.stringify(event.producedTopics), {
        retain: true,
        properties: { messageExpiryInterval: 120000 },
      }).catch(() => undefined);
    });
    mqttOutput.event.on("mqttProxyStatus", async (event) => {
      try {
        const time = UnsPacket.formatToISO8601(new Date());
        const unsMessage: IUnsMessage = { data: { time, value: event.value, uom: event.uom } };
        const packet = await UnsPacket.unsPacketFromUnsMessage(unsMessage);
        await mqttOutput?.publishMessage(event.statusTopic, JSON.stringify(packet));
      } catch {
        // ignore status publish errors in load tests
      }
    });
    // Give the output proxy a moment to connect before publishing.
    // (Same approach as `load-test-data.ts`.)
    await sleep(1000);

    const bucketMs = cli.bucketMinutes * 60 * 1000;
    const iterations = buildIterations(cli.anchorEnd, cli.windowHours, cli.stepHours);

    const selected = cli.run === "all" ? new Set([1, 2, 3]) : new Set([Number(cli.run)]);
    const selectedIterations = iterations.filter((it) => selected.has(it.idx));
    const firstIteration = selectedIterations[0]?.idx ?? 1;
    logger.info(
      `Publishing iterations=${Array.from(selected).join(",")} mode=${cli.mode} bucket=${cli.bucketMinutes}min window=${cli.windowHours}h step=${cli.stepHours}h anchorEnd=${cli.anchorEnd.toISOString()} dataGroup=${cli.dataGroup} pause=${shouldPause}`,
    );

    for (const it of iterations) {
      if (!selected.has(it.idx)) continue;

      const windowStartIso = UnsPacket.formatToISO8601(new Date(it.startMs)) as ISO8601;
      const windowEndIso = UnsPacket.formatToISO8601(new Date(it.endMs)) as ISO8601;

      if (shouldPause && it.idx !== firstIteration) {
        await rl.question(
          `[pause] Inspect QuestDB now (after previous iteration). Press Enter to run iteration ${it.idx} with window [${windowStartIso}, ${windowEndIso})...`,
        );
      }

      const attrs: Array<{
        attribute: typeof attribute;
        table: {
          dataGroup: string;
          time: ISO8601;
          intervalStart: ISO8601;
          intervalEnd: ISO8601;
          windowStart: ISO8601;
          windowEnd: ISO8601;
          deleted?: boolean;
          columns: IUnsTableColumn[];
        };
      }> = [];

      let published = 0;
      let skipped = 0;
      let tombstones = 0;

      for (let startMs = it.startMs; startMs < it.endMs; startMs += bucketMs) {
        const endMs = startMs + bucketMs;
        const bucketStartIso = UnsPacket.formatToISO8601(new Date(startMs)) as ISO8601;
        const bucketEndIso = UnsPacket.formatToISO8601(new Date(endMs)) as ISO8601;

        const missing = isMissingBucket(it.idx, startMs, it.startMs, it.endMs, bucketMs);
        if (missing) {
          if (it.idx === 3 && cli.mode === "dedup") {
            const bucketIndex = Math.floor(startMs / bucketMs);
            const producedKg = simulateProducedKg(bucketIndex, it.idx);
            const scrapKg = simulateScrapKg(producedKg, bucketIndex, it.idx);
            attrs.push({
              attribute,
              table: {
                dataGroup: cli.dataGroup,
                time: bucketStartIso,
                intervalStart: bucketStartIso,
                intervalEnd: bucketEndIso,
                windowStart: windowStartIso,
                windowEnd: windowEndIso,
                deleted: true,
                columns: buildColumns(producedKg, scrapKg),
              },
            });
            tombstones++;
            published++;
          } else {
            skipped++;
          }
          continue;
        }

        const bucketIndex = Math.floor(startMs / bucketMs);
        const producedKg = simulateProducedKg(bucketIndex, it.idx);
        const scrapKg = simulateScrapKg(producedKg, bucketIndex, it.idx);
        attrs.push({
          attribute,
          table: {
            dataGroup: cli.dataGroup,
            time: bucketStartIso,
            intervalStart: bucketStartIso,
            intervalEnd: bucketEndIso,
            windowStart: windowStartIso,
            windowEnd: windowEndIso,
            columns: buildColumns(producedKg, scrapKg),
          },
        });
        published++;
      }

      logger.info(
        `Iteration ${it.idx}: window=[${windowStartIso}, ${windowEndIso}) publish=${published} skipped=${skipped} tombstones=${tombstones}`,
      );

      await mqttOutput.publishMqttMessage(
        {
          topic,
          asset,
          assetDescription,
          objectType,
          objectId,
          attributes: attrs,
        },
      );

      if (cli.delayMs > 0) {
        await sleep(cli.delayMs);
      }
    }

    // Give the worker queue a moment to publish before exiting.
    await sleep(500);
  } finally {
    rl.close();
    await mqttOutput?.stop();
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error : new Error(String(error));
  logger.error(`Table window load test failed: ${reason.message}`);
  process.exitCode = 1;
});
