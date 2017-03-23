let {BrowserWindow, app, remote} = require('electron');
const fs = require('fs-extra');
const Path = require('path');
const _ = require('lodash');

if (remote) {
  // running in a renderer process
  app = remote.app;
}

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

let PREFERENCES = {
  max_doc_size: {
    init: 10,
    sanitize: x => {
      let ret = 0;
      try {
        ret = parseInt(x);
      } catch(err) {}
      return ret < 5 ? 5 : ret;
    },
  },
}

function getDefaultPrefs() {
  return _(PREFERENCES)
  .map((value, key) => {
    return [key, value.init];
  })
  .zipObject();
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

function sanitizePref(key, value) {
  let def = PREFERENCES[key];
  if (!def) {
    // no such preference
    throw new Error(`No such preference: ${key}`);
    return;
  }
  return def.sanitize(value);
}

function sanitizePrefs(prefs) {
  let result = {};
  _.each(prefs, (v, k) => {
    try {
      result[k] = sanitizePref(k, v);
    } catch(err) {
      console.error('Error sanitizing pref:', k, err);
    }
  })
  return result;
}

module.exports = {showPreferenceWindow, getPrefValue, getDefaultPrefs, sanitizePref, sanitizePrefs};
