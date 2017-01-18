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

//
//  Save a file to the filesystem.
//
LHTML.saveRelativeFile = (relpath, content) => {
  ipcRenderer.sendToHost('save_file', {
    path: relpath,
    content: content,
  });
}

window.LHTML = LHTML;