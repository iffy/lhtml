// Copyright (c) The LHTML team
// See LICENSE for details.

const _ = require('lodash');

module.exports = {};

let observer;
let change_handlers = [];

function addMultiListener(node, events, listener) {
  events.split(' ').forEach(event => {
    node.addEventListener(event, listener, false);
  });
}
function removeMultiListener(node, events, listener) {
  events.split(' ').forEach(event => {
    node.removeEventListener(event, listener, false);
  });
}
function emitChange(element, value) {
  _.each(change_handlers, handler => {
    handler({
      element: element,
      value: value,
    });
  })
}

class ChangeList {
  constructor() {
    this._changes = [];
  }
  flush() {
    _.each(this._changes, change => {
      emitChange(change[0], change[1]);
    })
  }
  add(element, value) {
    this._changes.push([element, value]);
  }
}

//----------------------------------------------------
// handlers
//----------------------------------------------------
function onChange_radio(ev) {
  let node = this;
  let changes = new ChangeList();
  var all_radios = document.getElementsByName(node.name);
  all_radios.forEach(radio => {
    if (radio.type === 'radio' &&
        radio.form === node.form &&
        radio.hasAttribute('checked') &&
        radio !== node) {
      changes.add(radio, false);
      radio.removeAttribute('checked');
    }
  });
  if (!node.hasAttribute('checked')) {
    changes.add(node, true);
  }
  node.setAttribute('checked', true);
  changes.flush();
}
function onChange_input(ev) {
  let node = this;
  let changes = new ChangeList();
  if ('' + node.getAttribute('value') !== '' + node.value) {
    changes.add(node, node.value);
  }
  node.setAttribute('value', node.value);
  changes.flush();
}
function onChange_checkbox(ev) {
  let node = this;
  if (node.checked) {
    node.setAttribute('checked', true);
    emitChange(node, true);
  } else {
    node.removeAttribute('checked');
    emitChange(node, false);
  }
}
function onChange_select(ev) {
  let node = this;
  let changes = new ChangeList();
  node.querySelectorAll('option').forEach(option => {
    if (option.selected) {
      if (!option.hasAttribute('selected')) {
        changes.add(option, true);
        option.setAttribute('selected', 'true');  
      }
    } else {
      if (option.hasAttribute('selected')) {
        changes.add(option, false);
        option.removeAttribute('selected'); 
      }
    }
  });
  changes.flush();
}

//----------------------------------------------------
// mirror
//----------------------------------------------------
function adjustValueToAttributeMirroring(node, action) {
  let func = action === 'remove' ? removeMultiListener : addMultiListener;
  if (node.nodeName === 'INPUT') {
    if (node.type === 'checkbox') {
      func(node, 'change', onChange_checkbox);
    } else if (node.type === 'radio') {
      func(node, 'change', onChange_radio);
    } else {
      func(node, 'change keyup', onChange_input);
    }
  } else if (node.nodeName === 'SELECT') {
    func(node, 'change', onChange_select);
  }
}

let onChange = (func) => {
  change_handlers.push(func);
}

let enable = () => {
  if (observer) {
    console.log('LHTML: form saving already enabled');
    return;
  }
  observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          adjustValueToAttributeMirroring(node, 'add');
        })
      }
    })
  });
  // Catch all existing elements
  _.each(document.getElementsByTagName('input'), (elem) => {
    adjustValueToAttributeMirroring(elem, 'add');
  });
  _.each(document.getElementsByTagName('select'), (elem) => {
    adjustValueToAttributeMirroring(elem, 'add');
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  console.log('LHTML: form saving enabled');
}

let disable = () => {
  if (!observer) {
    console.log('LHTML: form saving already disabled');
    return;
  }
  observer.disconnect();
  _.each(document.getElementsByTagName('input'), (elem) => {
    adjustValueToAttributeMirroring(elem, 'remove');
  });
  _.each(document.getElementsByTagName('select'), (elem) => {
    adjustValueToAttributeMirroring(elem, 'remove');
  });
  observer = null;
}

module.exports.enable = enable;
module.exports.disable = disable;
module.exports.onChange = onChange;

