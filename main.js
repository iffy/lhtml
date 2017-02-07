// Copyright (c) The LHTML team
// See LICENSE for details.

const {ipcMain, dialog, app, BrowserWindow, Menu, protocol, webContents} = require('electron');
var electron = require('electron');
const Path = require('path');
const fs = require('fs-extra');
const URL = require('url');
const {RPCService} = require('./rpc.js');
const _ = require('lodash');
const Tmp = require('tmp');
const AdmZip = require('adm-zip');
const log = require('electron-log');
const {ChrootFS} = require('./chrootfs.js');


let template = [{
  label: 'File',
  submenu: [
    {
      label: 'Open...',
      accelerator: 'CmdOrCtrl+O',
      click() {
        return promptOpenFile();
      },
    },
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click() {
        return reloadFocusedDoc();
      },
    },
    {
      label: 'Save',
      accelerator: 'CmdOrCtrl+S',
      click() {
        return saveFocusedDoc();
      }
    },
    {
      label: 'Save As...',
      accelerator: 'CmdOrCtrl+Shift+S',
      click() {
        return saveAsFocusedDoc();
      },
    },
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      click() {
        return closeFocusedDoc();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Open Directory...',
      accelerator: 'CmdOrCtrl+Shift+O',
      click() {
        return openDirectory();
      }
    }
  ]
},
{
  label: 'Edit',
  submenu: [
    {
      role: 'undo'
    },
    {
      role: 'redo'
    },
    {
      type: 'separator'
    },
    {
      role: 'cut'
    },
    {
      role: 'copy'
    },
    {
      role: 'paste'
    },
    {
      role: 'pasteandmatchstyle'
    },
    {
      role: 'delete'
    },
    {
      role: 'selectall'
    }
  ]
},
{
  label: 'View',
  submenu: [
    {
      label: 'Show/Hide Main Dev Tools',
      click() {
        toggleMainDevTools();
      },
    },
    {
      label: 'Show/Hide Document Dev Tools',
      click() {
        toggleDocumentDevTools();
      },
    },
  ]
}]

if (process.platform === 'darwin') {
  // OS X
  const name = 'LHTML'; //app.getName();
  template.unshift({
    label: name,
    submenu: [
      {
        label: 'About ' + name,
        role: 'about'
      },
      // {
      //   label: 'Check for updates...',
      //   click() {
      //     promptForUpdate();
      //   },
      // },
      {type: 'separator'},
      {
        label: 'Services',
        role: 'services',
        submenu: [],
      },
      {type: 'separator'},
      {
        label: 'Hide ' + name,
        accelerator: 'Command+H',
        role: 'hide'
      },
      {
        label: 'Hide Others',
        accelerator: 'Command+Alt+H',
        role: 'hideothers'
      },
      {
        label: 'Show All',
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click() { app.quit(); }
      },
    ]
  })
}

let default_window = null;

function createDefaultWindow() {
  default_window = new BrowserWindow({
    titleBarStyle: 'hidden',
    width: 400,
    height: 300,
    resizable: false,
    show: false,
  });
  default_window.on('ready-to-show', () => {
    default_window.show();
  })
  default_window.on('closed', () => {
    default_window = null;
  });
  default_window.loadURL(`file://${__dirname}/default.html?version=v${app.getVersion()}`);
  return default_window;
}

//-------------------------------------------------------------------
// Auto updates
//-------------------------------------------------------------------
// We don't get auto-update on macOS until we pay to sign the code
// So, until then, this code goes away.
// var {autoUpdater} = require("electron-updater");
// let UPDATE_DOWNLOADED = false;
// let update_window;

