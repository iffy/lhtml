const {electron, ipcMain, dialog, app, BrowserWindow, Menu, protocol} = require('electron');
const Path = require('path');
const fs = require('fs');
const URL = require('url');

let win;

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
      return saveApp();
    }
  }
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

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({width: 800, height: 600});

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  win.webContents.openDevTools({
    mode: 'undocked',
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
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

let OPENFILES = {};

protocol.registerStandardSchemes(['lhtml'])

app.on('ready', function() {
  // Handle lhtml://<path>
  protocol.registerFileProtocol('lhtml', (request, callback) => {
    const parsed = URL.parse(request.url);
    const domain = parsed.host;
    const path = parsed.path;
    const root_dir = OPENFILES[domain].dir;
    const file_path = safe_join(root_dir, path);

    callback({path: file_path});
  }, (error) => {
    if (error) {
      console.error('Failed to register protocol');
    }
  })

  // The default window
  createWindow();

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
  if (win === null) {
    createWindow();
  }
});

function openFile() {
  dialog.showOpenDialog({
    title: 'Open...',
    properties: ['openFile', 'openDirectory'],
  }, (filePaths) => {
    var filePath = filePaths[0];
    var dirPath;
    var file_info = {};
    if (fs.lstatSync(filePath).isFile()) {
      if (filePath.endswith('.lhtml')) {
        // zipped directory.
        console.log('lhtml file (zipped)');
      } else {
        // unknown file type
        return;
      }
    } else {
      file_info.dir = filePath;
    }

    var ident = randomIdentifier();
    OPENFILES[ident] = file_info;
    var url = `lhtml://${ident}/index.html`;
    win.webContents.send('load-file', url);
  });
}

function reloadFile() {
  win.webContents.send('reload-file');
}

function saveApp() {
  console.log('saveApp');
}
