var assert = require('assert');
// var chai = require('chai');
// var chaiAsPromised = require('chai-as-promised');
const {mock, setDialogAnswer, setMessageBoxAnswer} = require('./mocks.js');
var fs = require('fs-extra');
var Path = require('path');
const {app, openPath, saveFocusedDoc, closeFocusedDoc, reloadFocusedDoc} = require('../src/main.js');
const {waitUntil, waitUntilEqual} = require('./util.js');
const {webContents, BrowserWindow} = require('electron');

const Tmp = require('tmp');
Tmp.setGracefulCleanup();

const _ = require('lodash');

// beforeEach(() => {
//   chai.should()
//   chai.use(chaiAsPromised)
// });

function _wrapFunction(func) {
  if (_.isFunction(func)) {
    return `(function() {
      try {
        return (${func.toString()})();
      } catch(err) {
        return {executeJavaScriptError:err.toString()};
      }
    })()`;
  }
  return func;
}

function executeJavaScript(web, func) {
  let code = _wrapFunction(func)
  return web.executeJavaScript(code, /* because of issue 8743 */()=>{})
  .then(result => {
    if (result && result.executeJavaScriptError) {
      throw new Error(result.executeJavaScriptError);
    }
    return result;
  })
  .catch(err => {
    console.log('error', err);
  })
}

function openDocument(path) {
  openPath(path);
  return waitUntil(function() {
    return BrowserWindow.getAllWindows().length == 1;
  })
  .then(() => {
    return waitUntil(function() {
      return webContents.getAllWebContents().length == 2;
    })
  })
  .then(() => {
    return waitUntil(function() {
      return _.filter(webContents.getAllWebContents(), wc => {
        return wc.isLoading();
      }).length === 0;
    })
  })
  .then(() => {
    let webview;
    let container;
    _.each(webContents.getAllWebContents(), wc => {
      if (wc.getURL().startsWith('lhtml://')) {
        webview = wc;
      } else {
        container = wc;
      }
    })
    return {
      webview: webview,
      container: container,
    }
  })
}

describe('app launch', function() {
  this.timeout(10000);

  beforeEach(() => {
  });
  afterEach(() => {
    closeFocusedDoc();
  });

  //----------------------------------------------------------------------
  // saving/loading
  //----------------------------------------------------------------------
  describe('saving', function() {
    let workdir;
    beforeEach(() => {
      workdir = Tmp.dirSync({unsafeCleanup: true}).name;
      console.log('working in', workdir);
    });

    describe('from LHTML dir,', function() {
      let src_dir;
      let webview;
      let container;

      beforeEach(() => {
        src_dir = Path.join(workdir, 'src');
        fs.ensureDirSync(src_dir);
        fs.writeFileSync(Path.join(src_dir, 'index.html'),
          '<!doctype html><html><body><input id="theinput"></body></html>');
        return openDocument(src_dir)
        .then(result => {
          webview = result.webview;
          container = result.container;
        })
      })

      describe('save,', function() {
        it('should save in the dir', () => {
          return executeJavaScript(webview, function() {
            return document.getElementById('theinput').setAttribute('value', 'jimbo');
          })
          .then(() => {
            return saveFocusedDoc()
          })
          .then(() => {
            assert.equal(true,
              fs.readFileSync(Path.join(src_dir, 'index.html')).indexOf('jimbo') !== -1);
          })
          .then(() => {
            reloadFocusedDoc()
            return waitUntil(() => {
              return webview.isLoading() === false;
            });
          })
          .then(() => {
            console.log('done reloading?');
          })
          // .then(() => {
          //   console.log('save result', result);
          // })
          // saveFocusedDoc()
          // .then()
          // return app.client
          //   .setValue('#theinput', 'argon')
          //   .then(() => {
          //     return app.client.windowByIndex(0);
          //   })
          //   .then(() => {
          //     console.log('saveFocusedDoc', tapp);
          //     return tapp.T_saveFocusedDoc();
          //   })
          //   .then(() => {
          //     console.log('close?');
          //     return closeDocument();
          //   })
          //   .then(() => {
          //     console.log('opening again', src_dir);
          //     return openDocument(src_dir)
          //   })
          //   .then(() => {
          //     return app.client
          //       .getValue('#theinput').should.eventually.equal('argon');
          //   })
        });
      });
      describe('save to file', function() {

      });
      describe('save as', function() {

      });
      describe('save as template', function() {

      });
    });

    describe('from LHTML file', function() {
      describe('save', function() {

      });
      describe('save as', function() {

      });
      describe('save as template', function() {

      });
    });
  })
})





