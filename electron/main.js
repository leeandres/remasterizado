const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const PORT = 3000;
const isDev = !app.isPackaged;

let serverProcess = null;
let mainWindow = null;

function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("El servidor no respondió a tiempo."));
        } else {
          setTimeout(check, 300);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
      });
    };
    check();
  });
}

function startServer() {
  if (isDev) return Promise.resolve();
  const standaloneDir = path.join(process.resourcesPath, "standalone");
  return new Promise((resolve, reject) => {
    serverProcess = spawn(
      process.execPath,
      [path.join(standaloneDir, "server.js")],
      {
        cwd: standaloneDir,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          PORT: String(PORT),
          HOSTNAME: "127.0.0.1",
        },
        stdio: "ignore",
      },
    );
    serverProcess.on("error", reject);
    waitForServer().then(resolve).catch(reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "MasterAI Pro",
    backgroundColor: "#06070a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (error) {
    console.error(error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
    serverProcess = null;
  }
});
