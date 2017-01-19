// Copyright (c) The LHTML team
// See LICENSE for details.

const _ = require('lodash');

module.exports = {};

let observer;

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

//----------------------------------------------------
// handlers
//----------------------------------------------------
function onChange_radio(ev) {
  let node = this;
  var all_radios = document.getElementsByName(node.name);
  all_radios.forEach(radio => {
    if (radio.type === 'radio' &&
        radio.form === node.form &&
        radio.hasAttribute('checked')) {
      radio.removeAttribute('checked');
    }
  });
  node.setAttribute('checked', true);
}
function onChange_input(ev) {
  let node = this;
  node.setAttribute('value', node.value);
}
function onChange_checkbox(ev) {
  let node = this;
  if (node.checked) {
    node.setAttribute('checked', true);
  } else {
    node.removeAttribute('checked');
  }
}
function onChange_select(ev) {
  let node = this;
  node.querySelectorAll('option').forEach(option => {
    if (option.selected) {
      option.setAttribute('selected', 'true');
    } else {
      option.removeAttribute('selected');
    }
  })
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
      func(node, 'change keyup blur click', onChange_input);
    }
  } else if (node.nodeName === 'SELECT') {
    func(node, 'change', onChange_select);
  }
}

let enable = () => {
  if (observer) {
    console.log('form saving already enabled');
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
  console.log('form saving enabled');
}

let disable = () => {
  if (!observer) {
    console.log('form saving already disabled');
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

