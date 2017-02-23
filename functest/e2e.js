const assert = require('assert');
const {setDialogAnswer, setMessageBoxAnswer} = require('./mocks.js');
const fs = require('fs-extra');
const Path = require('path');
const {waitUntilEqual} = require('./util.js');
const Mocha = require('mocha');
const {app} = require('../src/main.js');

const Tmp = require('tmp');
Tmp.setGracefulCleanup();

app.on('ready', function() {
  let mocha = new Mocha();
  let testDir = 'functest';
  fs.readdirSync(testDir).filter(function(file){
    // Only keep the .js files
    return file.substr(-3) === '.js' && Path.basename(file).startsWith('test_');
  }).forEach(function(file){
      mocha.addFile(
          Path.join(testDir, file)
      );
  });

  mocha.run(function(failures){
    process.on('exit', function () {
      process.exit(failures && 1);  // exit with non-zero status if there were failures
    });
    process.exit(0);
  });
})
