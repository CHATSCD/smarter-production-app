const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const prepareNext = require('electron-next');

let mainWindow;

async function createWindow() {
  // Prepare Next.js renderer process
  await prepareNext('./src');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: "Keith's Superstores - Scheduling System",
  });

  // Load the app
  const url = isDev
    ? 'http://localhost:8000/login'
    : `file://${path.join(__dirname, '../out/login.html')}`;

  mainWindow.loadURL(url);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize app
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Initialize database on app start
app.on('ready', () => {
  const { initDatabase } = require('./database');
  initDatabase();
});
