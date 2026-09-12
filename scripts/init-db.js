/**
 * Create the local PostgreSQL cluster and database on a fresh machine.
 *
 * `npm run db:start` only starts an existing cluster. On a new PC there is no `data/`
 * directory at all, so this runs initdb first, then creates the database named in
 * DATABASE_URL. Safe to run twice: it skips whatever already exists.
 *
 * Usage: npm run db:init
 */
// Load .env if dotenv is available; environment variables already set win either way.
try {
  require("dotenv/config");
} catch {
  // Running before `npm install` - rely on the ambient environment.
}

const { execFileSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const binDir = path.join(projectRoot, "pgsql", "bin");

const initdb = path.join(binDir, "initdb.exe");
const pgCtl = path.join(binDir, "pg_ctl.exe");
const psql = path.join(binDir, "psql.exe");

function parseDatabaseUrl(url) {
  if (!url) {
    throw new Error("DATABASE_URL is not set in .env");
  }
  const parsed = new URL(url);
  return {
    user: decodeURIComponent(parsed.username || "postgres"),
    password: decodeURIComponent(parsed.password || "postgres"),
    host: parsed.hostname || "localhost",
    port: parsed.port || "5432",
    database: parsed.pathname.replace(/^\//, "") || "fork_and_fire",
  };
}

function waitForPort(port, attempts = 30) {
  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      const socket = new net.Socket();
      socket.setTimeout(700);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      const retry = () => {
        socket.destroy();
        tries += 1;
        if (tries >= attempts) return resolve(false);
        setTimeout(attempt, 500);
      };
      socket.on("timeout", retry);
      socket.on("error", retry);
      socket.connect(port, "127.0.0.1");
    };
    attempt();
  });
}

async function main() {
  const db = parseDatabaseUrl(process.env.DATABASE_URL);

  for (const tool of [initdb, pgCtl, psql]) {
    if (!fs.existsSync(tool)) {
      throw new Error(
        "Missing " + path.basename(tool) + " - the bundled PostgreSQL in pgsql/ is incomplete."
      );
    }
  }

  // 1. Create the cluster if there is not one already.
  const alreadyInitialised = fs.existsSync(path.join(dataDir, "PG_VERSION"));

  if (alreadyInitialised) {
    console.log("Database cluster already exists in data/ - leaving it alone.");
  } else {
    console.log("Creating a new PostgreSQL cluster in data/ ...");
    fs.mkdirSync(dataDir, { recursive: true });

    // initdb reads the superuser password from a file rather than the command line,
    // so it never appears in the process list.
    const pwFile = path.join(os.tmpdir(), "ff-initdb-" + Date.now() + ".txt");
    fs.writeFileSync(pwFile, db.password, "utf8");

    try {
      execFileSync(
        initdb,
        [
          "-D", dataDir,
          "-U", db.user,
          "--pwfile=" + pwFile,
          "-E", "UTF8",
          "--auth-local=trust",
          "--auth-host=scram-sha-256",
        ],
        { stdio: "inherit" }
      );
    } finally {
      try {
        fs.unlinkSync(pwFile);
      } catch {
        // best effort
      }
    }
    console.log("Cluster created.");
  }

  // 2. Start the server if it is not already listening.
  const logFile = path.join(dataDir, "server.log");
  const running = await waitForPort(Number(db.port), 1);

  if (running) {
    console.log("PostgreSQL is already running on port " + db.port + ".");
  } else {
    const stalePid = path.join(dataDir, "postmaster.pid");
    if (fs.existsSync(stalePid)) {
      try {
        fs.unlinkSync(stalePid);
      } catch {
        // best effort
      }
    }

    console.log("Starting PostgreSQL ...");
    execFileSync(pgCtl, ["-D", dataDir, "-l", logFile, "-o", "-p " + db.port, "start"], {
      stdio: "ignore",
    });

    if (!(await waitForPort(Number(db.port)))) {
      throw new Error("PostgreSQL did not start. Check " + logFile);
    }
    console.log("PostgreSQL running on port " + db.port + ".");
  }

  // 3. Create the application database if it does not exist.
  const env = { ...process.env, PGPASSWORD: db.password };
  const psqlArgs = ["-U", db.user, "-h", "127.0.0.1", "-p", db.port, "-d", "postgres", "-tAc"];

  const exists = execFileSync(
    psql,
    [...psqlArgs, "SELECT 1 FROM pg_database WHERE datname = '" + db.database + "'"],
    { env, encoding: "utf8" }
  ).trim();

  if (exists === "1") {
    console.log('Database "' + db.database + '" already exists.');
  } else {
    execFileSync(psql, [...psqlArgs, 'CREATE DATABASE "' + db.database + '"'], {
      env,
      stdio: "inherit",
    });
    console.log('Created database "' + db.database + '".');
  }

  console.log("\nNext:");
  console.log("  npm run prisma:migrate:deploy");
  console.log("  npm run prisma:seed");
}

main().catch((error) => {
  console.error("\nDatabase setup failed:", error.message);
  process.exitCode = 1;
});
