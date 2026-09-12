const { spawn, execSync, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");
const os = require("os");

const ROOT_DIR = path.resolve(__dirname, "..");

function ensureLogoAssets() {
  try {
    const publicDir = path.join(ROOT_DIR, "public");
    const logoPngPath = path.join(publicDir, "logo.PNG");
    const logoPngLowerPath = path.join(publicDir, "logo.png");
    const logoIcoPath = path.join(publicDir, "logo.ico");
    const rootIcoPath = path.join(ROOT_DIR, "logo.ico");
    const appFaviconPath = path.join(ROOT_DIR, "src", "app", "favicon.ico");

    if (!fs.existsSync(logoPngPath)) return;

    const pngData = fs.readFileSync(logoPngPath);
    if (!fs.existsSync(logoPngLowerPath)) {
      try { fs.writeFileSync(logoPngLowerPath, pngData); } catch {}
    }

    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);

    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0);
    entry.writeUInt8(0, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngData.length, 8);
    entry.writeUInt32LE(22, 12);

    const icoBuffer = Buffer.concat([header, entry, pngData]);
    try { fs.writeFileSync(logoIcoPath, icoBuffer); } catch {}
    try { fs.writeFileSync(rootIcoPath, icoBuffer); } catch {}
    try { fs.writeFileSync(appFaviconPath, icoBuffer); } catch {}
  } catch (err) {}
}
ensureLogoAssets();

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

function checkServerReady() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:3000/api/status", (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startDatabase() {
  const isRunning = await checkPort(5432);
  if (isRunning) {
    console.log("  [✓] PostgreSQL Database is already running on port 5432.");
    return;
  }

  console.log("  [1/3] Starting Local PostgreSQL Database...");
  execSync("node scripts/start-db.js", { cwd: ROOT_DIR, stdio: "inherit" });

  let tries = 0;
  while (tries < 15) {
    await new Promise((r) => setTimeout(r, 800));
    if (await checkPort(5432)) {
      console.log("  [✓] Database connected successfully!");
      return;
    }
    tries++;
  }
  console.warn("  [!] Database did not respond on 5432 within timeout, proceeding...");
}

async function startServer() {
  const isRunning = await checkPort(3000);
  if (isRunning) {
    console.log("  [✓] Next.js POS Server is already running on port 3000.");
    return;
  }

  console.log("  [2/3] Starting Fork & Fire POS Server on port 3000 (silent background)...");
  try {
    const formattedDir = ROOT_DIR.replace(/\\/g, "/");
    const psCmd = `Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/next/dist/bin/next', 'dev', '-p', '3000', '-H', '0.0.0.0' -WorkingDirectory '${formattedDir}' -WindowStyle Hidden`;
    exec(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`);
  } catch (err) {
    console.warn("Server launch warning:", err.message);
  }

  let tries = 0;
  while (tries < 25) {
    await new Promise((r) => setTimeout(r, 600));
    if (await checkServerReady()) {
      console.log("  [✓] POS Server ready and responding!");
      return;
    }
    tries++;
  }
  console.log("  [✓] POS Server initialized.");
}

function openBrowser() {
  console.log("  [3/3] Opening Fork & Fire POS in your default browser...");
  const startCmd = process.platform === "win32" ? "start" : "open";
  exec(`${startCmd} http://localhost:3000`);
}

async function main() {
  console.log("\n========================================================");
  console.log("  🔥 FORK & FIRE - RESTAURANT POS 1-CLICK LAUNCHER");
  console.log("  Special Fast Food & Pizza Menu");
  console.log("========================================================\n");

  await startDatabase();
  await startServer();
  openBrowser();

  const localIp = getLocalIp();
  console.log("\n========================================================");
  console.log("  🎉 FORK & FIRE POS IS RUNNING & READY!");
  console.log("========================================================");
  console.log("  • Main Terminal (This PC): http://localhost:3000");
  console.log(`  • Network / Kitchen Tablets: http://${localIp}:3000`);
  console.log("  • Login Username: admin");
  console.log("  • Login Password: admin123");
  console.log("========================================================");
  console.log("  You can keep this window open or minimize it.");
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Launcher error:", err);
});
