import { isMainThread, parentPort, workerData } from "worker_threads";
import { MqttWorker } from "./mqtt-worker.js";
if (!isMainThread && parentPort) {
    new MqttWorker(workerData);
}
