/**
 * Raw print endpoint.
 *
 * Sends ESC/POS bytes straight to the Windows spooler via winspool.drv, bypassing the
 * GDI rendering pipeline that `window.print()` uses. The queue name comes from
 * restaurant settings, so changing printer is configuration rather than a code change.
 */
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import prisma from "@/lib/db/prisma";
import { requireModule, routeError } from "@/lib/auth/guard";
import { formatOrderReceipt, formatCustomerBill, formatKitchenTicket } from "@/lib/escpos";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const PRINT_TIMEOUT_MS = 15_000;

type PrintType = "receipt" | "bill" | "kot";

const PRINT_TYPES: readonly PrintType[] = ["receipt", "bill", "kot"];

// PowerShell + C# interop that hands raw bytes to the spooler. `$$` is used for
// PowerShell's own sigil so it survives this template literal, and is restored below.
const RAW_PRINT_SCRIPT = `
param([string]$PrinterName, [string]$FilePath)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendFileToPrinter(string szPrinterName, string szFilePath) {
        byte[] bytes = System.IO.File.ReadAllBytes(szFilePath);
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "POS Receipt";
        di.pDataType = "RAW";

        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            Console.Error.WriteLine("Could not open printer: " + szPrinterName);
            return false;
        }
        if (!StartDocPrinter(hPrinter, 1, ref di)) {
            Console.Error.WriteLine("Could not start print job");
            ClosePrinter(hPrinter);
            return false;
        }
        if (!StartPagePrinter(hPrinter)) {
            Console.Error.WriteLine("Could not start page");
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return false;
        }

        IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pBytes, bytes.Length);
        int dwWritten;
        bool result = WritePrinter(hPrinter, pBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pBytes);

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        if (result) {
            Console.WriteLine("SUCCESS: Sent " + dwWritten + " bytes to printer");
        } else {
            Console.Error.WriteLine("WritePrinter failed");
        }
        return result;
    }
}
"@

try {
    $$result = [RawPrinterHelper]::SendFileToPrinter($$PrinterName, $$FilePath)
    if ($$result) {
        Write-Output "PRINT_OK"
    } else {
        Write-Error "PRINT_FAILED"
        exit 1
    }
} catch {
    Write-Error $$_.Exception.Message
    exit 1
}
`.replace(/\$\$/g, "$");

export async function POST(request: NextRequest) {
  // Printing a bill or kitchen ticket is POS work, so anyone who can take an order
  // may print one - but an anonymous caller may not drive the restaurant's printer.
  const guard = await requireModule("pos");
  if (!guard.ok) return guard.response;

  let workDir: string | null = null;

  try {
    const { type, order } = (await request.json()) ?? {};

    if (!order) {
      return NextResponse.json({ success: false, error: "No order data" }, { status: 400 });
    }
    if (typeof type !== "string" || !PRINT_TYPES.includes(type as PrintType)) {
      return NextResponse.json(
        { success: false, error: "Unknown print type: " + String(type) },
        { status: 400 }
      );
    }

    const settings = await prisma.restaurantSettings.findUnique({ where: { id: "singleton" } });
    const printerName = settings?.printerName?.trim();
    if (!printerName) {
      return NextResponse.json(
        { success: false, error: "No printer configured. Set one under Settings > Printer." },
        { status: 400 }
      );
    }

    // The customer bill carries the restaurant's transfer accounts; the other two
    // do not, so only it is handed the settings.
    const escposData =
      type === "bill"
        ? formatCustomerBill(order, settings)
        : type === "kot"
          ? formatKitchenTicket(order)
          : formatOrderReceipt(order);

    // Both temp files live in one directory that is removed as a unit, so a failed
    // print cannot leave receipt contents behind in the system temp folder.
    workDir = await mkdtemp(join(tmpdir(), "fork-fire-print-"));
    const dataFile = join(workDir, "receipt.bin");
    const scriptFile = join(workDir, "raw-print.ps1");

    await Promise.all([
      writeFile(dataFile, Buffer.from(escposData, "binary")),
      writeFile(scriptFile, RAW_PRINT_SCRIPT, "utf8"),
    ]);

    // execFile with an argument array: the printer name is passed as a parameter, not
    // interpolated into a command line, so a name containing quotes cannot break out.
    const { stdout } = await execFileAsync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptFile,
        "-PrinterName",
        printerName,
        "-FilePath",
        dataFile,
      ],
      { timeout: PRINT_TIMEOUT_MS, encoding: "utf8", windowsHide: true }
    );

    return NextResponse.json({ success: true, message: stdout.trim() });
  } catch (error: unknown) {
    const detail =
      typeof error === "object" && error !== null && "stderr" in error
        ? String((error as { stderr?: string }).stderr || "").trim()
        : "";
    console.error("[print]", detail || error);

    return NextResponse.json(
      {
        success: false,
        error: detail || "Could not reach the printer. Check that it is switched on and connected.",
      },
      { status: 500 }
    );
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
