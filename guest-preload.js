//
// This script is executed right when an LHTML file is loaded.
//
let LHTML = {};

const {ipcRenderer} = require('electron');
ipcRenderer.on('ping', () => {
  ipcRenderer.sendToHost('pong');
});

let _rpc_id = 0;
let _pending_rpc_responses = {};

function RPC(method, params) {
  let msg_id = _rpc_id++;
  return new Promise((resolve, reject) => {
    _pending_rpc_responses[msg_id] = {
      resolve: resolve,
      reject: reject,
    };
    ipcRenderer.send('rpc', {
      method: method,
      params: params,
      id: msg_id,
    });
  });
}

ipcRenderer.on('rpc-response', (event, data) => {
  if (data.error) {
    _pending_rpc_responses[data.id].reject(data.error);
  } else {
    _pending_rpc_responses[data.id].resolve(data.result);
  }
})

//----------------------------------------------------------------------------
// Public API
//
//  Every function on LHTML is available to guest files.
//----------------------------------------------------------------------------

let SAVER;

//
//  Register the function to be called when the user requests to Save.
//  The function should return an object with filenames as keys and contents
//  as the value for any files that should be completely overwritten.
//
LHTML.registerSaver = (func) => {
  SAVER = func;
}

//
//  Write a file to the filesystem
//
LHTML.writeFile = (relpath, content) => {
  ipcRenderer.sendToHost('save_file', {
    path: relpath,
    content: content,
  });
}

//
//  Read the entire contents of a file from the filesystem
//
LHTML.readFile = (relpath) => {

}


window.LHTML = LHTML;