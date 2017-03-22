const {BrowserWindow, app} = require('electron');
const fs = require('fs-extra');
const Path = require('path');

let win;

function settingsFilename() {
  let userdatapath = app.getPath('userData');
  return Path.join(userdatapath, 'preferences.json');
}

function showPreferenceWindow() {
  if (win) {
    win.focus();
    return win;
  }
  win = new BrowserWindow({
    width: 300,
    height: 100,
    resizable: false,
    show: false,
  });
  win.on('ready-to-show', () => {
    win.show();
  })
  win.on('closed', () => {
    win = null;
  });
  win.on('focus', () => {
  })
  win.loadURL(`file://${__dirname}/prefs.html#${settingsFilename()}`);
  return win;
}

function getDefaultPrefs() {
  return {
    max_doc_size: 10,  
  }
}

function getPrefValue(key) {
  // XXX cache this
  let current_settings = getDefaultPrefs();
  try {
    current_settings = fs.readJsonSync(settingsFilename())
  } catch(err) {
    console.info('Error reading preferences.json:', err);
  }
  return current_settings[key];
}

module.exports = {showPreferenceWindow, getPrefValue, getDefaultPrefs};
