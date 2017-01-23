// Copyright (c) The LHTML team
// See LICENSE for details.

const {electron, ipcMain, dialog, app, BrowserWindow, Menu, protocol} = require('electron');
const Path = require('path');
const fs = require('fs-extra');
const URL = require('url');
const {RPCService} = require('./rpc.js');
const _ = require('lodash');
const Tmp = require('tmp');
const AdmZip = require('adm-zip');

let template = [{
  label: 'File',
  submenu: [
    {
      label: 'Open...',
      accelerator: 'CmdOrCtrl+O',
      click() {
        return openFile();
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
    show: false,
  });
  default_window.on('ready-to-show', () => {
    default_window.show();
  })
  default_window.on('closed', () => {
    default_window = null;
  });
  default_window.loadURL(`file://${__dirname}/default.html`);
  return default_window;
}

function createLHTMLWindow() {
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
  });
  win.on('ready-to-show', () => {
    win.show();
  })
  win.loadURL(`file://${__dirname}/lhtml_container.html`);
  var win_id = win.id;
  win.on('closed', () => {
    let doc_info = WINDOW2DOC_INFO[win_id];
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
    _openPath(path);
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
  console.log('attempting to intercept http');
  let dropRequest = (request, callback) => {
    console.log('http request:');
    console.log(request);
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
  console.log('creating default window');

  // Menu
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (openfirst) {
    _openPath(openfirst);
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

function openFile() {
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
    _openPath(filePaths[0]);
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
    _openPath(filePaths[0]);
  });
}

function _unzip(path) {
  let doc_info = {};
  doc_info.tmpdir = Tmp.dirSync();
  doc_info.dir = doc_info.tmpdir.name;
  doc_info.zip = path;
  let zip = new AdmZip(path);
  console.log('extracting to', doc_info.dir);
  zip.extractAllTo(doc_info.dir, /*overwrite*/ true);
  return doc_info;
}

function _openPath(path) {
  // Open a new window
  let win = createLHTMLWindow();

  var dirPath;
  let ident = randomIdentifier();
  let doc_info = {
    id: ident,
    window_id: win.id,
  };
  if (fs.lstatSync(path).isFile()) {
    if (path.endsWith('.lhtml')) {
      // zipped directory.
      _.merge(doc_info, _unzip(path));
    } else {
      // unknown file type
      throw new Error('unknown file type');
    }
  } else {
    // Open expanded directory
    doc_info.dir = path;
  }

  WINDOW2DOC_INFO[win.id] = OPENDOCUMENTS[ident] = doc_info;
  var url = `lhtml://${ident}/index.html`;
  win.webContents.on('did-finish-load', (event) => {
    console.log('sending load-file');
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
  console.log('gonna get_save_data');
  return RPC.call('get_save_data', null, guest)
    .then((save_data) => {
      console.log('received save data');
      let doc_info = WINDOW2DOC_INFO[win.id];
      console.log('doc_info', doc_info);
      _.each(save_data, (guts, filename) => {
        var full_path = safe_join(doc_info.dir, filename);
        console.log('fs.writeFileSync', full_path);
        fs.writeFileSync(full_path, guts);
      });

      // Overwrite original zip, if it's a zip
      if (doc_info.zip) {
        console.log('writing zip');
        var zip = new AdmZip();
        zip.addLocalFolder(doc_info.dir, '.');
        zip.writeZip(doc_info.zip);
        console.log('wrote zip');
      } else {
        console.log('not a zip');
      }
      console.log('saved');
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
  console.log('doc_info', doc_info);
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
    console.log('save as', dst);
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
        console.log('delete', doc_info.tmpdir);
        fs.remove(doc_info.dir, (error) => {
          if (error) {
            console.error('Error deleting tmpdir:', error);
          }
        });
      }
      console.log("old doc_info", doc_info);
      _.merge(doc_info, _unzip(dst));
      console.log("new doc_info", doc_info);
    }
    // Then save any outstanding changes
    console.log('saveDoc');
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
  echo: (data, cb, eb) => {
    cb('echo: ' + data);
  },
  save: (data, cb, eb) => {
    Promise.resolve(saveFocusedDoc())
      .then(response => {
        cb(response);
      })
  }
};
