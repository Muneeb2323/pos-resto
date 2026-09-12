/**
 * Package this POS installation for another machine.
 *
 * Copying the folder by hand has three traps this script avoids:
 *
 *   1. `data/` is a live PostgreSQL cluster. Copied while the server is running it is
 *      corrupt, and the other machine gets a database that will not start.
 *   2. `.next/` records the absolute path it was built in, so a build made in D:\pos
 *      misbehaves from C:\Users\Someone\pos. It is skipped and rebuilt there.
 *   3. `.env` holds this installation's session key and admin password. A fresh one is
 *      written with a newly generated key, so two restaurants never share a secret.
 *
 * Usage:
 *   node scripts/package-for-handover.js <destination> [options]
 *
 * Options:
 *   --with-history      include the database as it is now (menu AND past orders)
 *   --with-modules      include node_modules, for a target PC with no internet
 *                       (Windows x64 only - the build has native binaries)
 *
 * Default: menu and settings travel via a backup file you export from Settings; the
 * target starts with no trading history, which is what a different restaurant wants.
 */
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const destination = args.find((a) => !a.startsWith("--"));
const withHistory = args.includes("--with-history");
const withModules = args.includes("--with-modules");

/** Top-level entries never copied. */
const ALWAYS_SKIP = new Set([
  ".next", // rebuilt on the target; records its build path
  ".git",
  ".vscode",
  "node_modules", // opt in with --with-modules
  "data", // opt in with --with-history
  ".env", // regenerated below
  "pg_logfile.log",
  "START_FORK_AND_FIRE.exe", // recompiled by the launcher on first run
  "logo.ico", // regenerated from public/logo.PNG
]);

function fail(message) {
  console.error("\n" + message + "\n");
  process.exit(1);
}

function isPostgresRunning() {
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
    socket.on("error", () => resolve(false));
    socket.connect(5432, "127.0.0.1");
  });
}

function directorySize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += directorySize(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

function human(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return value.toFixed(1) + " " + units[unit];
}

let copiedFiles = 0;

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyTree(source, target);
    } else if (entry.isFile()) {
      fs.copyFileSync(source, target);
      copiedFiles += 1;
      if (copiedFiles % 2000 === 0) {
        process.stdout.write("  copied " + copiedFiles + " files...\r");
      }
    }
  }
}

function writeFreshEnv(targetRoot) {
  const examplePath = path.join(projectRoot, ".env.example");
  const template = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, "utf8") : "";

  const secret = crypto.randomBytes(48).toString("base64url");
  const content = template
    .replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET="' + secret + '"')
    .replace(/^ADMIN_PASSWORD=.*$/m, 'ADMIN_PASSWORD=""');

  fs.writeFileSync(path.join(targetRoot, ".env"), content, "utf8");
  return secret;
}

async function main() {
  if (!destination) {
    fail(
      "Where should the package go?\n\n" +
        "  node scripts/package-for-handover.js E:\\ForkAndFire\n" +
        "  node scripts/package-for-handover.js E:\\ForkAndFire --with-history"
    );
  }

  const targetRoot = path.resolve(destination);

  if (targetRoot === projectRoot || targetRoot.startsWith(projectRoot + path.sep)) {
    fail("Choose a destination outside the POS folder itself.");
  }
  if (fs.existsSync(targetRoot) && fs.readdirSync(targetRoot).length > 0) {
    fail(targetRoot + " already exists and is not empty. Choose an empty folder.");
  }

  const running = await isPostgresRunning();
  if (withHistory && running) {
    fail(
      "PostgreSQL is still running, so copying data/ would produce a corrupt database.\n" +
        "Stop it first (STOP_FORK_AND_FIRE.bat), then run this again."
    );
  }

  const skip = new Set(ALWAYS_SKIP);
  if (withHistory) skip.delete("data");
  if (withModules) skip.delete("node_modules");

  console.log("\nPackaging Fork & Fire POS");
  console.log("  from: " + projectRoot);
  console.log("  to:   " + targetRoot);
  console.log("  database:     " + (withHistory ? "included (menu AND past orders)" : "not included"));
  console.log("  node_modules: " + (withModules ? "included (Windows x64 only)" : "not included"));
  console.log("");

  fs.mkdirSync(targetRoot, { recursive: true });

  for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;

    const source = path.join(projectRoot, entry.name);
    const target = path.join(targetRoot, entry.name);

    if (entry.isDirectory()) {
      process.stdout.write("  " + entry.name + "/ ... ");
      copyTree(source, target);
      process.stdout.write("done\n");
    } else if (entry.isFile()) {
      fs.copyFileSync(source, target);
      copiedFiles += 1;
    }
  }

  writeFreshEnv(targetRoot);

  const size = directorySize(targetRoot);

  console.log("\nPackaged " + copiedFiles + " files (" + human(size) + ").");
  console.log("\nA fresh .env was written with a newly generated JWT_SECRET.");
  console.log("Your own session key and admin password were NOT copied.\n");

  const steps = [
    "Install Node.js 20 or newer.  (Python is NOT needed.)",
    "Copy this folder anywhere on the machine.",
    "Open .env and set ADMIN_PASSWORD to the password they should log in with.",
  ];

  if (!withModules) {
    steps.push("npm install                     (needs internet, once)");
  }

  // `db:start` only starts an existing cluster; a package without data/ has none yet.
  steps.push(withHistory ? "npm run db:start" : "npm run db:init");
  steps.push("npm run prisma:migrate:deploy");
  if (!withHistory) {
    steps.push("npm run prisma:seed             (or restore your backup from Settings)");
  }
  steps.push("npm run build");
  steps.push("npm run start");
  steps.push("npm run shortcut                (desktop icon, optional)");

  console.log("On the other PC:");
  steps.forEach((step, index) => {
    console.log("  " + String(index + 1).padStart(2) + ". " + step);
  });

  console.log("\n  Then open http://localhost:3000 and set Settings > Printer & Receipts.\n");
  console.log("Full checklist: SETUP_NEW_PC.md in the package.\n");
}

main().catch((error) => {
  console.error("\nPackaging failed:", error.message);
  process.exitCode = 1;
});
