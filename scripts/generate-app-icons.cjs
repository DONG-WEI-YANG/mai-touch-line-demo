const path = require("node:path");

const sharp = require("sharp");

const imageDirectory = path.resolve(__dirname, "..", "assets", "images");
const master = path.join(imageDirectory, "app-icon-master.png");

const outputs = [
  { name: "favicon.png", size: 64 },
  { name: "app-icon.png", size: 1024 },
  { name: "adaptive-icon.png", size: 1024 },
];

Promise.all(
  outputs.map(({ name, size }) =>
    sharp(master)
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(imageDirectory, name)),
  ),
).then(() => {
  console.log(`Generated ${outputs.length} app icon assets from app-icon-master.png`);
}).catch((error) => {
  console.error("App icon generation failed", error);
  process.exitCode = 1;
});
