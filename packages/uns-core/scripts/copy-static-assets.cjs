const fs = require("fs");
const path = require("path");

const protoSource = path.resolve("src/uns-grpc/uns-gateway.proto");
const protoDest = path.resolve("dist/uns-grpc/uns-gateway.proto");

if (!fs.existsSync(protoSource)) {
  console.error(`Cannot find ${protoSource}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(protoDest), { recursive: true });
fs.copyFileSync(protoSource, protoDest);

console.log(`Copied uns-gateway.proto -> ${protoDest}`);
