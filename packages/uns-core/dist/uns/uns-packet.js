import * as crypto from "crypto";
import * as zlib from "zlib";
import logger from '../logger.js';
import { isIOS8601Type, isQuestDbType, valueTypes } from "./uns-interfaces.js";
// Version of the packet library
const unsPacketVersion = "1.3.0";
export class UnsPacket {
    /**
     * The given TypeScript function parseMqttPacket is used to parse an MQTT packet,
     * which is presumed to be in JSON format. The goal is to transform this string into
     * a structured object that adheres to the IUnsPacket interface, or return null
     * if parsing fails.
     *
     * @param mqttPacket
     * @param instanceName
     * @returns IUnsPacket
     */
    static parseMqttPacket(mqttPacket, instanceName) {
        try {
            const parsedMqttPacket = JSON.parse(mqttPacket);
            // Check uns packet
            if (parsedMqttPacket && parsedMqttPacket.version) {
                const version = parsedMqttPacket.version;
                const data = parsedMqttPacket.message.data;
                const table = parsedMqttPacket.message.table;
                const expiresAt = parsedMqttPacket.message.expiresAt;
                const createdAt = parsedMqttPacket.message.createdAt;
                // Validate data and table objects
                UnsPacket.validateMessageComponents(data, table);
                const message = {
                    ...(data !== undefined && { data }),
                    ...(table !== undefined && { table }),
                    ...(expiresAt !== undefined && { expiresAt }),
                    ...(createdAt !== undefined && { createdAt }),
                };
                const messageSignature = parsedMqttPacket.messageSignature;
                const interval = parsedMqttPacket.interval;
                const unsPacket = {
                    message,
                    messageSignature,
                    version,
                    interval
                };
                return unsPacket;
            }
            else {
                logger.debug("Version number not specified in the mqtt packet");
            }
        }
        catch (error) {
            if (instanceName) {
                logger.error(`${instanceName} - Could not parse packet: ${error}`);
            }
            else {
                logger.error(`Could not parse packet: ${error}`);
            }
        }
    }
    /**
     * Validates the data and table objects to ensure they have the required properties
     * and that those properties have the correct types.
     *
     * @param data - The data object to validate
     * @param table - The table object to validate
     * @returns boolean | null
     */
    static validateMessageComponents(data, table) {
        const isIsoOrEpoch = (value) => {
            if (value === null || value === undefined)
                return true;
            if (typeof value === "number")
                return Number.isFinite(value);
            return isIOS8601Type(value);
        };
        if (data) {
            if (data.dataGroup) {
                if (!/^[A-Za-z0-9_]+$/.test(data.dataGroup)) {
                    throw new Error(`dataGroup must be a valid name (alphanumeric and underscores only, no spaces or special characters)`);
                }
            }
            if (!data.time)
                throw new Error(`Time is not defined in data object`);
            if (!isIOS8601Type(data.time))
                throw new Error(`Time is not ISO8601`);
            if (data.value === undefined) {
                throw new Error(`Value is not defined in data object`);
            }
            if (!valueTypes.includes(typeof data.value)) {
                throw new Error(`Value in data object must be string or number`);
            }
            if (data.intervalStart !== undefined && !isIsoOrEpoch(data.intervalStart)) {
                throw new Error(`intervalStart is not ISO8601 or epoch ms`);
            }
            if (data.intervalEnd !== undefined && !isIsoOrEpoch(data.intervalEnd)) {
                throw new Error(`intervalEnd is not ISO8601 or epoch ms`);
            }
            if (data.windowStart !== undefined && !isIsoOrEpoch(data.windowStart)) {
                throw new Error(`windowStart is not ISO8601 or epoch ms`);
            }
            if (data.windowEnd !== undefined && !isIsoOrEpoch(data.windowEnd)) {
                throw new Error(`windowEnd is not ISO8601 or epoch ms`);
            }
            if (data.lastSeen !== undefined && !isIsoOrEpoch(data.lastSeen)) {
                throw new Error(`lastSeen is not ISO8601 or epoch ms`);
            }
            if (data.deletedAt !== undefined && !isIsoOrEpoch(data.deletedAt)) {
                throw new Error(`deletedAt is not ISO8601 or epoch ms`);
            }
            if (data.eventId && typeof data.eventId !== "string") {
                throw new Error(`eventId must be a string`);
            }
            if (data.deleted !== undefined && typeof data.deleted !== "boolean") {
                throw new Error(`deleted must be a boolean`);
            }
        }
        // Check table object
        if (table) {
            if (table.dataGroup) {
                if (!/^[A-Za-z0-9_]+$/.test(table.dataGroup)) {
                    throw new Error(`dataGroup must be a valid name (alphanumeric and underscores only, no spaces or special characters)`);
                }
            }
            if (!table.time) {
                throw new Error(`Time is not defined in data object`);
            }
            if (!isIOS8601Type(table.time)) {
                throw new Error(`Time is not ISO8601`);
            }
            if (table.intervalStart !== undefined && !isIsoOrEpoch(table.intervalStart)) {
                throw new Error(`intervalStart is not ISO8601 or epoch ms`);
            }
            if (table.intervalEnd !== undefined && !isIsoOrEpoch(table.intervalEnd)) {
                throw new Error(`intervalEnd is not ISO8601 or epoch ms`);
            }
            if (table.windowStart !== undefined && !isIsoOrEpoch(table.windowStart)) {
                throw new Error(`windowStart is not ISO8601 or epoch ms`);
            }
            if (table.windowEnd !== undefined && !isIsoOrEpoch(table.windowEnd)) {
                throw new Error(`windowEnd is not ISO8601 or epoch ms`);
            }
            if (table.lastSeen !== undefined && !isIsoOrEpoch(table.lastSeen)) {
                throw new Error(`lastSeen is not ISO8601 or epoch ms`);
            }
            if (table.deletedAt !== undefined && !isIsoOrEpoch(table.deletedAt)) {
                throw new Error(`deletedAt is not ISO8601 or epoch ms`);
            }
            if (table.eventId && typeof table.eventId !== "string") {
                throw new Error(`eventId must be a string`);
            }
            if (table.deleted !== undefined && typeof table.deleted !== "boolean") {
                throw new Error(`deleted must be a boolean`);
            }
            if (!Array.isArray(table.columns) || table.columns.length === 0) {
                throw new Error(`Table.columns must be a non-empty array`);
            }
            table.columns.forEach((column, index) => {
                if (!column.name) {
                    throw new Error(`Column at index ${index} is missing a name`);
                }
                if (!column.type) {
                    throw new Error(`Column '${column.name}' is missing a QuestDB type`);
                }
                if (!isQuestDbType(column.type)) {
                    throw new Error(`Column '${column.name}' has invalid QuestDB type '${column.type}'`);
                }
                const value = column.value;
                if (typeof value !== "number" &&
                    typeof value !== "string" &&
                    typeof value !== "boolean" &&
                    value !== null) {
                    throw new Error(`Value for column '${column.name}' must be number, string, boolean, or null`);
                }
            });
        }
        return true;
    }
    static async unsPacketFromUnsMessage(message, unsPackatParameters) {
        try {
            // Validate the packet in message
            if (UnsPacket.validateMessageComponents(message.data, message.table)) {
                // HMAC
                // const algorithm = "sha256";
                // const key = "your-secret-key";
                // const packetMessage = JSON.stringify(message);
                // const hmacHash = this.generateHmac(algorithm, key, packetMessage);
                // const unsPacket: IUnsPacket = {
                //   message,
                //   messageSignature: hmacHash,
                //   version: unsPacketVersion
                // };
                let data = undefined;
                if (message.data && message.data.value !== undefined) {
                    const valueType = typeof message.data.value;
                    if (!valueTypes.includes(valueType)) {
                        throw new Error(`Value in data object must be string or number`);
                    }
                    data = {
                        ...message.data,
                        valueType: valueType
                    };
                }
                ;
                const extendedMessage = {
                    data,
                    table: message.table,
                    expiresAt: message.expiresAt,
                    createdAt: message.createdAt,
                };
                const unsPacket = {
                    message: extendedMessage,
                    version: unsPacketVersion,
                };
                return unsPacket;
            }
        }
        catch (error) {
            logger.error(`Could not create packet from message: ${error}`);
        }
    }
    static generateHmac(algorithm, key, data) {
        const hmac = crypto.createHmac(algorithm, key);
        hmac.update(data);
        return hmac.digest("hex");
    }
    static formatToISO8601(date) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        const hours = String(date.getUTCHours()).padStart(2, "0");
        const minutes = String(date.getUTCMinutes()).padStart(2, "0");
        const seconds = String(date.getUTCSeconds()).padStart(2, "0");
        const milliseconds = String(date.getUTCMilliseconds()).padStart(3, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
    }
    static compressString(input) {
        return new Promise((resolve, reject) => {
            zlib.deflate(input, (err, buffer) => {
                if (err) {
                    reject(err);
                }
                else {
                    const base64String = buffer.toString("base64");
                    resolve(base64String);
                }
            });
        });
    }
    // Function to decompress a Buffer back to a string
    static decompressString(base64Compressed) {
        return new Promise((resolve, reject) => {
            // Decode the base64 string to a Buffer
            const compressedBuffer = Buffer.from(base64Compressed, "base64");
            zlib.inflate(compressedBuffer, (err, buffer) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(buffer.toString());
                }
            });
        });
    }
}
//# sourceMappingURL=uns-packet.js.map