//
// This script is executed right when an LHTML file is loaded.
//
const {ipcRenderer} = require('electron');
const {RPCService} = require('./rpc.js');
const _ = require('lodash');

let LHTML = {};

//----------------------------------------------------------------------------
// RPCService
//----------------------------------------------------------------------------


var RPC = new RPCService(ipcRenderer, {
  default_target: ipcRenderer,
  default_receiver: ipcRenderer,
});
RPC.listen();
RPC.handlers = {
  echo: (data, cb, eb) => {
    cb('echo:' + data);
  },
  get_save_data: (data, cb, eb) => {
    if (SAVER) {
      cb(SAVER());
    }
  },
  emit_event: (data, cb, eb) => {
    var event = data.key;
    var event_data = data.data;
    _.each(EVENT_HANDLERS[data.key], (func) => {
      func(EVENT_HANDLERS[data.data]);
    });
    cb(null);
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
  console.log('defaultSaver');
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


RPC.call('echo', 'Some message')
  .then((response) => {
    console.log('echo response:', response);
  });


window.LHTML = LHTML;
console.log('LHTML finished loading');