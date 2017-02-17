const {dialog} = require('electron');

let dialogPath = [];

function mock() {
  dialog.showOpenDialog = (options, cb) => {
    console.log('showOpenDialog');
    cb(['foo']);
  }
}

function setDialogAnswer(answer) {
  dialogPath = answer;
}

module.exports = {mock, setDialogAnswer};