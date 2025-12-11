import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import getPort from "get-port";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { basePath } from "../base-path.js";
import logger from "../logger.js";
import { ConfigFile } from "../config-file.js";
import UnsProxyProcess from "../uns/uns-proxy-process.js";
import { MessageMode } from "../uns-mqtt/uns-mqtt-proxy.js";
import { UnsPacket } from "../uns/uns-packet.js";
import { randomUUID } from "crypto";
import { MqttTopicBuilder } from "../uns-mqtt/mqtt-topic-builder.js";
import { ObjectTypes } from "../uns/uns-object.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultGatewayProto = path.resolve(__dirname, "uns-gateway.proto");
const GATEWAY_PROTO = process.env.UNS_GATEWAY_PROTO
    ? path.resolve(process.cwd(), process.env.UNS_GATEWAY_PROTO)
    : defaultGatewayProto;
const requireHost = (value, pathLabel) => {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Configuration value '${pathLabel}' is required and must resolve to a string host.`);
    }
    return value;
};
export class UnsGatewayServer {
    server = null;
    unsProcess = null;
    mqttInput = null;
    mqttOutput = null;
    handlers = new Set();
    unsApiProxy = null;
    apiStreams = new Set();
    pendingApi = new Map();
    inputHost;
    outputHost;
    apiOptions = null;
    outPublisherActive = false;
    inSubscriberActive = false;
    async start(desiredAddr, opts) {
        const packageDef = protoLoader.loadSync(GATEWAY_PROTO, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const proto = grpc.loadPackageDefinition(packageDef);
        // Load config and init UNS process + MQTT proxies
        const cfg = await ConfigFile.loadConfig();
        const processName = opts?.processNameOverride ?? cfg.uns.processName;
        const instanceMode = opts?.instanceModeOverride ?? cfg.uns.instanceMode;
        const handover = (typeof opts?.handoverOverride === "boolean") ? opts.handoverOverride : cfg.uns.handover;
        const suffix = opts?.instanceSuffix ? `-${opts.instanceSuffix}` : "";
        const infraHost = requireHost(cfg.infra?.host, "infra.host");
        this.unsProcess = new UnsProxyProcess(infraHost, { processName });
        // cache hosts/options; proxies created lazily on first use
        this.inputHost = requireHost(cfg.input?.host, "input.host");
        this.outputHost = requireHost(cfg.output?.host, "output.host");
        this.apiOptions = cfg.uns?.jwksWellKnownUrl
            ? { jwks: { wellKnownJwksUrl: cfg.uns.jwksWellKnownUrl, activeKidUrl: cfg.uns.kidWellKnownUrl } }
            : { jwtSecret: "CHANGEME" };
        const serviceImpl = {
            Publish: this.publish.bind(this),
            Subscribe: this.subscribe.bind(this),
            RegisterApiGet: this.registerApiGet.bind(this),
            UnregisterApiGet: this.unregisterApiGet.bind(this),
            ApiEventStream: this.apiEventStream.bind(this),
            Ready: this.ready.bind(this),
        };
        this.server = new grpc.Server();
        this.server.addService(proto.uns.UnsGateway.service, serviceImpl);
        const isUnix = process.platform !== "win32";
        let addr = desiredAddr || process.env.UNS_GATEWAY_ADDR || null;
        if (!addr) {
            if (isUnix) {
                const sanitizedProcess = MqttTopicBuilder.sanitizeTopicPart(this.getProcessName());
                const sock = `/tmp/${sanitizedProcess}-uns-gateway.sock`;
                addr = `unix:${sock}`;
            }
            else {
                const port = await getPort();
                addr = `0.0.0.0:${port}`;
            }
        }
        // If UDS and file exists, best-effort unlink (stale sock)
        if (addr.startsWith("unix:")) {
            const fs = await import("fs");
            const p = addr.slice("unix:".length);
            try {
                if (fs.existsSync(p))
                    fs.unlinkSync(p);
            }
            catch { }
        }
        await new Promise((resolve, reject) => {
            this.server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err) => {
                if (err)
                    return reject(err);
                // grpc-js automatically starts the server after bindAsync in recent versions
                // Calling start() is deprecated; omit to avoid warnings.
                logger.info(`UNS gRPC Gateway listening on ${addr}`);
                resolve();
            });
        });
        return { address: addr, isUDS: addr.startsWith("unix:") };
    }
    getProcessName() {
        try {
            const pkgPath = path.join(basePath, "package.json");
            const raw = readFileSync(pkgPath, "utf8");
            const pkg = JSON.parse(raw);
            return `${pkg.name}-${pkg.version}`;
        }
        catch {
            return `uns-gateway`;
        }
    }
    async publish(call, callback) {
        try {
            await this.ensureMqttOutput();
            const req = call.request;
            if (!this.mqttOutput)
                throw new Error("Gateway not initialized");
            const topic = req.topic;
            const attribute = req.attribute;
            const description = req.description ?? "";
            const tags = (req.tags ?? []);
            const attributeNeedsPersistence = req.attribute_needs_persistence ?? null;
            const valueIsCumulative = req.value_is_cumulative ?? false;
            let message = null;
            if (req.data) {
                const d = req.data;
                const time = d.time;
                const uom = d.uom || undefined;
                const dataGroup = d.data_group || undefined;
                const foreignEventKey = d.foreign_event_key || undefined;
                let value = undefined;
                if (typeof d.value_number === "number" && !Number.isNaN(d.value_number)) {
                    value = d.value_number;
                }
                else if (typeof d.value_string === "string" && d.value_string.length > 0) {
                    value = d.value_string;
                }
                if (value === undefined)
                    throw new Error("Data.value_number or Data.value_string must be set");
                message = { data: { time, value, uom, dataGroup, foreignEventKey } };
            }
            else if (req.table) {
                const t = req.table;
                const time = t.time;
                const dataGroup = t.data_group || undefined;
                const values = {};
                (t.values ?? []).forEach((kv) => {
                    const key = kv.key;
                    if (typeof kv.value_number === "number" && !Number.isNaN(kv.value_number)) {
                        values[key] = kv.value_number;
                    }
                    else if (typeof kv.value_string === "string") {
                        values[key] = kv.value_string;
                    }
                    else {
                        values[key] = null;
                    }
                });
                message = { table: { time, values, dataGroup } };
            }
            else {
                throw new Error("PublishRequest.content must be data or table");
            }
            const packet = await UnsPacket.unsPacketFromUnsMessage(message);
            const mqttMsg = {
                topic,
                attribute,
                description,
                tags,
                packet,
                asset: "meter",
                objectType: ObjectTypes.EnergyResource,
                objectId: "main",
                attributeNeedsPersistence,
            };
            // delta mode if cumulative
            if (message.data && valueIsCumulative) {
                this.mqttOutput.publishMqttMessage(mqttMsg, MessageMode.Delta);
            }
            else {
                this.mqttOutput.publishMqttMessage(mqttMsg, MessageMode.Raw);
            }
            callback(null, { ok: true });
        }
        catch (err) {
            logger.error(`Gateway Publish error: ${err.message}`);
            callback(null, { ok: false, error: err.message });
        }
    }
    async subscribe(call) {
        await this.ensureMqttInput();
        const req = call.request;
        const topics = (req.topics ?? []);
        if (topics.length === 0) {
            call.emit("error", { code: grpc.status.INVALID_ARGUMENT, details: "topics is required" });
            call.end();
            return;
        }
        // Subscribe and stream messages to this client
        this.mqttInput.subscribeAsync(topics);
        const handler = (event) => {
            try {
                // Forward as UNS packet JSON if parsable, else raw message
                const payload = event.packet ? JSON.stringify(event.packet) : String(event.message ?? "");
                call.write({ topic: event.topic, payload });
            }
            catch (e) {
                // drop
            }
        };
        this.handlers.add(handler);
        this.mqttInput.event.on("input", handler);
        call.on("cancelled", () => this.cleanupHandler(handler));
        call.on("error", () => this.cleanupHandler(handler));
        call.on("close", () => this.cleanupHandler(handler));
    }
    attachStatusListeners() {
        if (this.mqttOutput) {
            this.mqttOutput.event.on("mqttProxyStatus", (e) => {
                if (e?.event === "t-publisher-active")
                    this.outPublisherActive = !!e.value;
            });
        }
        if (this.mqttInput) {
            this.mqttInput.event.on("mqttProxyStatus", (e) => {
                if (e?.event === "t-subscriber-active")
                    this.inSubscriberActive = !!e.value;
            });
        }
    }
    async ensureMqttOutput() {
        if (!this.mqttOutput) {
            // slight delay to let process MQTT connect
            while (this.unsProcess?.processMqttProxy?.isConnected === false) {
                await new Promise((r) => setTimeout(r, 50));
            }
            this.mqttOutput = await this.unsProcess.createUnsMqttProxy(this.outputHost, this.getInstanceName("gatewayOutput"), "force", true, { publishThrottlingDelay: 1 });
            this.attachStatusListeners();
        }
    }
    async ensureMqttInput() {
        if (!this.mqttInput) {
            while (this.unsProcess?.processMqttProxy?.isConnected === false) {
                await new Promise((r) => setTimeout(r, 50));
            }
            this.mqttInput = await this.unsProcess.createUnsMqttProxy(this.inputHost, this.getInstanceName("gatewayInput"), "force", true, { mqttSubToTopics: [] });
            this.attachStatusListeners();
        }
    }
    async ensureApiProxy() {
        if (!this.unsApiProxy) {
            if (typeof this.unsProcess?.createApiProxy !== "function") {
                throw new Error("API plugin not registered. Please install @uns-kit/api and register it with UnsProxyProcess before starting the gateway.");
            }
            this.unsApiProxy = await this.unsProcess.createApiProxy(this.getInstanceName("gatewayApi"), this.apiOptions);
            this.unsApiProxy.event.on("apiGetEvent", (event) => this.onApiGetEvent(event));
        }
    }
    getInstanceName(base) {
        // derive suffix from processName/CLI by inspecting configured instanceStatusTopic is overkill; keep base names unique per process
        return base;
    }
    async registerApiGet(call, callback) {
        try {
            await this.ensureApiProxy();
            const req = call.request;
            const topic = req.topic;
            const attribute = req.attribute;
            const apiDescription = req.api_description || undefined;
            const tags = (req.tags ?? []);
            const queryParams = (req.query_params ?? []).map((p) => ({
                name: p.name,
                type: (p.type === "number" || p.type === "boolean") ? p.type : "string",
                required: !!p.required,
                description: p.description ?? undefined,
            }));
            const options = {
                apiDescription,
                tags,
                queryParams,
            };
            await this.unsApiProxy.get(topic, attribute, options);
            callback(null, { ok: true });
        }
        catch (err) {
            logger.error(`Gateway RegisterApiGet error: ${err.message}`);
            callback(null, { ok: false, error: err.message });
        }
    }
    async unregisterApiGet(call, callback) {
        try {
            await this.ensureApiProxy();
            const req = call.request;
            const topic = req.topic;
            const attribute = req.attribute;
            await this.unsApiProxy.unregister(topic, attribute, "GET");
            callback(null, { ok: true });
        }
        catch (err) {
            logger.error(`Gateway UnregisterApiGet error: ${err.message}`);
            callback(null, { ok: false, error: err.message });
        }
    }
    onApiGetEvent(event) {
        // Correlate request and forward to connected gRPC streams
        const id = randomUUID();
        const req = event.req;
        const res = event.res;
        const path = req.path || req.originalUrl || "/";
        // Derive topic/attribute is optional; we send path and query
        const bearer = req.headers?.["authorization"] ?? "";
        this.pendingApi.set(id, res);
        // Timeout after 10s
        setTimeout(() => {
            if (this.pendingApi.has(id)) {
                const r = this.pendingApi.get(id);
                try {
                    r.status(504).send("Gateway timeout");
                }
                catch { }
                this.pendingApi.delete(id);
            }
        }, 10_000).unref?.();
        const query = {};
        Object.entries(req.query || {}).forEach(([k, v]) => { query[k] = String(v); });
        const msg = { id, method: "GET", path, query, bearer };
        for (const stream of this.apiStreams) {
            try {
                stream.write(msg);
            }
            catch { }
        }
    }
    async apiEventStream(call) {
        // Register stream
        await this.ensureApiProxy();
        this.apiStreams.add(call);
        call.on("data", (resp) => {
            const id = resp.id;
            const status = resp.status ?? 200;
            const body = resp.body ?? "";
            const headers = resp.headers ?? {};
            const res = this.pendingApi.get(id);
            if (res) {
                try {
                    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
                    res.status(status).send(body);
                }
                catch { }
                this.pendingApi.delete(id);
            }
        });
        const cleanup = () => { this.apiStreams.delete(call); };
        call.on("cancelled", cleanup);
        call.on("error", cleanup);
        call.on("close", cleanup);
    }
    async ready(call, callback) {
        try {
            const req = call.request;
            const timeoutMs = req.timeout_ms && req.timeout_ms > 0 ? req.timeout_ms : 15000;
            const waitOut = !!req.wait_output;
            const waitIn = !!req.wait_input;
            const waitApi = !!req.wait_api;
            if (waitOut)
                await this.ensureMqttOutput();
            if (waitIn)
                await this.ensureMqttInput();
            if (waitApi)
                await this.ensureApiProxy();
            const start = Date.now();
            const check = () => {
                const okOut = !waitOut || this.outPublisherActive;
                const okIn = !waitIn || this.inSubscriberActive;
                const okApi = !waitApi || !!this.unsApiProxy; // creation ensures listening
                return okOut && okIn && okApi;
            };
            if (check())
                return callback(null, { ok: true });
            const onStatus = () => {
                if (check())
                    done(true);
            };
            const done = (ok, err) => {
                if (this.mqttOutput)
                    this.mqttOutput.event.off("mqttProxyStatus", onStatus);
                if (this.mqttInput)
                    this.mqttInput.event.off("mqttProxyStatus", onStatus);
                callback(null, { ok, error: err });
            };
            if (this.mqttOutput)
                this.mqttOutput.event.on("mqttProxyStatus", onStatus);
            if (this.mqttInput)
                this.mqttInput.event.on("mqttProxyStatus", onStatus);
            const iv = setInterval(() => {
                if (check()) {
                    clearInterval(iv);
                    done(true);
                }
                else if (Date.now() - start > timeoutMs) {
                    clearInterval(iv);
                    done(false, "timeout waiting for readiness");
                }
            }, 100);
        }
        catch (e) {
            callback(null, { ok: false, error: e.message });
        }
    }
    cleanupHandler(handler) {
        if (this.mqttInput)
            this.mqttInput.event.off("input", handler);
        this.handlers.delete(handler);
    }
    async shutdown() {
        try {
            for (const h of Array.from(this.handlers))
                this.cleanupHandler(h);
            if (this.server) {
                await new Promise((resolve) => this.server.tryShutdown(() => resolve()));
                this.server = null;
            }
            if (this.unsProcess)
                this.unsProcess.shutdown();
        }
        catch (e) {
            logger.error(`Gateway shutdown error: ${e.message}`);
        }
    }
}
export async function startUnsGateway(addrOverride, opts) {
    const gw = new UnsGatewayServer();
    return gw.start(addrOverride, opts);
}
function sanitizeTopicPart(getProcessName) {
    throw new Error("Function not implemented.");
}
//# sourceMappingURL=uns-gateway-server.js.map