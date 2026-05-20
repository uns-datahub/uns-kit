import { ConfigFile } from "@uns-kit/core";
import { registerDatabase } from "@uns-kit/database";

const config = await ConfigFile.loadConfig();

registerDatabase("mainPg", config.databases.mainPg);
registerDatabase("reportingPg", config.databases.reportingPg);
registerDatabase("mesOracle", config.databases.mesOracle);
