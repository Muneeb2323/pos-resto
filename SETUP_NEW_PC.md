# Installing FORK & FIRE POS on a new PC

Everything needed is in this folder.

- If you were handed the **whole folder**, including `node_modules`, `.next` and `data`,
  use **Option A**. It is the short one.
- If those folders are missing (the folder came from `npm run package`), use **Option B**.

---

## Option A - the folder was copied whole

Nothing to build, nothing to download.

1. **Install Node.js 20 or newer** from [nodejs.org](https://nodejs.org). Python is not
   needed. PostgreSQL is not needed - a copy is bundled in `pgsql/`.
2. Put this folder anywhere on the PC. The drive letter and path do not matter.
3. Double-click **`START_FORK_AND_FIRE.bat`**.

That starts the database, starts the POS and opens the browser at
**http://localhost:3000**.

Two things to do afterwards:

- **Set the printer.** Settings -> Printer & Receipts -> *Printer Name* must match the
  thermal printer's name in Windows exactly. Nothing prints until it does.
- **Give this PC its own login key.** Open `.env` and replace `JWT_SECRET` with a fresh
  value, so the two installations do not share one:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
  Set `ADMIN_PASSWORD` to the password this restaurant should use, then run
  `npm run admin:reset`. Everyone signed in on this PC will need to sign in again.

> **The one rule when copying:** shut the POS down first, with
> `STOP_FORK_AND_FIRE.bat`. The `data/` folder is a live database, and copying it while
> it is running produces a database that will not open on the other machine.

Also worth knowing: `node_modules` contains Windows 64-bit programs, so a folder copied
this way runs on Windows x64 only. For anything else, use Option B.

---

## Option B - a packaged folder, or a fresh install

### What the PC needs

| | |
| :--- | :--- |
| **Windows** | 10 or 11, 64-bit |
| **Node.js** | version 20 or newer — [nodejs.org](https://nodejs.org) |
| **Python** | **not needed** |
| **PostgreSQL** | **not needed** — a copy is bundled in `pgsql/` |
| **Internet** | only for `npm install`, once. The POS itself never needs it. |
| **Disk space** | about 3 GB once installed |

Nothing is installed into Windows itself. The whole system lives in this folder, and
deleting the folder removes it.

---

### Setup steps

Open a terminal **in this folder** (Shift + right-click → *Open PowerShell window here*)
and run these in order.

#### 1. Set the two required values

Open `.env` in Notepad.

- **`JWT_SECRET`** — already filled in with a key unique to this installation. Leave it.
  If it is empty, create one by running this and pasting the result between the quotes:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- **`ADMIN_PASSWORD`** — set this to the password the manager will log in with.

Save and close.

#### 2. Install and start

```bash
npm install                      # once, needs internet
npm run db:init                  # creates the database  (skip if data/ came with the folder)
npm run prisma:migrate:deploy    # creates the tables
npm run prisma:seed              # loads the menu        (skip if data/ came with the folder)
npm run build
npm run start
```

Open **http://localhost:3000** and log in with `admin` and the password from step 1.

#### 3. Make it easy to launch

```bash
npm run shortcut
```

This puts a **FORK & FIRE POS** icon on the desktop. From then on, double-clicking it
starts the database, the POS and the browser together. `STOP_FORK_AND_FIRE.bat` shuts
everything down.

---

## After setup

**Printer.** Go to **Settings → Printer & Receipts** and set *Printer Name* to exactly
the name the thermal printer has in Windows (*Settings → Bluetooth & devices → Printers &
scanners*). Nothing prints until this matches.

**Restaurant details.** Under **Settings → General**, set the name, address and tax rate.
Under **Printer & Receipts**, set the online payment accounts that appear on customer
bills — the ones in there belong to the previous installation.

**Menu.** If the menu did not come with the folder, either run `npm run prisma:seed` for
the standard menu, or take a backup file from the old PC
(**Settings → Backup → Download Full Backup Archive**) and restore it here. The backup
carries the menu, deals, prices, tables and staff, but not past orders.

**Staff.** Add waiters and riders under **Settings**, and staff logins under the same
screen. Give cashiers the *Cashier* role — it keeps them out of reports and settings.

---

## Using it from a tablet or second till

The POS serves the whole local network.

1. On the main PC run `ipconfig` and note the IPv4 address, e.g. `192.168.1.100`.
2. Start with `npm run start -- -H 0.0.0.0 -p 3000`.
3. Allow inbound TCP port 3000 through Windows Firewall.
4. On the tablet, open `http://192.168.1.100:3000`.

Every device still has to sign in.

---

## If something goes wrong

**"Database unreachable" in the sidebar**
Run `npm run db:start`. If that fails, another PostgreSQL may already own port 5432 —
change the port in `.env` (`DATABASE_URL`) and run `npm run db:init` again.

**"JWT_SECRET is not set"**
Step 1 was skipped. The POS refuses to run on a shared default key.

**`npm install` fails**
The PC has no internet, or Node.js is older than 20. Check with `node -v`.

**Nothing prints**
The printer name in Settings does not match Windows exactly. Check spelling and spaces.

**Forgotten admin password**
Set `ADMIN_PASSWORD` in `.env`, then run `npm run admin:reset`.

**Port 3000 already in use**
`npm run start -- -p 3001`, then use `http://localhost:3001`.

---

## Moving it again later

From the source PC:

```bash
node scripts/package-for-handover.js E:\ForkAndFire
```

This copies everything needed, leaves out the things that must not travel, and writes a
fresh `.env` with a new signing key. Add `--with-history` to take the database along
(stop the POS first), or `--with-modules` if the destination PC has no internet.

---

## Backups

**Settings → Backup → Download Full Backup Archive** writes a single `.json` file. Keep
it on a USB stick. It holds the menu, deals, prices, tables, staff, customers, settings
and the full order history.

Do this weekly. A copy of the `data/` folder is *not* a backup unless the POS was
stopped first.
