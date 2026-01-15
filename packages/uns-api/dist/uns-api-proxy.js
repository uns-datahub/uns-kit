import { readFileSync } from "fs";
import jwt from "jsonwebtoken";
import * as path from "path";
import { createPublicKey } from "crypto";
import { basePath } from "@uns-kit/core/base-path.js";
import { UnsAttributeType } from "@uns-kit/core/graphql/schema.js";
import logger from "@uns-kit/core/logger.js";
import { MqttTopicBuilder } from "@uns-kit/core/uns-mqtt/mqtt-topic-builder.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import UnsProxy from "@uns-kit/core/uns/uns-proxy.js";
import { UnsTopicMatcher } from "@uns-kit/core/uns/uns-topic-matcher.js";
import App from "./app.js";
const packageJsonPath = path.join(basePath, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
export default class UnsApiProxy extends UnsProxy {
    instanceName;
    topicBuilder;
    processName;
    processStatusTopic;
    app;
    options;
    jwksCache;
    constructor(processName, instanceName, options) {
        super();
        this.options = options;
        this.app = new App(0, processName, instanceName);
        this.app.start();
        this.instanceName = instanceName;
        this.processName = processName;
        // Create the topic builder using packageJson values and the processName.
        this.topicBuilder = new MqttTopicBuilder(`uns-infra/${MqttTopicBuilder.sanitizeTopicPart(packageJson.name)}/${MqttTopicBuilder.sanitizeTopicPart(packageJson.version)}/${MqttTopicBuilder.sanitizeTopicPart(processName)}/`);
        // Generate the processStatusTopic using the builder.
        this.processStatusTopic = this.topicBuilder.getProcessStatusTopic();
        // Derive the instanceStatusTopic by appending the instance name.
        this.instanceStatusTopic = this.processStatusTopic + instanceName + "/";
        // Concatenate processName with instanceName for the worker identification.
        this.instanceNameWithSuffix = `${processName}-${instanceName}`;
    }
    /**
     * Unregister endpoint
     * @param topic - The API topic
     * @param attribute - The attribute for the topic.
     * @param method - The HTTP method (e.g., "GET", "POST", "PUT", "DELETE").
     */
    async unregister(topic, asset, objectType, objectId, attribute, method) {
        const fullPath = `/${topic}${attribute}`;
        const apiPath = `/api${fullPath}`;
        const methodKey = method.toLowerCase(); // Express stores method keys in lowercase
        // Remove route from router
        if (this.app.router?.stack) {
            this.app.router.stack = this.app.router.stack.filter((layer) => {
                return !(layer.route &&
                    layer.route.path === fullPath &&
                    layer.route.methods[methodKey]);
            });
        }
        // Remove from Swagger spec if path exists
        if (this.app.swaggerSpec?.paths?.[apiPath]) {
            delete this.app.swaggerSpec.paths[apiPath][methodKey];
            // If no methods remain for the path, delete the whole path
            if (Object.keys(this.app.swaggerSpec.paths[apiPath]).length === 0) {
                delete this.app.swaggerSpec.paths[apiPath];
            }
        }
        // Unregister from internal endpoint tracking
        this.unregisterApiEndpoint(topic, asset, objectType, objectId, attribute);
    }
    /**
     * Register a GET endpoint with optional JWT path filter.
     * @param topic - The API topic
     * @param attribute - The attribute for the topic.
     * @param options.description - Optional description.
     * @param options.tags - Optional tags.
     */
    async get(topic, asset, objectType, objectId, attribute, options) {
        // Wait until the API server is started
        while (this.app.server.listening === false) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const time = UnsPacket.formatToISO8601(new Date());
        try {
            // Get ip and port from environment variables or defaults
            const addressInfo = this.app.server.address();
            let ip;
            let port;
            if (addressInfo && typeof addressInfo === "object") {
                ip = App.getExternalIPv4();
                port = addressInfo.port;
            }
            else if (typeof addressInfo === "string") {
                ip = App.getExternalIPv4();
                port = "";
            }
            this.registerApiEndpoint({
                timestamp: time,
                topic: topic,
                attribute: attribute,
                apiHost: `http://${ip}:${port}`,
                apiEndpoint: `/api/${topic}${attribute}`,
                apiMethod: "GET",
                apiQueryParams: options.queryParams,
                apiDescription: options?.apiDescription,
                attributeType: UnsAttributeType.Api,
                apiSwaggerEndpoint: `/${this.processName}/${this.instanceName}/swagger.json`,
                asset,
                objectType,
                objectId
            });
            const fullPath = `/${topic}${attribute}`;
            const handler = (req, res) => {
                // Query param validation
                if (options?.queryParams) {
                    const missingParams = options.queryParams.filter((p) => p.required && req.query[p.name] === undefined).map((p) => p.name);
                    if (missingParams.length > 0) {
                        return res.status(400).json({ error: `Missing query params: ${missingParams.join(", ")}` });
                    }
                    // Optional: cast types (basic)
                    for (const param of options.queryParams) {
                        const value = req.query[param.name];
                        if (value !== undefined) {
                            switch (param.type) {
                                case "number":
                                    if (isNaN(Number(value))) {
                                        return res.status(400).json({ error: `Query param ${param.name} must be a number` });
                                    }
                                    break;
                                case "boolean":
                                    if (!["true", "false", "1", "0"].includes(String(value))) {
                                        return res.status(400).json({ error: `Query param ${param.name} must be boolean` });
                                    }
                                    break;
                                // string: no check
                            }
                        }
                    }
                }
                this.event.emit("apiGetEvent", { req, res });
            };
            // JWT or JWKS or open
            if (this.options?.jwks?.wellKnownJwksUrl) {
                this.app.router.get(fullPath, async (req, res) => {
                    try {
                        const token = this.extractBearerToken(req, res);
                        if (!token)
                            return; // response already sent
                        const publicKey = await this.getPublicKeyFromJwks(token);
                        const algorithms = this.options.jwks.algorithms || ["RS256"];
                        const decoded = jwt.verify(token, publicKey, { algorithms });
                        const accessRules = Array.isArray(decoded?.accessRules)
                            ? decoded.accessRules
                            : (typeof decoded?.pathFilter === "string" && decoded.pathFilter.length > 0
                                ? [decoded.pathFilter]
                                : undefined);
                        const allowed = Array.isArray(accessRules)
                            ? accessRules.some((rule) => UnsTopicMatcher.matches(rule, fullPath))
                            : false;
                        if (!allowed) {
                            return res.status(403).json({ error: "Path not allowed by token access rules" });
                        }
                        handler(req, res);
                    }
                    catch (err) {
                        return res.status(401).json({ error: "Invalid token" });
                    }
                });
            }
            else if (this.options?.jwtSecret) {
                this.app.router.get(fullPath, (req, res) => {
                    const authHeader = req.headers["authorization"];
                    if (!authHeader || !authHeader.startsWith("Bearer ")) {
                        return res.status(401).json({ error: "Missing or invalid Authorization header" });
                    }
                    const token = authHeader.slice(7);
                    try {
                        const decoded = jwt.verify(token, process.env.JWT_SECRET || this.options.jwtSecret);
                        const accessRules = Array.isArray(decoded?.accessRules)
                            ? decoded.accessRules
                            : (typeof decoded?.pathFilter === "string" && decoded.pathFilter.length > 0
                                ? [decoded.pathFilter]
                                : undefined);
                        const allowed = Array.isArray(accessRules)
                            ? accessRules.some((rule) => UnsTopicMatcher.matches(rule, fullPath))
                            : false;
                        if (!allowed) {
                            return res.status(403).json({ error: "Path not allowed by token access rules" });
                        }
                        handler(req, res);
                    }
                    catch (err) {
                        return res.status(401).json({ error: "Invalid token" });
                    }
                });
            }
            else {
                this.app.router.get(fullPath, handler);
            }
            if (this.app.swaggerSpec) {
                this.app.swaggerSpec.paths = this.app.swaggerSpec.paths || {};
                this.app.swaggerSpec.paths[`/api${fullPath}`] = {
                    get: {
                        summary: options?.apiDescription || "No description",
                        tags: options?.tags || [],
                        parameters: (options?.queryParams || []).map((p) => ({
                            name: p.name,
                            in: "query",
                            required: !!p.required,
                            schema: { type: p.type },
                            description: p.description,
                        })),
                        responses: {
                            "200": { description: "OK" },
                            "400": { description: "Bad Request" },
                            "401": { description: "Unauthorized" },
                            "403": { description: "Forbidden" },
                        },
                    },
                };
            }
        }
        catch (error) {
            logger.error(`${this.instanceNameWithSuffix} - Error publishing message to topic ${topic}${attribute}: ${error.message}`);
        }
    }
    /**
     * Register a catch-all API mapping for a topic prefix (e.g., "sij/acroni/#").
     * Does not create individual API attribute nodes; the controller treats this as a fallback.
     */
    async registerCatchAll(topicPrefix, options) {
        while (this.app.server.listening === false) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const addressInfo = this.app.server.address();
        let ip;
        let port;
        if (addressInfo && typeof addressInfo === "object") {
            ip = App.getExternalIPv4();
            port = addressInfo.port;
        }
        else if (typeof addressInfo === "string") {
            ip = App.getExternalIPv4();
            port = "";
        }
        const apiBase = typeof options?.apiBase === "string" && options.apiBase.length
            ? options.apiBase
            : `http://${ip}:${port}`;
        const apiBasePath = typeof options?.apiBasePath === "string" && options.apiBasePath.length
            ? options.apiBasePath
            : "/api";
        const swaggerPath = typeof options?.swaggerPath === "string" && options.swaggerPath.length
            ? options.swaggerPath
            : `/${this.processName}/${this.instanceName}/swagger.json`;
        this.registerApiCatchAll({
            topic: topicPrefix,
            apiBase,
            apiBasePath,
            swaggerPath,
        });
    }
    post(..._args) {
        // Implement POST logic or route binding here
        return "POST called";
    }
    extractBearerToken(req, res) {
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Missing or invalid Authorization header" });
            return undefined;
        }
        return authHeader.slice(7);
    }
    async getPublicKeyFromJwks(token) {
        // Decode header to get kid
        const decoded = jwt.decode(token, { complete: true });
        const kid = decoded?.header?.kid;
        const keys = await this.fetchJwksKeys();
        let jwk = kid ? keys.find((k) => k.kid === kid) : undefined;
        // If no kid match and activeKidUrl configured, try that
        if (!jwk && this.options?.jwks?.activeKidUrl) {
            try {
                const resp = await fetch(this.options.jwks.activeKidUrl);
                if (resp.ok) {
                    const activeKid = await resp.text();
                    jwk = keys.find((k) => k.kid === activeKid.trim());
                }
            }
            catch (_) {
                // ignore and fall through
            }
        }
        // If still not found but only one key, use it
        if (!jwk && keys.length === 1) {
            jwk = keys[0];
        }
        if (!jwk) {
            throw new Error("Signing key not found in JWKS");
        }
        // Prefer x5c certificate if provided
        if (Array.isArray(jwk.x5c) && jwk.x5c.length > 0) {
            return this.certFromX5c(jwk.x5c[0]);
        }
        // Build PEM from JWK (RSA)
        if (jwk.kty === "RSA" && jwk.n && jwk.e) {
            const keyObj = createPublicKey({ key: { kty: "RSA", n: jwk.n, e: jwk.e }, format: "jwk" });
            return keyObj.export({ type: "spki", format: "pem" }).toString();
        }
        throw new Error("Unsupported JWK format");
    }
    async fetchJwksKeys() {
        const ttl = this.options?.jwks?.cacheTtlMs ?? 5 * 60 * 1000; // default 5 minutes
        const now = Date.now();
        if (this.jwksCache && now - this.jwksCache.fetchedAt < ttl) {
            return this.jwksCache.keys;
        }
        const url = this.options.jwks.wellKnownJwksUrl;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch JWKS (${resp.status})`);
        }
        const body = await resp.json();
        const keys = Array.isArray(body?.keys) ? body.keys : [];
        this.jwksCache = { keys, fetchedAt: now };
        return keys;
    }
    certFromX5c(x5cFirst) {
        const pemBody = x5cFirst.match(/.{1,64}/g)?.join("\n") ?? x5cFirst;
        return `-----BEGIN CERTIFICATE-----\n${pemBody}\n-----END CERTIFICATE-----\n`;
    }
}