// autoUpdater.logger = log;
// autoUpdater.logger.transports.file.level = 'info';
// autoUpdater.on('checking-for-update', (ev) => {
//   sendToUpdateWindow('checking-for-update');
// })
// autoUpdater.on('update-available', (ev) => {
//   sendToUpdateWindow('update-available');
// })
// autoUpdater.on('update-not-available', (ev) => {
//   sendToUpdateWindow('update-not-available');
// })
// autoUpdater.on('error', (ev) => {
//   sendToUpdateWindow('error');
// })
// autoUpdater.on('download-progress', (ev) => {
// })
// autoUpdater.on('update-downloaded', (ev, releaseNotes, releaseName, releaseDate, updateURL) => {
//   UPDATE_DOWNLOADED = releaseName;
//   promptForUpdate();
// })
// ipcMain.on('do-update', () => {
//   if (UPDATE_DOWNLOADED) {
//     autoUpdater.quitAndInstall();
//   }
// });

// if (process.env.CHECK_FOR_UPDATES === "no") {
//   console.log('UPDATE CHECKING DISABLED');
// } else {
//   autoUpdater.checkForUpdates()
//   .then(result => {
//     console.log('check for updates result', result);
//   })
//   .catch(err => {
//     console.log('Error checking for update');
//   })
// }

// function promptForUpdate() {
//   if (update_window) {
//     // already exists
//     if (UPDATE_DOWNLOADED) {
//       update_window.webContents.send('update-downloaded', UPDATE_DOWNLOADED);
//     }
//     return;
//   }
//   update_window = new BrowserWindow({
//     titleBarStyle: 'hidden',
//     x: 0,
//     y: 10,
//     width: 400,
//     height: 200,
//     resizable: false,
//     show: false,
//   });
//   update_window.on('ready-to-show', () => {
//     update_window.show();
//     if (UPDATE_DOWNLOADED) {
//       update_window.webContents.send('update-downloaded', UPDATE_DOWNLOADED);
//     }
//   })
//   update_window.on('closed', () => {
//     update_window = null;
//   });
//   update_window.loadURL(`file://${__dirname}/updates.html?version=v${app.getVersion()}`);
//   return update_window;
// }

// function sendToUpdateWindow(name, data) {
//   if (update_window) {
//     update_window.webContents.send(name, data);
//   }
// }

function createLHTMLWindow() {
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 320,
    minHeight: 240,
    show: false,
  });
  win.on('ready-to-show', () => {
    win.show();
  })
  win.on('resize', () => {
    const [width, height] = win.getContentSize();
    for (let wc of webContents.getAllWebContents()) {
      if (wc.hostWebContents && wc.hostWebContents.id === win.webContents.id) {
        wc.setSize({
          normal: {
            width: width,
            height: height,
          }
        })
      }
    }
  })
  win.loadURL(`file://${__dirname}/lhtml_container.html`);
  var win_id = win.id;
  win.on('close', (ev) => {
    if (win.isDocumentEdited()) {
      let choice = dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Quit', "Don't quit"],
        title: 'Confirm',
        message: 'Unsaved changes will be lost.  Are you sure you want to quit?'
      });
      if (choice === 1) {
        ev.preventDefault();
      }
    }
  })
  win.on('closed', () => {
    let doc_info = WINDOW2DOC_INFO[win_id];
    if (!doc_info) {
      return;
    }
    if (doc_info.tmpdir) {
      fs.remove(doc_info.dir, (error) => {
        if (error) {
          console.error('Error deleting tmpdir:', error);
        }
      });
    }
    delete WINDOW2DOC_INFO[win_id];
    delete OPENDOCUMENTS[doc_info.id];
  });

  // Close the default window once a guest window has been opened.
  if (default_window) {
    default_window.close();
  }
  return win;
}


