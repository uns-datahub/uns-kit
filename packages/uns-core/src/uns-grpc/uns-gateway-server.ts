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
import UnsMqttProxy, { MessageMode } from "../uns-mqtt/uns-mqtt-proxy.js";
import { IUnsMessage, IMqttMessage } from "../uns/uns-interfaces.js";
import { UnsPacket } from "../uns/uns-packet.js";
import { IApiProxyOptions, IGetEndpointOptions } from "../uns/uns-interfaces.js";
import { randomUUID } from "crypto";
import { MqttTopicBuilder } from "../uns-mqtt/mqtt-topic-builder.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultGatewayProto = path.resolve(__dirname, "uns-gateway.proto");
const GATEWAY_PROTO = process.env.UNS_GATEWAY_PROTO
  ? path.resolve(process.cwd(), process.env.UNS_GATEWAY_PROTO)
  : defaultGatewayProto;

type GrpcServer = grpc.Server;

export interface GatewayAddress {
  address: string; // e.g. unix:/tmp/... or 0.0.0.0:PORT
  isUDS: boolean;
}

export interface GatewayStartOptions {
  processNameOverride?: string;
  instanceSuffix?: string;
  instanceModeOverride?: "wait" | "force" | "handover";
  handoverOverride?: boolean;
}

type UnsApiProxyLike = {
  event: { on(event: string, handler: (payload: any) => void): void };
  get(topic: string, attribute: string, options: IGetEndpointOptions): Promise<void>;
  unregister(topic: string, attribute: string, method: "GET" | "POST" | "PUT" | "DELETE"): Promise<void>;
};

type UnsProxyProcessWithApi = UnsProxyProcess & {
  createApiProxy(instanceName: string, options: IApiProxyOptions): Promise<UnsApiProxyLike>;
};

export class UnsGatewayServer {
  private server: GrpcServer | null = null;
  private unsProcess: UnsProxyProcessWithApi | null = null;
  private mqttInput: UnsMqttProxy | null = null;
  private mqttOutput: UnsMqttProxy | null = null;
  private handlers: Set<Function> = new Set();
  private unsApiProxy: UnsApiProxyLike | null = null;
  private apiStreams: Set<any> = new Set();
  private pendingApi: Map<string, any> = new Map();

  private inputHost: string;
  private outputHost: string;
  private apiOptions: IApiProxyOptions | null = null;
  private outPublisherActive = false;
  private inSubscriberActive = false;

