import { isMainThread, parentPort, workerData } from "worker_threads";
import { MqttWorker } from "./mqtt-worker";
if (!isMainThread && parentPort) {
    new MqttWorker(workerData);
}