function randomIdentifier() {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

function safe_join(base, part) {
  var path = fs.realpathSync(Path.normalize(`${base}/${part}`));
  var base = fs.realpathSync(base);

  if (path.indexOf(base) === 0) {
    return path;
  } else {
    throw new Error('a fit');
  }
}

let OPENDOCUMENTS = {};
let WINDOW2DOC_INFO = {};

protocol.registerStandardSchemes(['lhtml'])

let openfirst;
app.on('open-file', function(event, path) {
  if (app.isReady()) {
    openPath(path);
  } else {
    openfirst = path;
  }
  event.preventDefault();
})

app.on('ready', function() {
  // Handle lhtml://<path>
  protocol.registerFileProtocol('lhtml', (request, callback) => {
    const parsed = URL.parse(request.url);
    const domain = parsed.host;
    const path = parsed.path;
    const root_dir = OPENDOCUMENTS[domain].dir;
    const file_path = safe_join(root_dir, path);

    callback({path: file_path});
  }, (error) => {
    if (error) {
      throw new Error('failed to register lhtml protocol');
    }
  })

  // Disable http:// requests until we can figure out a secure
  // way to do it.
  let dropRequest = (request, callback) => {
    callback(null);
  };
  protocol.interceptHttpProtocol('http', dropRequest, (error) => {
    if (error) {
      throw new Error('failed to register http protocol');
    }
  });
  protocol.interceptHttpProtocol('https', dropRequest, (error) => {
    if (error) {
      throw new Error('failed to register https protocol');
    }
  });

  // Menu
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (openfirst) {
    openPath(openfirst);
    openfirst = null;
  } else {
    // The default window
    createDefaultWindow();
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createDefaultWindow();
  }
});

function promptOpenFile() {
  dialog.showOpenDialog({
    title: 'Open...',
    properties: ['openFile'],
    filters: [
      {name: 'LHTML', extensions: ['lhtml']},
      {name: 'All Files', extensions: ['*']},
    ],
  }, (filePaths) => {
    if (!filePaths) {
      return;
    }
    openPath(filePaths[0]);
  });
}

function openDirectory() {
  dialog.showOpenDialog({
    title: 'Open Directory...',
    properties: ['openDirectory'],
  }, (filePaths) => {
    if (!filePaths) {
      return;
    }
    openPath(filePaths[0]);
  });
}

function _unzip(path) {
  let doc_info = {};
  doc_info.tmpdir = Tmp.dirSync();
  doc_info.dir = doc_info.tmpdir.name;
  doc_info.zip = path;
  let zip = new AdmZip(path);
  log.info('extracting to', doc_info.dir);
  zip.extractAllTo(doc_info.dir, /*overwrite*/ true);
  return doc_info;
}

function openPath(path) {
  var dirPath;
  let ident = randomIdentifier();
  let doc_info = {
    id: ident,
  };
  if (fs.lstatSync(path).isFile()) {
    try {
      _.merge(doc_info, _unzip(path));  
    } catch (err) {
      dialog.showErrorBox("Error opening file", "Filename: " + path + "\n\n" + err);
      return;
    }
  } else {
    // Open expanded directory
    doc_info.dir = path;
  }
  doc_info.chroot = new ChrootFS(doc_info.dir);

  // Open a new window
  let win = createLHTMLWindow();
  doc_info.window_id = win.id;

  WINDOW2DOC_INFO[win.id] = OPENDOCUMENTS[ident] = doc_info;
  var url = `lhtml://${ident}/index.html`;
  win.webContents.on('did-finish-load', (event) => {
    win.webContents.send('load-file', url);
  });
}

function reloadFocusedDoc() {
  BrowserWindow.getFocusedWindow().webContents.send('reload-file');
}

function saveFocusedDoc() {
  let current = currentDocument();
  if (current) {
    _saveDoc(current);
  }
}

function _saveDoc(win) {
  var guest = win.webContents;
  return RPC.call('get_save_data', null, guest)
    .then((save_data) => {
      let doc_info = WINDOW2DOC_INFO[win.id];
      _.each(save_data, (guts, filename) => {
        var full_path = safe_join(doc_info.dir, filename);
        fs.writeFileSync(full_path, guts);
      });

      // Overwrite original zip, if it's a zip
      if (doc_info.zip) {
        var zip = new AdmZip();
        zip.addLocalFolder(doc_info.dir, '.');
        zip.writeZip(doc_info.zip);
      }
      log.info('saved');
      win.setDocumentEdited(false);
      RPC.call('emit_event', {'key': 'saved', 'data': null}, guest);
      return null;
    });
}

function saveAsFocusedDoc() {
  let current = currentDocument();
  if (!current) {
    return;
  }
  let doc_info = WINDOW2DOC_INFO[current.id];
  let defaultPath = Path.dirname(doc_info.dir);
  if (doc_info.zip) {
    defaultPath = Path.dirname(doc_info.zip);
  }
  dialog.showSaveDialog({
    defaultPath: defaultPath,
    filters: [
      {name: 'LHTML', extensions: ['lhtml']},
      {name: 'All Files', extensions: ['*']},
    ],
  }, dst => {
    // Copy first
    if (doc_info.zip) {
      // Copying from zip to zip
      fs.copy(doc_info.zip, dst);
      doc_info.zip = dst;
    } else {
      // Copying from dir to zip
      var zip = new AdmZip();
      zip.addLocalFolder(doc_info.dir, '.');
      zip.writeZip(dst);
      if (doc_info.tmpdir) {
        fs.remove(doc_info.dir, (error) => {
          if (error) {
            console.error('Error deleting tmpdir:', error);
          }
        });
      }
      _.merge(doc_info, _unzip(dst));
    }
    // Then save any outstanding changes
    _saveDoc(current);
  })
}


function closeFocusedDoc() {
  let current = currentDocument();
  if (current) {
    current.close();
  }
}

function toggleMainDevTools() {
  currentDocument().toggleDevTools();
}
function toggleDocumentDevTools() {
  currentDocument().webContents.send('toggleDevTools');
}


function currentDocument() {
  let win = BrowserWindow.getFocusedWindow();
  return win;
}

let RPC = new RPCService(ipcMain);
RPC.listen();
RPC.handlers = {
  echo: (ctx, data) => {
    return 'echo: ' + data;
  },
  save: (ctx, data) => {
    let window_id = OPENDOCUMENTS[ctx.sender_id].window_id;
    let win = BrowserWindow.fromId(window_id);
    return _saveDoc(win);
  },
  set_document_edited: (ctx, edited) => {
    let window_id = OPENDOCUMENTS[ctx.sender_id].window_id;
    let win = BrowserWindow.fromId(window_id);
    win.setDocumentEdited(edited);
    return edited;
  },
  suggest_size: (ctx, size) => {
    let window_id = OPENDOCUMENTS[ctx.sender_id].window_id;
    let win = BrowserWindow.fromId(window_id);
    let current = win.getSize();

    let newsize = {
      width: size.width || current[0],
      height: size.height || current[1],
    };

    // limit it to the size of the screen
    let display = electron.screen.getDisplayMatching(win.getBounds());
    if (newsize.width > display.workAreaSize.width) {
      newsize.width = display.workAreaSize.width;
    }
    if (newsize.height > display.workAreaSize.height) {
      newsize.height = display.workAreaSize.height;
    }

    if (!win.throttledSetSize) {
      win.throttledSetSize = _.debounce(win.setSize, 600, {
        leading: true,
        trailing: false,
      });
    }

    win.throttledSetSize(newsize.width, newsize.height);

    current = win.getSize();
    return {
      width: current[0],
      height: current[1],
    };
  },
  listdir: (ctx, path) => {
    return OPENDOCUMENTS[ctx.sender_id].chroot.listdir(path);
  },
  writeFile: (ctx, params) => {
    return OPENDOCUMENTS[ctx.sender_id].chroot.writeFile(params.path, params.data);
  },
  readFile: (ctx, path) => {
    return OPENDOCUMENTS[ctx.sender_id].chroot.readFile(path);
  },
  remove: (ctx, path) => {
    return OPENDOCUMENTS[ctx.sender_id].chroot.remove(path);
  }
};

// Test interface
if (process.env.RUNNING_IN_SPECTRON) {
  app.T_openPath = openPath;
}