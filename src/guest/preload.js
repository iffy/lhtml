// Copyright (c) The LHTML team
// See LICENSE for details.

//
// This script is executed right when an LHTML file is loaded.
//
const {ipcRenderer, remote} = require('electron');
const {RPCService} = require('../rpc.js');
const _ = require('lodash');
const formsync = require('./formsync.js');
const fs = require('fs-extra');
const {ChrootFS, safe_join, copy_xattr} = require('../chrootfs.js');
const {RPCLock} = require('../locks.js');
const log = require('electron-log');
const electron_is = require('electron-is');
const {getPrefValue} = require('../prefs/prefs.js');

log.transports.console.level = process.env.JS_LOGLEVEL || 'warn';

let LHTML = {};

//----------------------------------------------------------------------------
// RPCService
//----------------------------------------------------------------------------


var RPC = new RPCService(ipcRenderer, {
  default_target: ipcRenderer,
  default_receiver: ipcRenderer,
  sender_id: window.location.hostname,
});
RPC.listen();
RPC.handlers = {
  echo: (ctx, data) => {
    return 'echo:' + data;
  },
  save_your_stuff: (ctx, data) => {
    var p;
    if (LHTML.saving.onBeforeSave) {
      p = Promise.resolve(LHTML.saving.onBeforeSave());
    } else {
      console.log('no onBeforeSave');
      p = Promise.resolve({})
    }
    return p.then(() => {
      TMP_DOC_EDITED = false;
      SAVING = true;
      return;
    })
  },
  set_chrootfs_root: (ctx, new_root) => {
    if (chfs) {
      chfs.setRoot(new_root);
    }
  },
  emit_event: (ctx, data) => {
    var event = data.key;
    var event_data = data.data;
    _.each(EVENT_HANDLERS[data.key], (func) => {
      func(data.data);
    });
  }
}
let rpc_lock = new RPCLock(RPC);

//----------------------------------------------------------------------------
// Public API
//
//  Every function on LHTML is available to guest files.
//----------------------------------------------------------------------------

//
//  Register something to handle events.
//
//  Some events:
//    saved
let EVENT_HANDLERS = {};
LHTML.on = (event, handler) => {
  if (!EVENT_HANDLERS[event]) {
    EVENT_HANDLERS[event] = [];
  }
  EVENT_HANDLERS[event].push(handler);
}

//---------------------------
// FileSystem stuff
//---------------------------
LHTML.fs = {};
let chfs;
let fs_attrs = [
  'writeFile',
  'readFile',
  'remove',
  'listdir',
]
let pending = {};
_.each(fs_attrs, attr => {
  pending[attr] = [];
  LHTML.fs[attr] = (...args) => {
    return new Promise((resolve, reject) => {
      pending[attr].push({args, resolve, reject});
    })
  }
})

const MEG = 2 ** 20;

function ceilToNearest(x, nearest) {
  return Math.ceil(x/nearest)*nearest;
}

let maxBytes = (parseInt(getPrefValue('max_doc_size')) * MEG);
maxBytes = maxBytes < (5 * MEG) ? (5 * MEG) : maxBytes;

function increaseSizePrompt(requestedSize, currentMaxBytes) {
  let currentmax_MB = Math.ceil(currentMaxBytes / MEG);
  let requested_MB = Math.ceil(requestedSize / MEG);
  let reasonable_MB = ceilToNearest(requested_MB * 1.1, 5);
  let message = `Do you want to allow this document to take ${reasonable_MB}MB of space?`
  let detail = `The document is requesting ${requested_MB}MB which exceeds the current limit of ${currentmax_MB}MB (set in Preferences).`;
  return new Promise((resolve, reject) => {
    remote.dialog.showMessageBox(remote.getCurrentWindow(), {
      type: 'question',
      message: message,
      detail: detail,
      buttons: [
        "No",
        `Allow ${reasonable_MB}MB for now`,
      ],
      defaultId: 0,
      cancelId: 0,
    }, response => {
      if (response === 1) {
        // Allow size increase temporarily
        maxBytes = reasonable_MB * MEG;
      }
      resolve(maxBytes);
    })
  });
}

