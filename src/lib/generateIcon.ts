import fs from "fs";
import path from "path";

/**
 * Derive the Windows .ico files from public/logo.PNG.
 *
 * Runs at most once per server process: /api/status is polled every 10 seconds and
 * there is no reason to rewrite the favicon each time.
 */
let logoAssetsEnsured = false;

export function ensureLogoAssets() {
  if (logoAssetsEnsured) return;
  logoAssetsEnsured = true;

  try {
    const rootDir = process.cwd();
    const publicDir = path.join(rootDir, "public");
    const logoPngPath = path.join(publicDir, "logo.PNG");
    const logoPngLowerPath = path.join(publicDir, "logo.png");
    const logoIcoPath = path.join(publicDir, "logo.ico");
    const rootIcoPath = path.join(rootDir, "logo.ico");
    const appFaviconPath = path.join(rootDir, "src", "app", "favicon.ico");

    if (!fs.existsSync(logoPngPath)) {
      return;
    }

    const pngData = fs.readFileSync(logoPngPath);

    // Ensure lowercase logo.png exists
    if (!fs.existsSync(logoPngLowerPath)) {
      try {
        fs.writeFileSync(logoPngLowerPath, pngData);
      } catch {}
    }

    // Build valid Windows ICO containing the PNG stream
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = ICO
    header.writeUInt16LE(1, 4); // 1 Image

    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0); // Width 256
    entry.writeUInt8(0, 1); // Height 256
    entry.writeUInt8(0, 2); // Colors 0
    entry.writeUInt8(0, 3); // Reserved 0
    entry.writeUInt16LE(1, 4); // Planes 1
    entry.writeUInt16LE(32, 6); // Bits per pixel 32
    entry.writeUInt32LE(pngData.length, 8); // Image size in bytes
    entry.writeUInt32LE(22, 12); // Offset = 6 + 16 = 22

    const icoBuffer = Buffer.concat([header, entry, pngData]);

    if (!fs.existsSync(logoIcoPath)) {
      fs.writeFileSync(logoIcoPath, icoBuffer);
    }
    if (!fs.existsSync(rootIcoPath)) {
      fs.writeFileSync(rootIcoPath, icoBuffer);
    }
    // Only rewrite the app favicon when it differs, to avoid touching a file the
    // dev server watches on every boot.
    if (!fs.existsSync(appFaviconPath) || !fs.readFileSync(appFaviconPath).equals(icoBuffer)) {
      fs.writeFileSync(appFaviconPath, icoBuffer);
    }
  } catch (err) {
    console.error("Failed to generate logo ICO assets:", err);
  }
}
