const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(process.cwd(), "public", "icons");
const publicDir = path.join(process.cwd(), "public");
const logoSource = path.join(publicDir, "logo-source.png");
const logoLegacy = path.join(publicDir, "logo.png");
const logoPath = fs.existsSync(logoSource) ? logoSource : logoLegacy;

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

if (!fs.existsSync(logoPath)) {
  console.error("Missing public/logo-source.png or public/logo.png — add your master logo and run again.");
  process.exit(1);
}

console.log("Using:", path.relative(process.cwd(), logoPath));

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
