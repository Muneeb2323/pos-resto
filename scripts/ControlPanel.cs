using System;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;

namespace ForkAndFireController
{
    public class ControlPanelForm : Form
    {
        private Label lblHeaderTitle;
        private Label lblHeaderSubtitle;
        private Panel panelStatus;
        private Label lblServerStatus;
        private Label lblDbStatus;
        private LinkLabel linkLocalUrl;
        private Label lblNetworkUrl;
        private Label lblMessage;

        private Button btnStart;
        private Button btnRestart;
        private Button btnStop;
        private Button btnQuit;

        private System.Windows.Forms.Timer statusTimer;
        private string baseDir;
        private bool isServerRunning = false;
        private bool isDbRunning = false;
        private bool isBusy = false;

        public ControlPanelForm()
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;
            InitializeComponent();
            CheckStatus();

            statusTimer = new System.Windows.Forms.Timer();
            statusTimer.Interval = 2500;
            statusTimer.Tick += (s, e) => CheckStatus();
            statusTimer.Start();
        }

        private void InitializeComponent()
        {
            this.Text = "FORK & FIRE - POS System Controller";
            this.Size = new Size(520, 520);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(16, 17, 22);
            this.ForeColor = Color.FromArgb(243, 244, 246);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            // 1. Header Banner
            Panel headerPanel = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(520, 75),
                BackColor = Color.FromArgb(22, 23, 30),
            };

            lblHeaderTitle = new Label
            {
                Text = "FORK & FIRE",
                Font = new Font("Segoe UI", 16F, FontStyle.Bold),
                ForeColor = Color.FromArgb(249, 115, 22),
                Location = new Point(20, 14),
                AutoSize = true
            };