  public async start(
    desiredAddr?: string,
    opts?: {
      processNameOverride?: string;
      instanceSuffix?: string;
      instanceModeOverride?: "wait" | "force" | "handover";
      handoverOverride?: boolean;
    }
  ): Promise<GatewayAddress> {
    const packageDef = protoLoader.loadSync(GATEWAY_PROTO, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const proto = grpc.loadPackageDefinition(packageDef) as any;

    // Load config and init UNS process + MQTT proxies
    const cfg = await ConfigFile.loadConfig();
    const processName = opts?.processNameOverride ?? cfg.uns.processName;
    const instanceMode = opts?.instanceModeOverride ?? cfg.uns.instanceMode;
    const handover = (typeof opts?.handoverOverride === "boolean") ? opts.handoverOverride : cfg.uns.handover;
    const suffix = opts?.instanceSuffix ? `-${opts.instanceSuffix}` : "";

    this.unsProcess = new UnsProxyProcess(cfg.infra.host, { processName }) as UnsProxyProcessWithApi;
    // cache hosts/options; proxies created lazily on first use
    this.inputHost = cfg.input.host;
    this.outputHost = cfg.output.host;
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
    let addr: string | null = desiredAddr || process.env.UNS_GATEWAY_ADDR || null;
    if (!addr) {
      if (isUnix) {
        const sanitizedProcess = MqttTopicBuilder.sanitizeTopicPart(this.getProcessName());
        const sock = `/tmp/${sanitizedProcess}-uns-gateway.sock`;
        addr = `unix:${sock}`;
      } else {
        const port = await getPort();
        addr = `0.0.0.0:${port}`;
      }
    }

    // If UDS and file exists, best-effort unlink (stale sock)
    if (addr.startsWith("unix:")) {
      const fs = await import("fs");
      const p = addr.slice("unix:".length);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }

    await new Promise<void>((resolve, reject) => {
      this.server!.bindAsync(addr!, grpc.ServerCredentials.createInsecure(), (err) => {
        if (err) return reject(err);
        // grpc-js automatically starts the server after bindAsync in recent versions
        // Calling start() is deprecated; omit to avoid warnings.
        logger.info(`UNS gRPC Gateway listening on ${addr}`);
        resolve();
      });
    });

    return { address: addr!, isUDS: addr!.startsWith("unix:") };
  }

  private getProcessName(): string {
    try {
      const pkgPath = path.join(basePath, "package.json");
      const raw = readFileSync(pkgPath, "utf8");
      const pkg = JSON.parse(raw);
      return `${pkg.name}-${pkg.version}`;
    } catch {
      return `uns-gateway`;
    }
  }

  private async publish(call: any, callback: any) {
    try {
      await this.ensureMqttOutput();
      const req = call.request as any;
      if (!this.mqttOutput) throw new Error("Gateway not initialized");

      const topic: string = req.topic;
      const attribute: string = req.attribute;
      const description: string = req.description ?? "";
      const tags: string[] = (req.tags ?? []) as string[];
      const attributeNeedsPersistence: boolean | null = req.attribute_needs_persistence ?? null;
      const valueIsCumulative: boolean = req.value_is_cumulative ?? false;

      let message: IUnsMessage | null = null;

      if (req.data) {
        const d = req.data;
        const time: string = d.time;
        const uom: string | undefined = d.uom || undefined;
        const dataGroup: string | undefined = d.data_group || undefined;
        const foreignEventKey: string | undefined = d.foreign_event_key || undefined;

        let value: any = undefined;
        if (typeof d.value_number === "number" && !Number.isNaN(d.value_number)) {
          value = d.value_number;
        } else if (typeof d.value_string === "string" && d.value_string.length > 0) {
          value = d.value_string;
        }
        if (value === undefined) throw new Error("Data.value_number or Data.value_string must be set");

        message = { data: { time, value, uom, dataGroup, foreignEventKey } } as IUnsMessage;
      } else if (req.table) {
        const t = req.table;
        const time: string = t.time;
        const dataGroup: string | undefined = t.data_group || undefined;
        const values: Record<string, string | number | null | undefined> = {};
        (t.values ?? []).forEach((kv: any) => {
          const key = kv.key as string;
          if (typeof kv.value_number === "number" && !Number.isNaN(kv.value_number)) {
            values[key] = kv.value_number;
          } else if (typeof kv.value_string === "string") {
            values[key] = kv.value_string;
          } else {
            values[key] = null;
          }
        });
        message = { table: { time, values, dataGroup } } as IUnsMessage;
      } else {
        throw new Error("PublishRequest.content must be data or table");
      }

      const packet = await UnsPacket.unsPacketFromUnsMessage(message);
      const mqttMsg: IMqttMessage = {
        topic,
        attribute,
        description,
        tags,
        packet,
        attributeNeedsPersistence,
      };

      // delta mode if cumulative
      if (message.data && valueIsCumulative) {
        this.mqttOutput.publishMqttMessage(mqttMsg, MessageMode.Delta);
      } else {
        this.mqttOutput.publishMqttMessage(mqttMsg, MessageMode.Raw);
      }

      callback(null, { ok: true });
    } catch (err: any) {
      logger.error(`Gateway Publish error: ${err.message}`);
      callback(null, { ok: false, error: err.message });
    }
  }

  private async subscribe(call: any) {
    await this.ensureMqttInput();
    const req = call.request as any;
    const topics: string[] = (req.topics ?? []) as string[];
    if (topics.length === 0) {
      call.emit("error", { code: grpc.status.INVALID_ARGUMENT, details: "topics is required" });
      call.end();
      return;
    }

    // Subscribe and stream messages to this client
    this.mqttInput.subscribeAsync(topics);

    const handler = (event: any) => {
      try {
        // Forward as UNS packet JSON if parsable, else raw message
        const payload = event.packet ? JSON.stringify(event.packet) : String(event.message ?? "");
        call.write({ topic: event.topic, payload });
      } catch (e) {
        // drop
      }
    };
    this.handlers.add(handler);
    this.mqttInput.event.on("input", handler);

    call.on("cancelled", () => this.cleanupHandler(handler));
    call.on("error", () => this.cleanupHandler(handler));
    call.on("close", () => this.cleanupHandler(handler));
  }

  private attachStatusListeners(): void {
    if (this.mqttOutput) {
      this.mqttOutput.event.on("mqttProxyStatus", (e: any) => {
        if (e?.event === "t-publisher-active") this.outPublisherActive = !!e.value;
      });
    }
    if (this.mqttInput) {
      this.mqttInput.event.on("mqttProxyStatus", (e: any) => {
        if (e?.event === "t-subscriber-active") this.inSubscriberActive = !!e.value;
      });
    }
  }

  private async ensureMqttOutput() {
    if (!this.mqttOutput) {
      // slight delay to let process MQTT connect
      while ((this.unsProcess as any)?.processMqttProxy?.isConnected === false) {
        await new Promise((r) => setTimeout(r, 50));
      }
      this.mqttOutput = await this.unsProcess!.createUnsMqttProxy(
        this.outputHost,
        this.getInstanceName("gatewayOutput"),
        "force",
        true,
        { publishThrottlingDelay: 1 },
      );
      this.attachStatusListeners();
    }
  }

  private async ensureMqttInput() {
    if (!this.mqttInput) {
      while ((this.unsProcess as any)?.processMqttProxy?.isConnected === false) {
        await new Promise((r) => setTimeout(r, 50));
      }
      this.mqttInput = await this.unsProcess!.createUnsMqttProxy(
        this.inputHost,
        this.getInstanceName("gatewayInput"),
        "force",
        true,
        { mqttSubToTopics: [] },
      );
      this.attachStatusListeners();
    }
  }

  private async ensureApiProxy() {
    if (!this.unsApiProxy) {
      if (typeof (this.unsProcess as any)?.createApiProxy !== "function") {
        throw new Error("API plugin not registered. Please install @uns-kit/api and register it with UnsProxyProcess before starting the gateway.");
      }
      this.unsApiProxy = await this.unsProcess!.createApiProxy(this.getInstanceName("gatewayApi"), this.apiOptions!);
      this.unsApiProxy.event.on("apiGetEvent", (event: any) => this.onApiGetEvent(event));
    }
  }

  private getInstanceName(base: string): string {
    // derive suffix from processName/CLI by inspecting configured instanceStatusTopic is overkill; keep base names unique per process
    return base;
  }

  private async registerApiGet(call: any, callback: any) {
    try {
      await this.ensureApiProxy();
      const req = call.request as any;
      const topic: string = req.topic;
      const attribute: string = req.attribute;
      const apiDescription: string | undefined = req.api_description || undefined;
      const tags: string[] | undefined = (req.tags ?? []) as string[];
      const queryParams: any[] = (req.query_params ?? []).map((p: any) => ({
        name: p.name,
        type: (p.type === "number" || p.type === "boolean") ? p.type : "string",
        required: !!p.required,
        description: p.description ?? undefined,
      }));

      const options: IGetEndpointOptions = {
        apiDescription,
        tags,
        queryParams,
      };
      await this.unsApiProxy.get(topic as any, attribute, options);
      callback(null, { ok: true });
    } catch (err: any) {
      logger.error(`Gateway RegisterApiGet error: ${err.message}`);
      callback(null, { ok: false, error: err.message });
    }
  }

  private async unregisterApiGet(call: any, callback: any) {
    try {
      await this.ensureApiProxy();
      const req = call.request as any;
      const topic: string = req.topic;
      const attribute: string = req.attribute;
      await this.unsApiProxy.unregister(topic as any, attribute, "GET");
      callback(null, { ok: true });
    } catch (err: any) {
      logger.error(`Gateway UnregisterApiGet error: ${err.message}`);
      callback(null, { ok: false, error: err.message });
    }
  }

  private onApiGetEvent(event: any) {
    // Correlate request and forward to connected gRPC streams
    const id = randomUUID();
    const req = event.req;
    const res = event.res;
    const path: string = req.path || req.originalUrl || "/";
    // Derive topic/attribute is optional; we send path and query
    const bearer = (req.headers?.["authorization"] as string | undefined) ?? "";
    this.pendingApi.set(id, res);
    // Timeout after 10s
    setTimeout(() => {
      if (this.pendingApi.has(id)) {
        const r = this.pendingApi.get(id);
        try { r.status(504).send("Gateway timeout"); } catch {}
        this.pendingApi.delete(id);
      }
    }, 10_000).unref?.();

    const query: Record<string, string> = {};
    Object.entries(req.query || {}).forEach(([k, v]) => { query[k] = String(v); });
    const msg = { id, method: "GET", path, query, bearer };
    for (const stream of this.apiStreams) {
      try { stream.write(msg); } catch {}
    }
  }

  private async apiEventStream(call: any) {
    // Register stream
    await this.ensureApiProxy();
    this.apiStreams.add(call);
    call.on("data", (resp: any) => {
      const id: string = resp.id;
      const status: number = resp.status ?? 200;
      const body: string = resp.body ?? "";
      const headers: Record<string, string> = resp.headers ?? {};
      const res = this.pendingApi.get(id);
      if (res) {
        try {
          Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
          res.status(status).send(body);
        } catch {}
        this.pendingApi.delete(id);
      }
    });
    const cleanup = () => { this.apiStreams.delete(call); };
    call.on("cancelled", cleanup);
    call.on("error", cleanup);
    call.on("close", cleanup);
  }

  private async ready(call: any, callback: any) {
    try {
      const req = call.request as any;
      const timeoutMs: number = req.timeout_ms && req.timeout_ms > 0 ? req.timeout_ms : 15000;
      const waitOut = !!req.wait_output;
      const waitIn = !!req.wait_input;
      const waitApi = !!req.wait_api;

      if (waitOut) await this.ensureMqttOutput();
      if (waitIn) await this.ensureMqttInput();
      if (waitApi) await this.ensureApiProxy();

      const start = Date.now();
      const check = () => {
        const okOut = !waitOut || this.outPublisherActive;
        const okIn = !waitIn || this.inSubscriberActive;
        const okApi = !waitApi || !!this.unsApiProxy; // creation ensures listening
        return okOut && okIn && okApi;
      };

      if (check()) return callback(null, { ok: true });

      const onStatus = () => {
        if (check()) done(true);
      };

      const done = (ok: boolean, err?: string) => {
        if (this.mqttOutput) this.mqttOutput.event.off("mqttProxyStatus", onStatus as any);
        if (this.mqttInput) this.mqttInput.event.off("mqttProxyStatus", onStatus as any);
        callback(null, { ok, error: err });
      };

      if (this.mqttOutput) this.mqttOutput.event.on("mqttProxyStatus", onStatus as any);
      if (this.mqttInput) this.mqttInput.event.on("mqttProxyStatus", onStatus as any);

      const iv = setInterval(() => {
        if (check()) {
          clearInterval(iv);
          done(true);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          done(false, "timeout waiting for readiness");
        }
      }, 100);
    } catch (e: any) {
      callback(null, { ok: false, error: e.message });
    }
  }

  private cleanupHandler(handler: Function) {
    if (this.mqttInput) this.mqttInput.event.off("input", handler as any);
    this.handlers.delete(handler);
  }

  public async shutdown(): Promise<void> {
    try {
      for (const h of Array.from(this.handlers)) this.cleanupHandler(h);
      if (this.server) {
        await new Promise<void>((resolve) => this.server!.tryShutdown(() => resolve()));
        this.server = null;
      }
      if (this.unsProcess) this.unsProcess.shutdown();
    } catch (e: any) {
      logger.error(`Gateway shutdown error: ${e.message}`);
    }
  }
}

export async function startUnsGateway(addrOverride?: string, opts?: GatewayStartOptions): Promise<GatewayAddress> {
  const gw = new UnsGatewayServer();
  return gw.start(addrOverride, opts);
}
function sanitizeTopicPart(getProcessName: () => string) {
  throw new Error("Function not implemented.");
}
