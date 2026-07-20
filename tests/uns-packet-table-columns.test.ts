import { describe, expect, it } from "vitest";
import type { IUnsMessage } from "../packages/uns-core/src/uns/uns-interfaces.js";
import {
  tableColumnEntries,
  UnsPacket,
} from "../packages/uns-core/src/uns/uns-packet.js";

const time = "2026-07-19T12:00:00.000Z";

const legacyPacket = {
  version: "1.3.0",
  message: {
    table: {
      time,
      dataGroup: "metering",
      columns: [
        { name: "power", type: "double", value: 42.1, uom: "kW" },
        { name: "running", type: "boolean", value: true },
      ],
    },
  },
};

describe("UnsPacket MQTT table column contract", () => {
  it("normalizes legacy array columns into the canonical named object", () => {
    const packet = UnsPacket.parseMqttPacket(JSON.stringify(legacyPacket));

    expect(packet?.message.table?.columns).toEqual({
      power: { type: "double", value: 42.1, uom: "kW" },
      running: { type: "boolean", value: true },
    });
  });

  it("parses and preserves canonical object columns", () => {
    const packet = UnsPacket.parseMqttPacket(JSON.stringify({
      version: "2.0.0",
      message: {
        table: {
          time,
          columns: {
            status: { type: "symbol", value: "RUNNING" },
            temperature: { type: "double", value: null, uom: "°C" },
          },
        },
      },
    }));

    expect(packet?.message.table?.columns).toEqual({
      status: { type: "symbol", value: "RUNNING" },
      temperature: { type: "double", value: null, uom: "°C" },
    });
  });

  it("constructs only object-form table packets with the new wire version", async () => {
    const message = {
      table: {
        time,
        columns: {
          power: { type: "double", value: 42.1, uom: "kW" },
        },
      },
    } as unknown as IUnsMessage;

    const packet = await UnsPacket.unsPacketFromUnsMessage(message);

    expect(packet.version).toBe("2.0.0");
    expect(packet.message.table?.columns).toEqual({
      power: { type: "double", value: 42.1, uom: "kW" },
    });
    expect(Array.isArray(packet.message.table?.columns)).toBe(false);
  });

  it("exposes typed canonical object entries without legacy normalization", () => {
    expect(
      tableColumnEntries({
        power: { type: "double", value: 42.1, uom: "kW" },
        running: { type: "boolean", value: true },
      }),
    ).toEqual([
      ["power", { type: "double", value: 42.1, uom: "kW" }],
      ["running", { type: "boolean", value: true }],
    ]);
  });

  it("rejects legacy array columns on the structured outbound path", async () => {
    const message = legacyPacket.message as unknown as IUnsMessage;

    await expect(UnsPacket.unsPacketFromUnsMessage(message)).rejects.toThrow(
      "Table.columns must be a non-empty object",
    );
  });

  it.each([
    ["missing type", { power: { value: 42.1 } }, "missing a QuestDB type"],
    ["missing value", { power: { type: "double" } }, "is missing a value"],
    ["invalid value", { power: { type: "double", value: [] } }, "must be number, string, boolean, or null"],
    ["unsafe key", { "power.total": { type: "double", value: 42.1 } }, "must match"],
    ["reserved key", { constructor: { type: "string", value: "x" } }, "is reserved"],
    ["conflicting name", { power: { name: "voltage", type: "double", value: 42.1 } }, "must not contain a name"],
    ["invalid UoM", { power: { type: "double", value: 42.1, uom: 12 } }, "uom must be a string"],
  ])("rejects %s on the structured outbound path", async (_label, columns, expectedMessage) => {
    const message = { table: { time, columns } } as unknown as IUnsMessage;

    await expect(UnsPacket.unsPacketFromUnsMessage(message)).rejects.toThrow(expectedMessage);
  });

  it("rejects duplicate legacy column names on inbound packets", () => {
    const packet = UnsPacket.parseMqttPacket(JSON.stringify({
      version: "1.3.0",
      message: {
        table: {
          time,
          columns: [
            { name: "power", type: "double", value: 42.1 },
            { name: "power", type: "double", value: 43.2 },
          ],
        },
      },
    }));

    expect(packet).toBeNull();
  });

  it("rejects unsupported packet versions", () => {
    const packet = UnsPacket.parseMqttPacket(JSON.stringify({
      ...legacyPacket,
      version: "9.0.0",
    }));

    expect(packet).toBeNull();
  });

  it("keeps scalar data parsing compatible while using packet version 2", async () => {
    const message = {
      data: { time, value: 42.1, uom: "kW" },
    } as unknown as IUnsMessage;

    const emitted = await UnsPacket.unsPacketFromUnsMessage(message);
    const parsed = UnsPacket.parseMqttPacket(JSON.stringify(emitted));

    expect(emitted.version).toBe("2.0.0");
    expect(parsed?.message.data).toMatchObject({
      time,
      value: 42.1,
      valueType: "number",
      uom: "kW",
    });
  });
});
