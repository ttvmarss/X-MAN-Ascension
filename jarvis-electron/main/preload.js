const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisAPI', {
  loadMemory: () => ipcRenderer.invoke('memory:load'),
  saveMemory: (data) => ipcRenderer.invoke('memory:save', data),
  clearMemory: () => ipcRenderer.invoke('memory:clear'),
  getMemoryPath: () => ipcRenderer.invoke('memory:get-path')
});
