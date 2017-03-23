// Copyright (c) The LHTML team
// See LICENSE for details.

const {ipcMain, dialog, app, BrowserWindow, Menu, protocol, webContents, net} = require('electron');
const electron_is = require('electron-is');
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
const {safe_join} = require('./chrootfs.js');
const {autoUpdater} = require("electron-updater");
const {GroupSemaphore} = require('./locks.js');
const {showPreferenceWindow, getPrefValue} = require('./prefs/prefs.js');

const OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS ? true : false;

autoUpdater.logger = log;
log.transports.console.level = log.transports.file.level = process.env.LOGLEVEL || 'debug';
log.transports.file.maxSize = (5 * 1024 * 1024);

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
      },
      doc_only: true,
    },
    {
      label: 'Save As...',
      accelerator: 'CmdOrCtrl+Shift+S',
      click() {
        return saveAsFocusedDoc();
      },
      doc_only: true,
    },
    // Until issue #57 is fixed, don't expose this
    // {
    //   label: 'Save As Template...',
    //   click() {
    //     return saveTemplateFocusedDoc();
    //   },
    //   doc_only: true,
    // },
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
    },
    {
      type: 'separator'
    },
    {
      label: 'Export As PDF...',
      accelerator: 'CmdOrCtrl+P',
      doc_only: true,
      click() {
        return printToPDF();
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
      doc_only: true,
    },
  ]
}]

