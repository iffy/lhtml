// Copyright (c) The LHTML team
// See LICENSE for details.

//
// This script is executed right when an LHTML file is loaded.
//
const {ipcRenderer} = require('electron');
const {RPCService} = require('../rpc.js');
const _ = require('lodash');
const formsync = require('./formsync.js');
const {ChrootFS} = require('../chrootfs.js');

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
      p = Promise.resolve({})
    }
    return p.then(() => {
      TMP_DOC_EDITED = false;
      SAVING = true;
      return;
    })
  },
  set_chrootfs_root: (ctx, new_root) => {
    console.log('setting new root to', new_root);
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

window.addEventListener('load', () => {
  RPC.call('get_chrootfs_root')
  .then(chrootfs_root => {
    chfs = new ChrootFS(chrootfs_root);
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
console.log('LHTML: finished loading');
