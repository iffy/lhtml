// Copyright (c) The LHTML team
// See LICENSE for details.

//
// This script is executed right when an LHTML file is loaded.
//
const {ipcRenderer} = require('electron');
const {RPCService} = require('../rpc.js');
const _ = require('lodash');
const formsaving = require('./formsaving.js');

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
    if (SAVER) {
      return SAVER();
    }
  },
  emit_event: (ctx, data) => {
    var event = data.key;
    var event_data = data.data;
    _.each(EVENT_HANDLERS[data.key], (func) => {
      func(EVENT_HANDLERS[data.data]);
    });
  }
}

//----------------------------------------------------------------------------
// Public API
//
//  Every function on LHTML is available to guest files.
//----------------------------------------------------------------------------

//
//  The default SAVER will emit the current content of the html page.
//
LHTML.defaultSaver = () => {
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

let SAVER = LHTML.defaultSaver;

//
//  Register the function to be called when the user requests to Save.
//  The function should return an object with filenames as keys and contents
//  as the value for any files that should be completely overwritten.
//
LHTML.registerSaver = (func) => {
  SAVER = func;
}

//
//  Save the current file.
//
LHTML.save = () => {
  return RPC.call('save');
}

LHTML.setDocumentEdited = (edited) => {
  return RPC.call('set_document_edited', !!edited);
}


//---------------------------
// FileSystem stuff
//---------------------------
LHTML.fs = {};
//
//  Overwrite file
//
LHTML.fs.writeFile = (path, data) => {
  return RPC.call('writeFile', {
    path: path,
    data: data,
  });
}
//
//  Read the contents of a file.
//
LHTML.fs.readFile = (path) => {
  return RPC.call('readFile', path);
}
//
//  Delete a file/directory
//
LHTML.fs.remove = (path) => {
  return RPC.call('remove', path);
}
//
//  List contents of directory
//
LHTML.fs.listdir = (path) => {
  return RPC.call('listdir', path);
}


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

//
// form-saving default
//
let form_saving_enabled = true;
LHTML.disableFormSaving = () => {
  form_saving_enabled = false;
  formsaving.disable();
}
window.addEventListener('load', ev => {
  if (form_saving_enabled) {
    formsaving.enable();
    formsaving.onChange((element, value) => {
      LHTML.setDocumentEdited(true);
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
