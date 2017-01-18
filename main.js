const {electron, ipcMain, dialog, app, BrowserWindow, Menu, protocol} = require('electron');
const Path = require('path');
const fs = require('fs');
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
      return reloadFile();
    },
  },
  {
    label: 'Save',
    accelerator: 'CmdOrCtrl+S',
    click() {
      return saveDocument();
    }
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
  default_window = new BrowserWindow({width: 400, height: 400});
  default_window.on('closed', () => {
    default_window = null;
  });
  default_window.loadURL(`file://${__dirname}/default.html`);
  return default_window;
}

function createLHTMLWindow() {
  let win = new BrowserWindow({width: 800, height: 600});
  win.loadURL(`file://${__dirname}/lhtml_container.html`);
  win.on('closed', () => {
    let doc_info = WINDOW2DOC_INFO[win.id];
    if (doc_info.tmpdir) {
      console.log('deleting tmpdir');
      doc_info.tmpdir.removeCallback();
    }
    delete WINDOW2DOC_INFO[win.id];
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
    throw 'a fit';
  }
}

let OPENDOCUMENTS = {};
let WINDOW2DOC_INFO = {};

protocol.registerStandardSchemes(['lhtml'])

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
      console.error('Failed to register protocol');
    }
  })

  // The default window
  createDefaultWindow();

  // Menu
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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
    properties: ['openFile', 'openDirectory'],
  }, (filePaths) => {
    if (!filePaths) {
      return;
    }
    // Open a new window
    let win = createLHTMLWindow();

    var filePath = filePaths[0];
    var dirPath;
    let ident = randomIdentifier();
    let doc_info = {
      id: ident,
      window_id: win.id,
    };
    if (fs.lstatSync(filePath).isFile()) {
      if (filePath.endswith('.lhtml')) {
        // zipped directory.
        console.log('lhtml file (zipped)');
        doc_info.tmpdir = Tmp.dirSync();
        doc_info.dir = doc_info.tmpdir.name;
        let zip = new AdmZip(filePath);
        zip.extractAllTo(doc_info.dir, /*overwrite*/ true);
        doc_info.zip = zip;
      } else {
        // unknown file type
        throw 'unknown file type';
      }
    } else {
      doc_info.dir = filePath;
    }

    WINDOW2DOC_INFO[win.id] = OPENDOCUMENTS[ident] = doc_info;
    var url = `lhtml://${ident}/index.html`;
    win.webContents.on('did-finish-load', (event) => {
      console.log('sending load-file');
      win.webContents.send('load-file', url);
    });
  });
}

function reloadFile() {
  BrowserWindow.getFocusedWindow().webContents.send('reload-file');
}

function saveDocument() {
  console.log('saveDocument');
  let current = currentDocument();
  console.log('current', current);
  if (current) {
    var guest = current.webContents;
    RPC.call('get_save_data', null, guest)
      .then((save_data) => {
        console.log('got save_data', save_data);
        var doc_info = WINDOW2DOC_INFO[current.id];
        _.each(save_data, (guts, filename) => {
          var full_path = safe_join(doc_info.dir, filename);
          fs.writeFileSync(full_path, guts);
          if (doc_info.zip) {
            console.log('updating in zip', filename);
            zip.updateFile(filename, guts);
          }
        });

        // Overwrite original zip, if it's a zip
        if (doc_info.zip) {
          console.log('writing zip');
          doc_info.zip.writeZip();
        }
        RPC.call('emit_event', {'key': 'saved', 'data': null}, guest);
      })
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
};
