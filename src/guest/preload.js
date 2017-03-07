// Copyright (c) The LHTML team
// See LICENSE for details.

//
// This script is executed right when an LHTML file is loaded.
//
const {ipcRenderer} = require('electron');
const {RPCService} = require('../rpc.js');
const _ = require('lodash');
const formsaving = require('./formsaving.js');

/**
 * LHTML namespace.
 *
 * @namespace
 */
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


/**
 * Listen for LHTML events.
 * 
 * Possible events are:
 * 
 * | Event | Description |
 * |---|---|
 * | `saved` | Emitted after the document has been saved.  Handler is called with no arguments. |
 * | `save-failed` | Emitted if an attempted save fails.  The handler is called with a string description. |
 *
 * @example
 * window.LHTML && LHTML.on('saved', function() {
 *     console.log('The file was saved!');
 * })
 * window.LHTML && LHTML.on('save-failed', function() {
 *     console.log('Save failed :(');
 * })
 *
 * @param      {string}    event    Event name.  Will be one of: <tt>saved</tt>,
 *                                  <tt>save-failed</tt>
 * @param      {function}  handler  Function that will be called with the event.
 */   
LHTML.on = (event, handler) => {
  if (!EVENT_HANDLERS[event]) {
    EVENT_HANDLERS[event] = [];
  }
  EVENT_HANDLERS[event].push(handler);
}

//---------------------------
// Saving stuff
//---------------------------

/**
 * Saving-related functions.  See also {@link LHTML.fs}.
 *
 * @namespace
 */
LHTML.saving = {};

/**
 * This is the saving function used by default (if none is provided by calling
 * {@link LHTML.saving.registerSaver}). It will take the current state of
 * `index.html` and overwrite `index.html` within the LHTML zip.
 *
 *
 * For usage, see {@link LHTML.saving.registerSaver}'s usage.
 *
 * @return     {Object}  an object conforming to what {@link
 *                       LHTML.saving.registerSaver} expects.
 */
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

/**
 * Registers a function to be called when the application is to be saved.
 * By default {@link LHTML.saving.defaultSaver} is used.
 * 
 * The registered function is expected to return on object whose keys
 * are filenames and whose values are file contents.
 * 
 * @example
 * // Register a saver that will save index.html in its current state
 * // and write some data to somedata.json within the LHTML zip.
 * window.LHTML && LHTML.saving.registerSaver(function() {
 *  var files = LHTML.saving.defaultSaver();
 *  files['somedata.json'] = '{"foo": "bar"}';
 *  return files;
 * })
 *
 * @param      {function}  func    The function that will be called on save.
 */
LHTML.saving.registerSaver = (func) => {
  SAVER = func;
}

/**
 * Initiate a save of the current file.
 *
 * @example
 * window.LHTML && LHTML.saving.save().then(function() {
 *     console.log('saved');
 * })
 *
 * @return     {Promise}  A promise that will fire once the document has been
 *                        successfully saved.
 */
LHTML.saving.save = () => {
  return RPC.call('save');
}
let DOC_EDITED = false;
let TMP_DOC_EDITED = false;
let SAVING = false;
/**
 * Indicate that the document has unsaved changes.
 *
 * If form-saving is enabled (which it is by default)
 * then document edited state is handled automatically.
 * This function is mostly useful for documents with
 * form-saving disabled.
 * 
 * Calling this function sets the edited state
 * of the current document.  Before closing an edited document,
 * the application will prompt the user to save.
 * 
 * Call this with `true` to prevent closing without a prompt.
 * Call this with `false` if there are no changes to be saved.
 * 
 * Also, every time a document is saved, the edited state is automatically reset to `false`.
 *
 * @example
 * window.LHTML && LHTML.saving.setDocumentEdited(true);
 *
 * @param {boolean} edited - Status to set
 */
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

let form_saving_enabled = true;
/**
 * Disables form saving.
 *
 * A common use case for LHTML files is to present an HTML form.  Therefore, by
 * default data entered into forms will be saved.  If you want to disable this
 * auto-saving (because you're using a framework like React or Angular) call
 * {@link LHTML.saving.disableFormSaving()}.
 *
 * @example
 * <body>
 *     <!-- disable form saving -->
 *     <script>window.LHTML && LHTML.saving.disableFormSaving();</script>
 *     Name: <input name="name">
 *     Email: <input type="email" name="email">
 *     Favorite color: <select>
 *         <option>Red</option>
 *         <option>Blue</option>
 *     </select>
 * </body>
 */
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
/**
 * File system functions.  See also {@link LHTML.saving}.
 *
 * @namespace
 */
LHTML.fs = {};

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
