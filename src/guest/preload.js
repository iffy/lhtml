// Copyright (c) The LHTML team
// See LICENSE for details.

//
// This script is executed right when an LHTML file is loaded.
//
const {ipcRenderer} = require('electron');
const {RPCService} = require('../rpc.js');
const _ = require('lodash');
const formsaving = require('./formsaving.js');
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
  get_save_data: (ctx, data) => {
    var p;
    if (SAVER) {
      p = Promise.resolve(SAVER());
    } else {
      p = Promise.resolve({})
    }
    return p.then(result => {
      TMP_DOC_EDITED = false;
      SAVING = true;
      return result;
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
// Saving stuff
//---------------------------
LHTML.saving = {};
//
//  The default SAVER will emit the current content of the html page.
//
LHTML.saving.defaultSaver = () => {
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
  return {
    'index.html': doctype + document.documentElement.outerHTML,
  };
}
let SAVER = LHTML.saving.defaultSaver;
//
//  Register the function to be called when the user requests to Save.
//  The function should return an object with filenames as keys and contents
//  as the value for any files that should be completely overwritten.
//
LHTML.saving.registerSaver = (func) => {
  SAVER = func;
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
// form-saving default
//
let form_saving_enabled = true;
LHTML.saving.disableFormSaving = () => {
  form_saving_enabled = false;
  formsaving.disable();
}
window.addEventListener('load', ev => {
  if (form_saving_enabled) {
    formsaving.enable();
    formsaving.onChange((element, value) => {
      LHTML.saving.setDocumentEdited(true);
    })
  }
});

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