            lblHeaderSubtitle = new Label
            {
                Text = "Restaurant POS System Controller • Offline Local Terminal",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Regular),
                ForeColor = Color.FromArgb(156, 163, 175),
                Location = new Point(22, 45),
                AutoSize = true
            };

            headerPanel.Controls.Add(lblHeaderTitle);
            headerPanel.Controls.Add(lblHeaderSubtitle);
            this.Controls.Add(headerPanel);

            // 2. Status Panel Box
            panelStatus = new Panel
            {
                Location = new Point(20, 90),
                Size = new Size(465, 125),
                BackColor = Color.FromArgb(24, 25, 34),
            };

            Label lblStatusBoxHeader = new Label
            {
                Text = "SYSTEM STATUS",
                Font = new Font("Segoe UI", 8F, FontStyle.Bold),
                ForeColor = Color.FromArgb(156, 163, 175),
                Location = new Point(15, 10),
                AutoSize = true
            };
            panelStatus.Controls.Add(lblStatusBoxHeader);

            lblServerStatus = new Label
            {
                Text = "● POS Web Server: Checking...",
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                ForeColor = Color.FromArgb(245, 158, 11),
                Location = new Point(15, 32),
                AutoSize = true
            };
            panelStatus.Controls.Add(lblServerStatus);

            lblDbStatus = new Label
            {
                Text = "● PostgreSQL Database: Checking...",
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                ForeColor = Color.FromArgb(245, 158, 11),
                Location = new Point(15, 54),
                AutoSize = true
            };
            panelStatus.Controls.Add(lblDbStatus);

            linkLocalUrl = new LinkLabel
            {
                Text = "Local POS URL: http://localhost:3000",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Regular),
                LinkColor = Color.FromArgb(96, 165, 250),
                ActiveLinkColor = Color.FromArgb(147, 197, 253),
                Location = new Point(15, 78),
                AutoSize = true
            };
            linkLocalUrl.LinkClicked += (s, e) => OpenWeb();
            panelStatus.Controls.Add(linkLocalUrl);

            string localIp = GetLocalIp();
            lblNetworkUrl = new Label
            {
                Text = "Network IP (Tablets/Phones): http://" + localIp + ":3000",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Regular),
                ForeColor = Color.FromArgb(156, 163, 175),
                Location = new Point(15, 98),
                AutoSize = true
            };
            panelStatus.Controls.Add(lblNetworkUrl);

            this.Controls.Add(panelStatus);

            // Message / Activity Label
            lblMessage = new Label
            {
                Text = "Ready. Click START to begin.",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Italic),
                ForeColor = Color.FromArgb(156, 163, 175),
                Location = new Point(20, 222),
                Size = new Size(465, 20),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(lblMessage);

            // 3. START / OPEN WEB Button (Primary Large)
            btnStart = new Button
            {
                Text = "▶  START & OPEN POS WEB",
                Font = new Font("Segoe UI", 11F, FontStyle.Bold),
                Location = new Point(20, 248),
                Size = new Size(465, 48),
                BackColor = Color.FromArgb(249, 115, 22),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnStart.FlatAppearance.BorderSize = 0;
            btnStart.Click += (s, e) => OnStartClick();
            this.Controls.Add(btnStart);

            // 4. RESTART Button & STOP Button in row
            btnRestart = new Button
            {
                Text = "↻  RESTART",
                Font = new Font("Segoe UI", 10F, FontStyle.Bold),
                Location = new Point(20, 306),
                Size = new Size(225, 44),
                BackColor = Color.FromArgb(37, 99, 235),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnRestart.FlatAppearance.BorderSize = 0;
            btnRestart.Click += (s, e) => OnRestartClick();
            this.Controls.Add(btnRestart);

            btnStop = new Button
            {
                Text = "⏹  STOP SERVERS",
                Font = new Font("Segoe UI", 10F, FontStyle.Bold),
                Location = new Point(260, 306),
                Size = new Size(225, 44),
                BackColor = Color.FromArgb(220, 38, 38),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnStop.FlatAppearance.BorderSize = 0;
            btnStop.Click += (s, e) => OnStopClick();
            this.Controls.Add(btnStop);

            // 5. QUIT Button
            btnQuit = new Button
            {
                Text = "✕  QUIT & CLOSE CONTROLLER",
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                Location = new Point(20, 360),
                Size = new Size(465, 38),
                BackColor = Color.FromArgb(55, 65, 81),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnQuit.FlatAppearance.BorderSize = 0;
            btnQuit.Click += (s, e) => OnQuitClick();
            this.Controls.Add(btnQuit);

            // Footer
            Label lblFooter = new Label
            {
                Text = "Fork & Fire POS System • Fast Food & Pizza Menu • v1.0",
                Font = new Font("Segoe UI", 8F, FontStyle.Regular),
                ForeColor = Color.FromArgb(107, 114, 128),
                Location = new Point(20, 425),
                Size = new Size(465, 20),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(lblFooter);
        }

        private bool CheckPort(int port)
        {
            try
            {
                using (TcpClient tcpClient = new TcpClient())
                {
                    IAsyncResult result = tcpClient.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(500);
                    if (success && tcpClient.Connected)
                    {
                        tcpClient.EndConnect(result);
                        return true;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private string GetLocalIp()
        {
            try
            {
                using (Socket socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0))
                {
                    socket.Connect("8.8.8.8", 65530);
                    IPEndPoint endPoint = socket.LocalEndPoint as IPEndPoint;
                    if (endPoint != null) return endPoint.Address.ToString();
                }
            }
            catch {}
            return "127.0.0.1";
        }

        private void CheckStatus()
        {
            if (isBusy) return;

            ThreadPool.QueueUserWorkItem(state =>
            {
                bool db = CheckPort(5432);
                bool srv = CheckPort(3000);

                this.BeginInvoke((MethodInvoker)delegate
                {
                    isDbRunning = db;
                    isServerRunning = srv;

                    if (db)
                    {
                        lblDbStatus.Text = "● PostgreSQL Database: CONNECTED (Port 5432)";
                        lblDbStatus.ForeColor = Color.FromArgb(16, 185, 129); // Green
                    }
                    else
                    {
                        lblDbStatus.Text = "○ PostgreSQL Database: OFFLINE";
                        lblDbStatus.ForeColor = Color.FromArgb(239, 68, 68); // Red
                    }

                    if (srv)
                    {
                        lblServerStatus.Text = "● POS Web Server: RUNNING (Port 3000)";
                        lblServerStatus.ForeColor = Color.FromArgb(16, 185, 129); // Green
                        btnStart.Text = "🌐  OPEN POS IN BROWSER";
                        btnStart.BackColor = Color.FromArgb(16, 185, 129);
                    }
                    else
                    {
                        lblServerStatus.Text = "○ POS Web Server: STOPPED";
                        lblServerStatus.ForeColor = Color.FromArgb(239, 68, 68); // Red
                        btnStart.Text = "▶  START & OPEN POS WEB";
                        btnStart.BackColor = Color.FromArgb(249, 115, 22);
                    }
                });
            });
        }

        private void SetBusy(bool busy, string message)
        {
            isBusy = busy;
            lblMessage.Text = message;
            btnStart.Enabled = !busy;
            btnRestart.Enabled = !busy;
            btnStop.Enabled = !busy;
            btnQuit.Enabled = !busy;
        }

        private void OnStartClick()
        {
            if (isServerRunning && isDbRunning)
            {
                OpenWeb();
                return;
            }

            SetBusy(true, "Starting Fork & Fire services, please wait...");

            ThreadPool.QueueUserWorkItem(state =>
            {
                StartDbInternal();
                StartServerInternal();

                // Wait up to 15 seconds for server to be responsive
                for (int i = 0; i < 15; i++)
                {
                    if (CheckPort(3000)) break;
                    Thread.Sleep(800);
                }

                this.BeginInvoke((MethodInvoker)delegate
                {
                    SetBusy(false, "Services started successfully!");
                    CheckStatus();
                    OpenWeb();
                });
            });
        }

        private void OnRestartClick()
        {
            SetBusy(true, "Restarting all Fork & Fire services...");

            ThreadPool.QueueUserWorkItem(state =>
            {
                StopAllInternal();
                Thread.Sleep(1500);

                StartDbInternal();
                StartServerInternal();

                for (int i = 0; i < 15; i++)
                {
                    if (CheckPort(3000)) break;
                    Thread.Sleep(800);
                }

                this.BeginInvoke((MethodInvoker)delegate
                {
                    SetBusy(false, "Restart completed! System ready.");
                    CheckStatus();
                });
            });
        }

        private void OnStopClick()
        {
            SetBusy(true, "Stopping all services...");

            ThreadPool.QueueUserWorkItem(state =>
            {
                StopAllInternal();
                Thread.Sleep(1000);

                this.BeginInvoke((MethodInvoker)delegate
                {
                    SetBusy(false, "All services stopped.");
                    CheckStatus();
                });
            });
        }

        private void OnQuitClick()
        {
            DialogResult dr = MessageBox.Show(
                "Do you want to stop background servers before quitting?",
                "Quit Fork & Fire Controller",
                MessageBoxButtons.YesNoCancel,
                MessageBoxIcon.Question
            );

            if (dr == DialogResult.Cancel) return;

            if (dr == DialogResult.Yes)
            {
                StopAllInternal();
            }

            this.Close();
        }

        private void OpenWeb()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "http://localhost:3000",
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not open browser: " + ex.Message);
            }
        }

        private void StartDbInternal()
        {
            if (CheckPort(5432)) return;

            string dataDir = Path.Combine(baseDir, "data");
            string pidFile = Path.Combine(dataDir, "postmaster.pid");
            if (File.Exists(pidFile))
            {
                try { File.Delete(pidFile); } catch { }
            }

            string pgCtl = Path.Combine(baseDir, "pgsql", "bin", "pg_ctl.exe");
            string logFile = Path.Combine(dataDir, "server.log");

            if (File.Exists(pgCtl))
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = pgCtl,
                    Arguments = "-D \"" + dataDir + "\" -l \"" + logFile + "\" start",
                    WorkingDirectory = baseDir,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                try
                {
                    Process p = Process.Start(psi);
                    if (p != null) p.WaitForExit(5000);
                }
                catch { }
            }
            else
            {
                // Fallback to start-db.js
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "node.exe",
                    Arguments = "scripts/start-db.js",
                    WorkingDirectory = baseDir,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                try
                {
                    Process p = Process.Start(psi);
                    if (p != null) p.WaitForExit(5000);
                }
                catch { }
            }
        }

        private void StartServerInternal()
        {
            if (CheckPort(3000)) return;

            string formattedDir = baseDir.Replace("\\", "/");
            string psCmd = "Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/next/dist/bin/next', 'dev', '-p', '3000', '-H', '0.0.0.0' -WorkingDirectory '" + formattedDir + "' -WindowStyle Hidden";

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -WindowStyle Hidden -Command \"" + psCmd + "\"",
                WorkingDirectory = baseDir,
                CreateNoWindow = true,
                UseShellExecute = false
            };
            try { Process.Start(psi); } catch { }
        }

        private void StopAllInternal()
        {
            // 1. Stop PostgreSQL
            string dataDir = Path.Combine(baseDir, "data");
            string pgCtl = Path.Combine(baseDir, "pgsql", "bin", "pg_ctl.exe");
            if (File.Exists(pgCtl))
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = pgCtl,
                    Arguments = "-D \"" + dataDir + "\" -m fast stop",
                    WorkingDirectory = baseDir,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                try
                {
                    Process p = Process.Start(psi);
                    if (p != null) p.WaitForExit(3000);
                }
                catch { }
            }

            // 2. Kill lingering node and postgres
            RunCmd("taskkill /F /IM postgres.exe /T");
            RunCmd("taskkill /F /IM node.exe /T");

            // 3. Clean PID
            string pidFile = Path.Combine(dataDir, "postmaster.pid");
            if (File.Exists(pidFile))
            {
                try { File.Delete(pidFile); } catch { }
            }
        }

        private void RunCmd(string command)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c " + command,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit(2000);
            }
            catch { }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ControlPanelForm());
        }
    }
}
