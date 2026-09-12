/**
 * Creates the "FORK & FIRE POS" desktop shortcut.
 *
 * Paths are derived from where this script actually lives, so the shortcut is correct
 * on whatever machine and folder the POS is installed in.
 *
 * Usage: npm run shortcut
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

// Prefer the compiled launcher; fall back to the batch file, which always exists.
const exeLauncher = path.join(projectRoot, "START_FORK_AND_FIRE.exe");
const batLauncher = path.join(projectRoot, "START_FORK_AND_FIRE.bat");
const target = fs.existsSync(exeLauncher) ? exeLauncher : batLauncher;

if (!fs.existsSync(target)) {
  console.error("Could not find a launcher in " + projectRoot + " - is this the POS folder?");
  process.exit(1);
}

const iconPath = path.join(projectRoot, "public", "logo.ico");

/** Escape a Windows path for embedding in a VBScript string literal. */
function vbs(value) {
  return value.replace(/"/g, '""');
}

const lines = [
  'Set oWS = WScript.CreateObject("WScript.Shell")',
  'sLinkFile = oWS.SpecialFolders("Desktop") & "\\FORK & FIRE POS.lnk"',
  "Set oLink = oWS.CreateShortcut(sLinkFile)",
  'oLink.TargetPath = "' + vbs(target) + '"',
  'oLink.WorkingDirectory = "' + vbs(projectRoot) + '"',
  'oLink.Description = "Fork & Fire Restaurant POS System"',
];

if (fs.existsSync(iconPath)) {
  lines.push('oLink.IconLocation = "' + vbs(iconPath) + '"');
}

lines.push("oLink.Save");

const tempVbs = path.join(__dirname, "temp-shortcut.vbs");

try {
  fs.writeFileSync(tempVbs, lines.join("\r\n"), "utf8");
  execSync('cscript //nologo "' + tempVbs + '"');
  console.log("Desktop shortcut created, pointing at:");
  console.log("  " + target);
} catch (error) {
  console.error("Could not create the shortcut:", error.message);
  process.exitCode = 1;
} finally {
  try {
    fs.unlinkSync(tempVbs);
  } catch {
    // Nothing to clean up.
  }
}
