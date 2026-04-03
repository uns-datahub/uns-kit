import { IUnsPacket, ISO8601, IUnsMessage, IUnsPackatParameters } from "./uns-interfaces.js";
export declare class UnsPacket {
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
    static parseMqttPacket(mqttPacket: string, instanceName?: string): IUnsPacket | null;
    /**
     * Validates the data and table objects to ensure they have the required properties
     * and that those properties have the correct types.
     *
     * @param data - The data object to validate
     * @param table - The table object to validate
     * @returns boolean | null
     */
    private static validateMessageComponents;
    static unsPacketFromUnsMessage(message: IUnsMessage, unsPackatParameters?: IUnsPackatParameters): Promise<IUnsPacket>;
    private static generateHmac;
    static formatToISO8601(date: Date): ISO8601;
    private static compressString;
    private static decompressString;
}
//# sourceMappingURL=uns-packet.d.ts.map