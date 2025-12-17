import * as crypto from "crypto";
import * as zlib from "zlib";
import logger from '../logger.js';
import {
  IUnsPacket,
  ISO8601,  
  IUnsData,
  IUnsMessage,
  isIOS8601Type,
  IUnsPackatParameters,
  IUnsExtendedMessage,
  IUnsExtendedData,
  IUnsTable
} from "./uns-interfaces.js";

// Version of the packet library
const unsPacketVersion = "1.2.0";

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
  public static parseMqttPacket(mqttPacket: string, instanceName?: string): IUnsPacket | null {
    try {
      const parsedMqttPacket: any = JSON.parse(mqttPacket);

      // Check uns packet
      if (parsedMqttPacket && parsedMqttPacket.version) {
        const version = parsedMqttPacket.version;
        const data: IUnsExtendedData | undefined = parsedMqttPacket.message.data;
        const table: IUnsTable | undefined = parsedMqttPacket.message.table;
        const expiresAt: ISO8601 | undefined =
          parsedMqttPacket.message.expiresAt;
        const createdAt: ISO8601 | undefined =
          parsedMqttPacket.message.createdAt;

        // Validate data and table objects
        UnsPacket.validateMessageComponents(data, table);

        const message: IUnsExtendedMessage = {
          ...(data !== undefined && { data }),
          ...(table !== undefined && { table }),
          ...(expiresAt !== undefined && { expiresAt }),
          ...(createdAt !== undefined && { createdAt }),
        };
        const messageSignature = parsedMqttPacket.messageSignature;

        const interval: number | undefined = parsedMqttPacket.interval;

        const unsPacket: IUnsPacket = {
          message,
          messageSignature,
          version,
          interval
        };

        return unsPacket;
      } else {
        logger.debug("Version number not specified in the mqtt packet");
      }
    } catch (error) {
      if (instanceName) {
        logger.error(`${instanceName} - Could not parse packet: ${error}`);
      } else {
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
  private static validateMessageComponents(data?: IUnsData, table?: IUnsTable): boolean | null {
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

      const oldTable: any = table;
      if (oldTable.tableName) {
        logger.debug(
          `The 'tableName' property is deprecated. Use 'dataGroup' instead.`
        );
      } else if (table.values) {
        Object.entries(table.values).forEach(([key, value]) => {
          if (
            typeof value !== "number" &&
            typeof value !== "string" &&
            value !== null &&
            value !== undefined
          ) {
            throw new Error(
              `Value for key '${key}' in table.values must be of type number, string, null, or undefined`
            );
          }
        });
      } else {
        throw new Error(`No values for table`);
      }
    }

    return true;
  }

  static async unsPacketFromUnsMessage(
    message: IUnsMessage,
    unsPackatParameters?: IUnsPackatParameters,
  ): Promise<IUnsPacket> {
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

        let data: IUnsExtendedData = undefined;

        if (message.data && message.data.value !== undefined) {
          data = {
            ...message.data,
            valueType: typeof message.data.value
          }
        };

        const extendedMessage: IUnsExtendedMessage = {
          data,
          table: message.table,
          expiresAt: message.expiresAt,
          createdAt: message.createdAt,
        };

        const unsPacket: IUnsPacket = {
          message: extendedMessage,
          version: unsPacketVersion,
        };
        
        return unsPacket;    
      }
    } catch (error) {
      logger.error(`Could not create packet from message: ${error}`);
    }

  }

  private static generateHmac(
    algorithm: string,
    key: string,
    data: string,
  ): string {
    const hmac = crypto.createHmac(algorithm, key);
    hmac.update(data);
    return hmac.digest("hex");
  }

  static formatToISO8601(date: Date): ISO8601 {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    const milliseconds = String(date.getUTCMilliseconds()).padStart(3, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
  }

  private static compressString(input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      zlib.deflate(input, (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          const base64String = buffer.toString("base64");
          resolve(base64String);
        }
      });
    });
  }

  // Function to decompress a Buffer back to a string
  private static decompressString(base64Compressed: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Decode the base64 string to a Buffer
      const compressedBuffer = Buffer.from(base64Compressed, "base64");

      zlib.inflate(compressedBuffer, (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(buffer.toString());
        }
      });
    });
  }
}
