// Copyright (c) The LHTML team
// See LICENSE for details.

const {ipcMain, dialog, app, BrowserWindow, Menu, protocol, webContents, net} = require('electron');
const {session} = require('electron');
var electron = require('electron');
const Path = require('path');
const fs = require('fs-extra');
const URL = require('url');
const {RPCService} = require('./rpc.js');
const _ = require('lodash');
const Tmp = require('tmp');
const AdmZip = require('adm-zip');
const log = require('electron-log');
const {safe_join, ChrootFS} = require('./chrootfs.js');
const {autoUpdater} = require("electron-updater");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

log.info('LHTML starting...');

let template = [{
  label: 'File',
  submenu: [
    {
      label: 'New From Template...',
      accelerator: 'CmdOrCtrl+N',
      click() {
        return newFromTemplate();
      },
    },
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
      label: 'Save As Template...',
      click() {
        return saveTemplateFocusedDoc();
      }
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
      label: 'Toggle Dev Tools',
      click() {
        toggleMainDevTools();
      },
    },
    {
      label: 'Toggle Document Dev Tools',
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
        click() {
          promptForUpdate();
        },
      },
      {
        label: 'Check for updates...',
        click() {
          promptForUpdate();
        },
      },
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
class Updater {
  constructor(state_receiver) {
    this.state_receiver = state_receiver;

    this.state = {
      action: null,
      error: null,
      latest_version: null,
      update_available: null,
      update_downloaded: null,
    }

    autoUpdater.on('checking-for-update', () => {
      this.state.action = 'checking';
      state_receiver(this.state);
    })
    autoUpdater.on('update-available', (info) => {
      log.info('arguments', arguments);
      this.state.action = 'downloading';
      this.state.latest_version = info;
      this.state.update_available = true;
      state_receiver(this.state);
      log.info('update-available info', info);
    })
    autoUpdater.on('update-not-available', (info) => {
      log.info('arguments', arguments);
      this.state.action = null;
      this.state.latest_version = info;
      this.state.update_available = false;
      state_receiver(this.state);
      log.info('update-not-available info', info);
    })
    autoUpdater.on('error', (ev, err) => {
      this.state.error = 'Error encountered while updating.';
      this.state.action = null;
      state_receiver(this.state);
    })
    autoUpdater.on('download-progress', (info) => {
      this.state.action = 'downloading';
      state_receiver(this.state);
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.state.action = null;
      this.state.update_downloaded = true;
      state_receiver(this.state);
    })
  }
  checkForUpdates() {
    this.state_receiver(this.state);
    if (this.state.action || this.state.update_downloaded
        || this.state.latest_versrion || this.state.update_available) {
      return;
    }
    autoUpdater.checkForUpdates();
  }
}
let update_window;

let updater = new Updater(state => {
  if (update_window) {
    update_window.webContents.send('state', state);
  }
});
ipcMain.on('do-update', () => {
  if (updater.state.update_downloaded) {
    autoUpdater.quitAndInstall();
  }
});

function promptForUpdate() {
  if (update_window) {
    // window already exists
    updater.checkForUpdates();
    return update_window;
  }
  update_window = new BrowserWindow({
    width: 300,
    height: 250,
    resizable: false,
    show: false,
    title: '',
  });
  update_window.on('ready-to-show', () => {
    update_window.show();
    updater.checkForUpdates();
  })
  update_window.on('closed', () => {
    update_window = null;
  });
  update_window.loadURL(`file://${__dirname}/updates.html?version=${app.getVersion()}`);
  return update_window;
}


function createLHTMLWindow() {
  // Create a session with network access disabled
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
        buttons: ['Close', "Don't close"],
        title: 'Confirm',
        message: 'Unsaved changes will be lost.  Are you sure you want to close this document?'
      });
      if (choice === 1) {
        ev.preventDefault();
      }
    }
  })
  win.on('closed', () => {
    let doc = WINDOW2DOC_INFO[win_id];
    if (!doc) {
      return;
    }
    doc.close();
    delete WINDOW2DOC_INFO[win_id];
    delete OPENDOCUMENTS[doc.id];
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

let OPENDOCUMENTS = {};
let WINDOW2DOC_INFO = {};


class Document {
  //
  // @param path: Path to file being opened.
  constructor(path) {
    this._chroot = null;
    this.window_id = null;
    
    // random 
    this.id = randomIdentifier();

    // Path to the LHTML file or directory
    this.save_path = path;
    this.is_directory = fs.lstatSync(path).isDirectory();
    this._tmpdir = null;

    // Path where LHTML is expanded into
    this._working_dir = null;
  }
  get working_dir() {
    if (!this._working_dir) {
      if (this.is_directory) {
        this._working_dir = this.save_path;
      } else {
        this._tmpdir = Tmp.dirSync({unsafeCleanup: true});
        this._working_dir = this._tmpdir.name;
        let zip = new AdmZip(this.save_path);
        log.info('extracting to', this._working_dir);
        zip.extractAllTo(this._working_dir, /*overwrite*/ true);  
      }
    }
    console.log('working_dir', this._working_dir);
    return this._working_dir;
  }
  get chroot() {
    if (!this._chroot) {
      console.log('chroot working_dir', this.working_dir);
      this._chroot = new ChrootFS(this.working_dir);
    }
    return this._chroot;
  }
  close() {
    return new Promise((resolve, reject) => {
      if (this._tmpdir) {
        try {
          this._tmpdir.removeCallback()
        } catch(err) {
          log.error('Error deleting working_dir:', err);
        }
        this._tmpdir = null;
        this._working_dir = null;
        this._chroot = null;
        resolve(null);
      }
    })
  }
  _updateWorkingDirFromSaveData() {
    let guest = this._rpcGuest();
    return RPC.call('get_save_data', null, guest)
      .then((save_data) => {
        let saves = _.map(save_data, (guts, filename) => {
          return this.chroot.writeFile(filename, guts);
        });
        return Promise.all(saves);
      });
  }
  get window() {
    return BrowserWindow.fromId(this.window_id);
  }
  _rpcGuest() {
    if (!this.window) {
      throw new Error('No window');
    }
    return this.window.webContents;
  }
  save() {
    if (!this.save_path) {
      return this.saveAs();
    }
    let guest = this._rpcGuest();
    return this._updateWorkingDirFromSaveData()
    .then(result => {
      if (this.is_directory) {
        // done, it's already saved
      } else {
        // Write a new zip file
        let zip = new AdmZip();
        zip.addLocalFolder(this.working_dir, '.');
        zip.writeZip(this.save_path);
      }
      log.info('saved', this.save_path);
      RPC.call('emit_event', {'key': 'saved', 'data': null}, guest);
    }, err => {
      RPC.call('emit_event', {'key': 'save-failed', 'data': null}, guest);
    })
  }
  saveAs() {
    let defaultPath = this.save_path ? Path.dirname(this.save_path) : null;
    return new Promise((resolve, reject) => {
      dialog.showSaveDialog({
        defaultPath: defaultPath,
        filters: [
          {name: 'LHTML', extensions: ['lhtml']},
          {name: 'All Files', extensions: ['*']},
        ],
      }, dst => {
        this.changeSavePath(dst)
        return resolve(this.save());
      });
    })
  }
  changeSavePath(new_path) {
    if (new_path !== this.save_path) {
      if (this.is_directory) {
        // Copy from dir to a new working dir
        this._tmpdir = Tmp.dirSync({unsafeCleanup: true});
        this._working_dir = this._tmpdir.name;
        this._chroot = null;
        fs.copySync(this.save_path, this._working_dir)
        this.is_directory = false;
      }
      this.save_path = new_path;
      this.window && this.window.setDocumentEdited(true);
    }
  }
  attachToWindow(window_id) {
    if (this.window_id) {
      throw new Error('Document already attached to a window');
    }
    this.window_id = window_id;
  }
}

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
  // Updates
  if (process.env.CHECK_FOR_UPDATES === "no") {
    log.info('UPDATE CHECKING DISABLED');
  } else {
    updater.checkForUpdates();
  }

  let sesh = session.fromPartition('persist:webviews');

  // Handle lhtml://<path>
  sesh.protocol.registerFileProtocol('lhtml', (request, callback) => {
    const parsed = URL.parse(request.url);
    const domain = parsed.host;
    const path = parsed.path;
    const root_dir = OPENDOCUMENTS[domain].working_dir;
    safe_join(root_dir, path).then(file_path => {
      callback({path: file_path});
    });
  }, (error) => {
    if (error) {
      throw new Error('failed to register lhtml protocol');
    }
  })

  // Disable networking for webviews
  sesh.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.startsWith('lhtml://')) {
      // lhtml requests are allowed
      callback({})
    } else if (details.url.startsWith('chrome-devtools://')) {
      // chrome-devtools requests are allowed
      // XXX Is this a security problem?
      callback({})
    } else {
      log.debug(`Document attempted ${details.method} ${details.url}`);
      callback({cancel: true});  
    }
  })

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

