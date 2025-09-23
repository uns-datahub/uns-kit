/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
import readline from "readline";
import { ConfigFile } from "@uns-kit/core";
import UnsMqttProxy from "@uns-kit/core/dist/uns-mqtt/uns-mqtt-proxy";
import { logger } from "@uns-kit/core";


/**
 * This script initializes an MQTT output proxy for load testing purposes.
 * It sets up a connection to the specified MQTT broker and configures
 * a proxy instance. The load test is designed to evaluate the performance
 * and reliability of the MQTT broker under simulated load conditions.
 */
async function main() {
  try {
    const config = await ConfigFile.loadConfig();
    const outputHost = (config.output?.host)!;

    const mqttOutput = new UnsMqttProxy(
      outputHost,
      "loadTest",
      "templateUnsRttLoadTest",
      { publishThrottlingDelay: 0 },
      true
    );

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    rl.question(`Would you like to continue with load-test on ${outputHost}? (Y/n) `, async (answer) => {
      if (answer.toLowerCase() === "y" || answer.trim() === "") {
        rl.question("How many iterations should be run? (default is 100) ", async (iterations) => {
          const maxIntervals = parseInt(iterations) || 100;

          rl.question("What should be the delay between intervals in milliseconds? (default is 0 ms) ", async (intervalDelay) => {
            const delay = parseInt(intervalDelay) || 0;

            logger.info(`Starting load test with ${maxIntervals} messages and ${delay} ms delay...`);

            let count = 0;
            const startTime = Date.now();

            while (count < maxIntervals) {
              try {
                const currentDate = new Date();
                const rawData = `${count},${currentDate.getTime()}`;
                await mqttOutput.publishMessage("raw/data", rawData);
              } catch (error) {
                logger.error("Error publishing message:", error.message);
              }

              count++;
              if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }

            logger.info(`Sleeping for 50ms.`);
            await new Promise((resolve) => setTimeout(resolve, 50));

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            const messagesPerSecond = maxIntervals / duration;

            logger.info(`Load test completed in ${duration.toFixed(2)} seconds.`);
            logger.info(`Message rate: ${messagesPerSecond.toFixed(2)} msg/s.`);

            rl.close();
            process.exit(0);
          });
        });
      } else {
        logger.info("Load test aborted.");
        rl.close();
        process.exit(0);
      }
    });
  } catch (error) {
    logger.error("Error initializing load test:", error.message);
    process.exit(1);
  }
}

main();
