const { spawn } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");

function checkPort(port, callback) {
  const socket = new net.Socket();
  socket.setTimeout(1000);
  socket.on("connect", () => {
    socket.destroy();
    callback(true);
  });
  socket.on("timeout", () => {
    socket.destroy();
    callback(false);
  });
  socket.on("error", () => {
    callback(false);
  });
  socket.connect(port, "127.0.0.1");
}

checkPort(5432, (isRunning) => {
  if (isRunning) {
    console.log("✓ PostgreSQL is already running on port 5432");
    process.exit(0);
  }

  const dataDir = path.join(__dirname, "..", "data");
  const pidFile = path.join(dataDir, "postmaster.pid");

  // If port 5432 is not running, but a postmaster.pid file exists, it's stale from a crash/restart
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      console.log("✓ Removed stale postmaster.pid");
    } catch (e) {
      console.warn("Could not remove postmaster.pid:", e.message);
    }
  }

  const pgCtl = path.join(__dirname, "..", "pgsql", "bin", "pg_ctl.exe");
  const logFile = path.join(dataDir, "server.log");

  console.log("🔥 Starting local PostgreSQL daemon with pg_ctl...");
  try {
    const { execSync } = require("child_process");
    execSync(`"${pgCtl}" -D "${dataDir}" -l "${logFile}" start`, { stdio: "ignore" });
  } catch (err) {
    console.warn("pg_ctl start warning:", err.message);
  }

  setTimeout(() => {
    checkPort(5432, (connected) => {
      if (connected) {
        console.log("✓ PostgreSQL server started on port 5432 successfully!");
      } else {
        console.log("PostgreSQL starting in background...");
      }
      process.exit(0);
    });
  }, 2000);
});
