# 🔥 FORK & FIRE — Restaurant POS System

A local-first Point of Sale, order management and reporting system for **FORK & FIRE**. It runs entirely on the restaurant's own machine and network — no cloud services, no internet dependency.

---

## 🚀 What it does today

- **POS terminal** (`/pos`) — three-column layout (categories, product grid, cart). One-click product entry, modifiers (extras and cooking options), barcode/SKU scan, touch and keyboard driven (F1–F8).
- **Order management** (`/orders`) — search and filter live and historical orders, settle unpaid bills, cancel, refund, reprint receipts and kitchen tickets.
- **Menu management** (`/menu`) — categories, products, prices, availability, and a builder for deals and option groups.
- **Floor plan** (`/tables`) — table list with live occupancy, driven by dine-in orders.
- **Dashboard and reports** (`/dashboard`, `/reports`) — takings, hourly and daily trend, best sellers, order-type and tender mix, per-cashier totals.
- **Settings** (`/settings`) — branding, tax rate, receipt text, online payment accounts, printer, waiter and rider rosters, audit log, backup and restore.
- **Thermal printing** — raw ESC/POS sent straight to the Windows spooler for 80mm receipt printers, bypassing browser print dialogs.
- **Server-authoritative pricing** — every total is recomputed on the server from the catalogue and the configured tax rate.
- **Frozen snapshot pricing** — historical orders keep the price and product name they were sold at, even after the menu changes.
- **Atomic transactions** — order, items, modifiers, kitchen ticket, table status, payment and register balance all commit together or not at all.
- **Local backup and restore** — one-click JSON archive to a USB stick or local drive.

> **Not built yet.** The sidebar and role matrix reserve space for a Kitchen Display System, customer CRM, cash register reconciliation and expense tracking. Those screens do not exist yet; the database tables behind the register and expenses are in place, the UI is not.

---

## 🛠 Technology

- **Framework** — Next.js 16 (App Router, React Compiler)
- **Language** — TypeScript, strict mode
- **Database** — PostgreSQL 16/17 + Prisma ORM, with versioned migrations
- **UI** — Tailwind CSS v4, Lucide icons, Framer Motion
- **Charts** — Recharts
- **Security** — bcrypt password hashing, signed HTTP-only JWT cookies, edge middleware plus per-route role guards
- **Tests** — Vitest unit suite, plus an end-to-end smoke test against a running server

---

## 📋 Requirements

- **Node.js** v20 or newer
- **PostgreSQL** 16 or 17
- **OS** Windows for thermal printing (the raw print path uses the Windows spooler); the rest runs anywhere

The `pgsql/` and `data/` directories hold a bundled portable PostgreSQL and its live cluster. They are **not** in version control — they are ~880 MB of binaries and live database files. Install PostgreSQL separately when setting up a new machine.

---

## ⚡ First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
```

Then edit `.env` and set the two required values:

```bash
# A unique signing key for login cookies - at least 32 characters.
# Generate one with:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- `JWT_SECRET` — paste the generated value. **The POS will refuse to sign anyone in without it**, rather than falling back to a default key that is public in this repository.
- `ADMIN_PASSWORD` — the password for the first administrator account.

```bash
# 3. Start PostgreSQL
npm run db:start

# 4. Create the schema and seed the menu
npm run prisma:migrate:deploy
npm run prisma:seed

# 5. Start the POS
npm run build
npm run start
```

Open **http://localhost:3000**. The first request creates the administrator account from `.env`.

---

## ⚡ 1-click startup (day to day)

Double-click **`START_FORK_AND_FIRE.bat`**, or the **FORK & FIRE POS** desktop shortcut. This starts PostgreSQL, starts the POS server, and opens the browser.

`STOP_FORK_AND_FIRE.bat` shuts both down.

---

## 👥 Accounts and roles

There are no pre-seeded demo logins. The first administrator is created from `.env`; further staff accounts are created from **Settings**.

| Role | Can reach |
| :--- | :--- |
| **Admin** | Everything, plus staff accounts, backup/restore and clearing trading history |
| **Manager** | Dashboard, POS, Orders (incl. cancel and refund), Menu, Tables, Reports, Settings, Audit log |
| **Cashier** | POS, Orders, Tables — no reports, no settings, no menu edits |
| **Kitchen** | Kitchen display only (screen not yet built) |

Roles are enforced in two places: edge middleware blocks pages a role may not load, and each API route declares its own requirement (see `src/lib/auth/guard.ts`). Neither alone is trusted.

### Changing the administrator password

Editing `.env` does not change an existing password by itself. Edit it, then run:

```bash
npm run admin:reset
```

---

## 🍕 Building a deal

A deal is an ordinary product whose choices are expressed as **option groups**. Both kinds are built from **Menu → Add Product**:

**A fixed bundle** — *Deal 5: 1 Chicken Sandwich + Fries + 5 Pcs Nuggets + 300ml drink, Rs. 550.*
Set the name, price and description, choose the **Special Deals** category, save. No option groups needed.

**A deal with choices** — *Deal 1: 1 large pizza + 1 litre drink, Rs. 1,499, customer picks the flavour.*

1. Name it, set the price to the deal price, choose **Special Deals**.
2. Under **Options & Choices**, click **Add Group**.
3. Name the group (`Select Pizza Flavour`), tick **Must choose**, leave Min and Max at 1.
4. Add one option per flavour. Leave the extra charge at 0 — the deal price already covers them.
5. Add a second group for the drink the same way.
6. For paid extras, add an optional group (untick **Must choose**, set Max to 2) and put the surcharge against each option — `Extra Cheese, 150`.

At the till the cashier is prompted for each required choice before the item joins the cart, and any surcharges are added on top of the deal price.