if (process.platform === 'darwin') {
  // macOS
  const name = 'LHTML';
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
        label: 'Preferences...',
        accelerator: 'CmdOrCtrl+,',
        click() {
          showPreferenceWindow();
        }
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
} else {
  // Not macOS
  template[1].submenu.push({type: 'separator'})
  template[1].submenu.push({
    label: 'Preferences...',
    accelerator: 'CmdOrCtrl+,',
    click() {
      showPreferenceWindow();
    }
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
  default_window.on('focus', () => {
    enableDocMenuItems(false);
  })
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
    if (OPEN_DEVTOOLS) {
      win.webContents.openDevTools('right');
    }
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
        win.close_promise && win.close_promise(false);
        win.webContents.closeDevTools();
      }
    }
  })
  win.on('closed', () => {
    win.close_promise && win.close_promise(true)
    let doc = WINDOW2DOC_INFO[win_id];
    if (!doc) {
      return;
    }
    doc.close();
    delete WINDOW2DOC_INFO[win_id];
    delete OPENDOCUMENTS[doc.id];
  });
  win.on('focus', () => {
    enableDocMenuItems(true);
  })

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
    this.window_id = null;
    this.lock = new GroupSemaphore({
      save: 'single',
      io: 'multiple',
    });
    
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
      this.emitWorkingDir();
    }
    return this._working_dir;
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
        resolve(null);
      }
    })
  }
  _updateWorkingDirFromSaveData() {
    let guest = this._rpcGuest();
    return RPC.call('save_your_stuff', null, guest);
  }
  get window() {
    if (_.isNil(this.window_id)) {
      return null;
    }
    return BrowserWindow.fromId(this.window_id);
  }
  _rpcGuest() {
    if (!this.window) {
      throw new Error('No window');
    }
    return this.window.webContents;
  }
  emitWorkingDir() {
    if (!this.window) {
      return;
    }
    let guest = this._rpcGuest();
    return RPC.call('set_chrootfs_root', this._working_dir, guest);
  }
  save() {
    if (!this.save_path) {
      return this.saveAs();
    }
    let guest = this._rpcGuest();
    return this._updateWorkingDirFromSaveData()
    .then(() => {
      return this.lock.run('save', () => {
        console.log('this.working_dir', this.working_dir);
        console.log('this.save_path', this.save_path);
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
      })
    }, err => {
      log.error(err);
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
        if (!dst) {
          return;
        }
        return this.changeSavePath(dst)
        .then(() => {
          return this.save();
        })
        .then(result => {
          resolve(result);
        })
      });
    })
  }
  changeSavePath(new_path) {
    return this.lock.run('save', () => {
      log.debug('changeSavePath', this.save_path, '-->', new_path);
      if (new_path !== this.save_path) {
        let new_is_directory = fs.existsSync(new_path) && fs.lstatSync(new_path).isDirectory()
        if (this.is_directory) {
          if (new_is_directory) {
            log.debug('dir -> dir');

            this._working_dir = null;
          } else {
            log.debug('dir -> file');

            this._tmpdir = Tmp.dirSync({unsafeCleanup: true});
            this._working_dir = this._tmpdir.name;
            fs.copySync(this.save_path, this._working_dir) 
          }
          this.emitWorkingDir();
        } else {
          if (new_is_directory) {
            log.debug('file -> dir');
          } else {
            log.debug('file -> file');
          }
        }
        this.is_directory = new_is_directory;
        this.save_path = new_path;
        this.window && this.window.setDocumentEdited(true);
      }
    })
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

let menu;
//
// Go through the menu template and find all the menu item
// labels that have `doc_only` set to `true`
function getDocOnlyMenuItems(templ) {
  return _(templ)
  .map((item) => {
    let ret = [];
    if (item.submenu) {
      ret.push(getDocOnlyMenuItems(item.submenu))
    }
    if (item.doc_only) {
      ret.push(item.label)
    }
    return ret;
  })
  .flattenDeep()
  .value();
}
let doc_only_menu_items = getDocOnlyMenuItems(template);
function enableDocMenuItems(enabled, themenu) {
  themenu = themenu || menu;
  _.each(themenu.items, (item) => {
    if (item.submenu) {
      enableDocMenuItems(enabled, item.submenu);
    }
    if (_.includes(doc_only_menu_items, item.label)) {
      item.enabled = enabled;
    }
  });
}

app.on('ready', function() {
  // Updates
  if (process.env.CHECK_FOR_UPDATES === "no" || process.env.RUN_TESTS) {
    log.info('UPDATE CHECKING DISABLED');
  } else if (electron_is.dev()) {
    log.info('UPDATE CHECKING DISABLED in dev');
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
    } else if (details.url.startsWith('blob:')) {
      // blobs are allowed?
      // XXX Is this a security problem?
      callback({})
    } else {
      log.warn(`Document attempted ${details.method} ${details.url}`);
      callback({cancel: true});  
    }
  })

  // Menu
  menu = Menu.buildFromTemplate(template);
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
  if (process.env.RUN_TESTS) {
    // in test mode, don't quit
    return
  }
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
  let defaultPath = getDefaultTemplateDir();
  dialog.showOpenDialog({
    title: 'New From Template...',
    defaultPath: defaultPath,
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
    let working_dir = doc.working_dir;
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
  let current = currentWindow();
  if (current) {
    current.webContents.send('reload-file');
    current.setDocumentEdited(false);
  }
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
    template_dir = Path.join(app.getPath('documents'), 'lhtml_templates');
    fs.ensureDirSync(template_dir);
  } catch(err) {
  }
  return template_dir;
}

function saveTemplateFocusedDoc() {
  let current = currentWindow();
  if (!current) {
    return Promise.resolve(null);
  }
  let doc = WINDOW2DOC_INFO[current.id];
  if (!doc) {
    return Promise.resolve(null);
  }
  let template_dir = getDefaultTemplateDir();
  return new Promise((resolve, reject) => {
    dialog.showSaveDialog({
      defaultPath: template_dir,
      filters: [
        {name: 'LHTML', extensions: ['lhtml']},
        {name: 'All Files', extensions: ['*']},
      ],
    }, dst => {
      if (!dst) {
        return;
      }
      let former_path = doc.save_path;
      doc.changeSavePath(dst);
      return doc.save().then(result => {
        doc.changeSavePath(former_path);
        return result;
      }, err => {
        doc.changeSavePath(former_path);
        throw err;
      })
      .then(resolve)
      .catch(reject);
    });  
  })
}


function closeFocusedDoc() {
  let current = currentWindow();
  if (current) {
    return new Promise((resolve, reject) => {
      current.close_promise = function(result) {
        delete current.close_promise;
        resolve(result);
      };
      current.close();
    })
  } else {
    return Promise.resolve(false);
  }
}


function printToPDF() {
  let webview = currentWebViewWebContents();
  if (webview) {
    webview.printToPDF({
      printBackground: true,
    }, (err, data) => {
      if (err) throw err;
      dialog.showSaveDialog({
        filters: [
          {name: 'PDF', extensions: ['pdf']},
          {name: 'All Files', extensions: ['*']},
        ],
      }, dst => {
        if (!dst) {
          return;
        }
        fs.writeFile(dst, data, err => {
          if (err) throw err;
          log.debug('wrote PDF', dst);
        })
      });
      
    })
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
  if (win) {
    while (win.webContents.hostWebContents) {
      win = BrowserWindow.fromWebContents(win.webContents.hostWebContents);
    }
  }
  return win;
}
function currentWebViewWebContents() {
  let win = BrowserWindow.getFocusedWindow();
  return _.find(webContents.getAllWebContents(), wc => {
    return wc.hostWebContents === win.webContents;
  })
}

let RPC = new RPCService(ipcMain);
RPC.listen();
RPC.handlers = {
  echo: (ctx, data) => {
    return 'echo: ' + data;
  },
  acquire_io_lock: (ctx) => {
    let doc = OPENDOCUMENTS[ctx.sender_id];
    return doc.lock.acquire('io');
  },
  release_io_lock: (ctx) => {
    let doc = OPENDOCUMENTS[ctx.sender_id];
    return doc.lock.release('io');
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
  get_chrootfs_root: (ctx) => {
    let doc = OPENDOCUMENTS[ctx.sender_id];
    return doc.working_dir;
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
};

module.exports = {
  app,
  openPath,
  reloadFocusedDoc,
  closeFocusedDoc,
  saveFocusedDoc,
  saveAsFocusedDoc,
  saveTemplateFocusedDoc,
};

// Test interface
if (process.env.RUN_TESTS) {
  console.log('RUNNING TESTS');
  require('../functest/e2e.js');
}