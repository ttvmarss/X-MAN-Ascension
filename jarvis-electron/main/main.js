const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const MemoryStore = require('../shared/memory');

let mainWindow;
let memory;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'renderer', 'icon.png'),
    backgroundColor: '#00000000'
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  memory = new MemoryStore();

  ipcMain.handle('memory:load', () => memory.load());
  ipcMain.handle('memory:save', (_event, data) => memory.save(data));
  ipcMain.handle('memory:clear', () => memory.clear());
  ipcMain.handle('memory:get-path', () => memory.filePath);

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