function newFromTemplate() {
  dialog.showOpenDialog({
    title: 'New From Template...',
    properties: ['openFile'],
    filters: [
      {name: 'LHTML', extensions: ['lhtml']},
      {name: 'All Files', extensions: ['*']},
    ],
  }, (filePaths) => {
    if (!filePaths) {
      return;
    }
    let doc = openPath(filePaths[0]);
    doc.changeSavePath(null);
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

function openPath(path) {
  // Is it already opened?
  let existing = _(OPENDOCUMENTS)
    .values()
    .filter(doc => {
      return doc.save_path === path;
    })
    .first();
  if (existing) {
    BrowserWindow.fromId(existing.window_id).focus();
    return;
  }

  var dirPath;
  let doc = new Document(path);
  try {
    let chroot = doc.chroot;
  } catch (err) {
    dialog.showErrorBox("Error opening file", "Filename: " + path + "\n\n" + err);
    return;
  }

  // Open a new window
  let win = createLHTMLWindow();
  doc.attachToWindow(win.id);

  WINDOW2DOC_INFO[win.id] = OPENDOCUMENTS[doc.id] = doc;
  var url = `lhtml://${doc.id}/index.html`;
  win.webContents.on('did-finish-load', (event) => {
    win.webContents.send('load-file', url);
  });
  return doc;
}

function reloadFocusedDoc() {
  BrowserWindow.getFocusedWindow().webContents.send('reload-file');
}

function saveFocusedDoc() {
  let current = currentWindow();
  if (current) {
    let doc = WINDOW2DOC_INFO[current.id];
    if (!doc) {
      return;
    }
    return doc.save();
  }
}

function saveAsFocusedDoc() {
  let current = currentWindow();
  if (current) {
    let doc = WINDOW2DOC_INFO[current.id];
    if (!doc) {
      return;
    }
    return doc.saveAs();
  }
}

function getDefaultTemplateDir() {
  let template_dir = null;
  try {
    template_dir = Path.join(app.getPath('userData'), 'templates');
  } catch(err) {
    try {
      template_dir = Path.join(app.getPath('documents'), 'lhtml_templates');
    } catch(err) {

    }
  }
  return template_dir;
}

function saveTemplateFocusedDoc() {
  let current = currentWindow();
  if (!current) {
    return;
  }
  let doc = WINDOW2DOC_INFO[current.id];
  if (!doc) {
    return;
  }
  let template_dir = getDefaultTemplateDir();
  dialog.showSaveDialog({
    defaultPath: template_dir,
    filters: [
      {name: 'LHTML', extensions: ['lhtml']},
      {name: 'All Files', extensions: ['*']},
    ],
  }, dst => {
    let former_path = doc.save_path;
    doc.changeSavePath(dst);
    return doc.save().then(result => {
      doc.changeSavePath(former_path);
    }, err => {
      doc.changeSavePath(former_path);
    });
  });
}


function closeFocusedDoc() {
  let current = currentWindow();
  if (current) {
    current.close();
  }
}

function toggleMainDevTools() {
  currentWindow().toggleDevTools();
}
function toggleDocumentDevTools() {
  currentWindow().webContents.send('toggleDevTools');
}


function currentWindow() {
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