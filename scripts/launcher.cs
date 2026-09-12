using System;
using System.Diagnostics;
using System.IO;

namespace ForkAndFireLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "FORK & FIRE - RESTAURANT POS SYSTEM";
            Console.ForegroundColor = ConsoleColor.DarkYellow;
            Console.WriteLine("========================================================");
            Console.WriteLine("  FORK & FIRE - RESTAURANT POS SYSTEM LAUNCHER");
            Console.WriteLine("========================================================");
            Console.ResetColor();

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string startScript = Path.Combine(baseDir, "scripts", "start-all.js");

            if (!File.Exists(startScript))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("ERROR: Could not locate scripts\\start-all.js in: " + baseDir);
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "node.exe",
                    Arguments = "\"" + startScript + "\"",
                    WorkingDirectory = baseDir,
                    UseShellExecute = false
                };

                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    proc.WaitForExit();
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Error launching system: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("\nPress any key to exit...");
                Console.ReadKey();
            }
        }
    }
}
