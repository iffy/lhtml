var {dialog} = require('electron');

let dialog_path = [];
let message_choice = 0;

dialog.showOpenDialog = (options, cb) => {
  cb(dialog_path);
}
dialog.showSaveDialog = (options, cb) => {
  cb(dialog_path);
}
dialog.showMessageBox = (options) => {
  return message_choice;
}

function setDialogAnswer(answer) {
  dialog_path = answer;
}
function setMessageBoxAnswer(answer) {
  message_choice = answer;
}

module.exports = {setDialogAnswer, setMessageBoxAnswer};