window.addEventListener('load', () => {
  RPC.call('get_chrootfs_root')
  .then(chrootfs_root => {
    chfs = new ChrootFS(chrootfs_root, {
      maxBytes: maxBytes,
      increaseSizePrompt: increaseSizePrompt,
    }, rpc_lock);
    _.each(fs_attrs, attr => {
      LHTML.fs[attr] = (...args) => {
        return chfs[attr](...args);
      }
      // Give an answer to all the pended ones
      _.each(pending[attr], pended => {
        let {args, resolve, reject} = pended;
        try {
          resolve(chfs[attr](...args))
        } catch(err) {
          reject(err);
        }
      })
    })
    delete pending;
  });
})

//---------------------------
// Saving stuff
//---------------------------

//---------------------------
// Saving stuff
//---------------------------
LHTML.saving = {};
//
// Perform any writing that needs to happen before saving.
//
LHTML.saving.onBeforeSave = () => {
  // Thanks http://stackoverflow.com/questions/6088972/get-doctype-of-an-html-as-string-with-javascript/10162353#10162353
  let doctype = '';
  let node = document.doctype;
  if (node) {
    doctype = "<!DOCTYPE "
      + node.name
      + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '')
      + (!node.publicId && node.systemId ? ' SYSTEM' : '') 
      + (node.systemId ? ' "' + node.systemId + '"' : '')
      + '>';
  }
  return LHTML.fs.writeFile('/index.html',
    doctype + document.documentElement.outerHTML)
}
//
//  Save the current file.
//
LHTML.saving.save = () => {
  return RPC.call('save');
}
let DOC_EDITED = false;
let TMP_DOC_EDITED = false;
let SAVING = false;
LHTML.saving.setDocumentEdited = (edited) => {
  edited = !!edited;
  if (SAVING) {
    // A save has been started but not yet finished
    if (edited) {
      // An edit has happened since saving
      TMP_DOC_EDITED = true;
    } else {
      // There are no edits since saving.
      TMP_DOC_EDITED = false;
    }
  } else {
    if (DOC_EDITED !== edited) {
      DOC_EDITED = edited;
      return RPC.call('set_document_edited', !!edited);  
    } else {
      // Nothing has changed since the last time you called.
      return Promise.resolve(edited);
    }
  }
}
LHTML.on('saved', () => {
  SAVING = false;
  // Whatever the edited status was set to during saving is the
  // status it is now.
  DOC_EDITED = TMP_DOC_EDITED;
  RPC.call('set_document_edited', DOC_EDITED);
})
LHTML.on('save-failed', () => {
  SAVING = false;
  // If the document was edited before saving OR if it was edited
  // during saving, the current status is true (the doc is edited)
  DOC_EDITED = DOC_EDITED || TMP_DOC_EDITED;
  RPC.call('set_document_edited', DOC_EDITED);
})

//
// export a file outside the document
//
LHTML.saving.exportFile = (filename, content, encoding) => {
  let ev = window.event;
  return new Promise((resolve, reject) => {
    if (!ev || ev.type !== 'click') {
      // For (over)protection, at this point, downloads can
      // only be initiated within an event.
      throw new Error("exportFile may only be called in response to clicks");
    }
    safe_join(remote.app.getPath('downloads'), filename)
    .then(path => {
      return new Promise((resolve, reject) => {
        remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
          defaultPath: path,
        }, filename => {
          if (filename) {
            resolve(filename);
          } else {
            reject(null);
          }
        });
      })
    })
    .then(filename => {
      // actually save the file
      return fs.writeFileAsync(filename, content, {encoding})
      .then(() => {
        return filename;
      });
    })
    .then(filename => {
      // copy extended attribute over
      return RPC.call('get_document_path')
      .then(source_file => {
        return copy_xattr(source_file, filename)
        .then(() => {
          return filename;
        });  
      });
    })
    .then(filename => {
      resolve({filename});
    }, err => {
      reject(err);
    })
  })
}

//
// form-sync default
//
let form_sync_enabled = true;
LHTML.saving.disableFormSync = () => {
  form_sync_enabled = false;
  formsync.disable();
}
window.addEventListener('load', ev => {
  if (form_sync_enabled) {
    formsync.enable();
    formsync.onChange((element, value) => {
      LHTML.saving.setDocumentEdited(true);
    })
  }
});

//
// Suggest that the document be of a certain size (in pixels)
//
LHTML.suggestSize = (width, height) => {
  return RPC.call('suggest_size', {
    width: width,
    height: height,
  });
}

window.LHTML = LHTML;
console.log('[LHTML] loaded');