Editing a saved deal keeps the options that past orders point at, so history stays intact. An option you take off the menu still prints correctly on an old receipt, because each order line snapshots the name and price it was sold at.

**Removing a product** withdraws it from the menu if it has ever been sold, and deletes it outright only if it has not — so reports never lose a product they refer to.

### The rules the server enforces

Whatever the terminal sends, an order is rejected if it skips a required group, exceeds a group's maximum, falls short of its minimum, uses an option belonging to a different product, or uses one marked sold out.

---

## 💳 Online payment details on the bill

The **customer bill** (the unpaid, pre-payment invoice) carries the restaurant's transfer accounts, so a diner can send the money instead of queuing at the counter:

```
*** ONLINE PAYMENT ***
Jazzcash: 03216303563
Name: M.Abubakar zia
Easypaisa: 03057729767
Name: Tariq naseem
```

Edit them in **Settings → Printer & Receipts → Online Payment Details**, one detail per line. Add a bank account or remove a wallet simply by editing the text; clearing the box hides the section entirely.

These appear on the customer bill only. The **paid receipt** never shows them — by then the money has changed hands — and keeps the delivery contact line instead. The kitchen ticket carries neither.

---

## 🔒 How money is protected

The POS terminal computes totals locally so the cashier sees them instantly, but those figures are **advisory only**. On every order the server:

1. Reloads each product and modifier from the database and prices the order from scratch.
2. Reads the tax rate from restaurant settings, never from the request.
3. Rejects items that are off the menu, unavailable modifiers, modifiers belonging to another product, and selections that break a modifier group's own min/max rules.
4. Clamps the discount to the subtotal and rejects negative amounts.
5. Applies a delivery charge only to delivery orders.
6. Computes the change due itself, and refuses cash tendered below the amount due.
7. Records a `ORDER_CREATED_TOTAL_MISMATCH` audit entry if the terminal's total disagreed with its own.

All arithmetic runs in integer paisa (`src/lib/money.ts`), so summing a long order cannot drift the way floating-point addition does. Receipts print the exact amount charged — including paisa when there are any — so a printed total can never differ from the recorded sale.

---

## 🌐 Local network (LAN) setup

```
[Cashier Terminal]   --> http://192.168.1.100:3000/pos
[Manager Office PC]  --> http://192.168.1.100:3000/dashboard
            |
     [Local Network]
            |
 [Next.js host: 192.168.1.100:3000]
            |
   [Local PostgreSQL :5432]
```

1. Find the host machine's local IP with `ipconfig` (e.g. `192.168.1.100`).
2. Start with host binding: `npm run start -- -H 0.0.0.0 -p 3000`
3. Allow inbound TCP on port `3000` in Windows Firewall.
4. Other devices on the same network open `http://192.168.1.100:3000`.

Every device still has to sign in; the LAN is not treated as trusted.

---

## ⌨️ POS keyboard shortcuts

| Key | Action |
| :--- | :--- |
| **F1** | Go to the POS terminal |
| **F2** | Focus the search / barcode field |
| **F3** | Clear the cart and start a new order |
| **F5** | Send the current order to the kitchen |
| **ESC** | Close the active dialog |

---

## 💾 Backup and restore

1. Sign in as **Admin**.
2. **Settings → Local Backup & Restore → Download Full Backup Archive (.json)**.
3. To restore, choose a backup file and confirm.

The archive contains the menu, floor plan, staff roster, customers, settings **and** the full trading history.

Restoring replays the **menu and configuration only**. Trading history is deliberately not re-imported: merging old orders and payments into a till that is already trading would corrupt order numbering and double-count takings. The history stays readable in the archive for audit.

Every archive is validated field by field before a single row is written.

---

## 📦 npm scripts

| Script | What it does |
| :--- | :--- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run db:start` | Start the local PostgreSQL daemon |
| `npm run verify` | Typecheck, lint and unit tests — run before committing |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run smoke` | End-to-end checks against a running server |
| `npm run admin:reset` | Reset the admin password to the value in `.env` |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create a new migration from schema changes |
| `npm run prisma:migrate:deploy` | Apply pending migrations |
| `npm run prisma:seed` | Seed the catalogue |

---

## 🧪 Testing

```bash
npm run verify   # typecheck + lint + unit tests

npm run start    # in one terminal
npm run smoke    # in another - real HTTP against a real database
```

The unit suite (`tests/`) covers money arithmetic, order pricing and its validation rules, the role matrix, sign-in throttling, and receipt layout. The smoke test covers authentication, authorisation on every endpoint, server-side repricing of a tampered order, payment and change, and the confirmation required to clear trading history. It cleans up the orders it creates.

---

## 🗄 Database changes

The schema is managed with Prisma **migrations**, not `db push`. After editing `prisma/schema.prisma`:

```bash
npm run prisma:migrate -- --name describe_your_change
```

Never run `prisma db push` against the restaurant's live database — it will silently drop columns.

---

## 🔧 Troubleshooting

**"Database unreachable" in the sidebar**
Run `npm run db:start`, and check nothing else is holding port 5432.

**"JWT_SECRET is not set"**
Set it in `.env` (see First-time setup) and restart. This is intentional: the POS will not run on a shared default key.

**Locked out after too many wrong passwords**
Sign-in throttles after 8 failures from the same terminal for the same username. Wait five minutes, or restart the server to clear the counters.

**Forgotten admin password**
Set `ADMIN_PASSWORD` in `.env` and run `npm run admin:reset`.

**Nothing prints**
Check the queue name under **Settings → Printer** matches the printer's name in Windows exactly, and that it is switched on.

**Port 3000 in use**
`npm run start -- -p 3001`

**Reset to a clean database** (destroys all data)
```bash
npx prisma migrate reset
npm run prisma:seed
```
