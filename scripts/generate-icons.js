const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(process.cwd(), "public", "icons");
const logoPath = path.join(process.cwd(), "public", "logo.png");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

if (!fs.existsSync(logoPath)) {
  console.error("Missing public/logo.png — copy your logo there and run again.");
  process.exit(1);
}

Promise.all(
  sizes.map((size) =>
    sharp(logoPath)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}x${size}.png`))
      .then(() => console.log(`✓ icon-${size}x${size}.png`))
      .catch((err) => console.error(`✗ ${size}:`, err))
  )
).then(() => console.log("Done."));
