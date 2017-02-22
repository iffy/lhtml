const {dialog} = require('electron');

let dialog_path = [];
let message_choice = 0;

function mock() {
  dialog.showOpenDialog = (options, cb) => {
    console.log('mocked showOpenDialog', options);
    cb(dialog_path);
  }
  dialog.showSaveDialog = (options, cb) => {
    console.log('mocked showSaveDialog', options);
    cb(dialog_path);
  }
  dialog.showMessageBox = (options) => {
    console.log('mocked showMessageBox', options);
    return message_choice;
  }
}

function setDialogAnswer(answer) {
  dialog_path = answer;
}
function setMessageBoxAnswer(answer) {
  message_choice = answer;
}

module.exports = {mock, setDialogAnswer, setMessageBoxAnswer};