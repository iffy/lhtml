//
// This script is executed right when an LHTML file is loaded.
//
let LHTML = {};

const {ipcRenderer} = require('electron');
ipcRenderer.on('ping', () => {
  ipcRenderer.sendToHost('pong');
});

LHTML.pong = (something) => {
  ipcRenderer.sendToHost('pong');
}

window.LHTML = LHTML;