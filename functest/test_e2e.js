var assert = require('assert');
// var chai = require('chai');
// var chaiAsPromised = require('chai-as-promised');
const {mock, setDialogAnswer, setMessageBoxAnswer} = require('./mocks.js');
var fs = require('fs-extra');
var Path = require('path');
const {app, openPath, saveFocusedDoc, saveAsFocusedDoc, saveTemplateFocusedDoc, closeFocusedDoc, reloadFocusedDoc} = require('../src/main.js');
const {waitUntil, waitUntilEqual} = require('./util.js');
const {webContents, BrowserWindow} = require('electron');
const AdmZip = require('adm-zip');

const Tmp = require('tmp');
Tmp.setGracefulCleanup();

const _ = require('lodash');

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

function readFromZip(zipfile, path) {
  let zip = new AdmZip(zipfile);
  return zip.readFile(path);
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

function reloadDocument() {
  reloadFocusedDoc()
  return waitUntil(function() {
    return _.filter(webContents.getAllWebContents(), wc => {
      return wc.isLoading();
    }).length === 0;
  })
}

assert.contains = function(haystack, needle) {
  let assertion;
  if (haystack === null || needle === null) {
    assertion = false;
  } else {
    assertion = haystack.indexOf(needle) !== -1
  }
  return assert.ok(assertion, `Expected to find\n-->${needle}<--\ninside\n-->${haystack}<--`)
}
assert.doesNotContain = function(haystack, needle) {
  let assertion;
  if (haystack === null || needle === null) {
    assertion = false;
  } else {
    assertion = haystack.indexOf(needle) === -1
  }
  return assert.ok(assertion, `Expected not to find\n-->${needle}<--\ninside\n-->${haystack}<--`);
}

describe('app launch', function() {
  this.timeout(10000);

  beforeEach(() => {
  });
  afterEach(() => {
    return closeFocusedDoc();
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
          '<html><body><input id="theinput"></body></html>');
        return openDocument(src_dir)
        .then(result => {
          webview = result.webview;
          container = result.container;
        })
      })

      it('"Save" should overwrite dir', () => {
        return executeJavaScript(webview, function() {
          return document.getElementById('theinput').setAttribute('value', 'jimbo');
        })
        .then(() => {
          return saveFocusedDoc()
        })
        .then(() => {
          assert.contains(fs.readFileSync(Path.join(src_dir, 'index.html')),
            'jimbo');
        })
        .then(() => {
          return reloadDocument()
        })
        .then(() => {
          return executeJavaScript(webview, function() {
            return document.getElementById('theinput').getAttribute('value')
          })
        })
        .then(value => {
          assert.equal(value, 'jimbo');
        })
      });

      it('"Save As" should create a new file', () => {
        let dst_file = Path.join(workdir, 'dst.lhtml');
        return executeJavaScript(webview, function() {
          return document.getElementById('theinput').setAttribute('value', 'garbage');
        })
        .then(() => {
          setDialogAnswer(dst_file)
          return saveAsFocusedDoc()
        })
        .then(() => {
          // Should not have overwritten original
          assert.doesNotContain(fs.readFileSync(Path.join(src_dir, 'index.html')),
            'garbage');
        })
        .then(() => {
          // Should have written new file
          assert.contains(readFromZip(dst_file, './index.html'), 'garbage');
        })
        .then(() => {
          return reloadDocument()
        })
        .then(() => {
          // Should be using the new file
          return executeJavaScript(webview, function() {
            return document.getElementById('theinput').getAttribute('value')
          })
        })
        .then(value => {
          assert.equal(value, 'garbage');
        })
      });

      it('"Save As Template" should make a template', () => {
        let dst_file = Path.join(workdir, 'tmpl.lhtml');
        return executeJavaScript(webview, function() {
          return document.getElementById('theinput').setAttribute('value', 'horizon');
        })
        .then(() => {
          setDialogAnswer(dst_file)
          return saveTemplateFocusedDoc()
        })
        .then(() => {
          // Should not have overwritten original
          assert.doesNotContain(fs.readFileSync(Path.join(src_dir, 'index.html')),
            'horizon')
        })
        .then(() => {
          // Should have written new file
          assert.contains(readFromZip(dst_file, './index.html'), 'horizon')
        })
        .then(() => {
          return reloadDocument()
        })
        .then(() => {
          // Should be using the old file
          return executeJavaScript(webview, function() {
            return document.getElementById('theinput').getAttribute('value')
          })
        })
        .then(value => {
          // Should have old value
          assert.equal(value, null);
        })
      });
    });

    describe('from LHTML file', function() {
      let src_file;
      let src_dir;
      let webview;
      let container;

      beforeEach(() => {
        src_file = Path.join(workdir, 'src.lhtml');
        src_dir = Path.join(workdir, 'src');
        let zip = new AdmZip();
        zip.addFile('./index.html', '<html><body><input id="theinput"></body></html>');
        zip.writeZip(src_file);

        return openDocument(src_file)
        .then(result => {
          webview = result.webview;
          container = result.container;
        })
      })

      it('"Save" should overwrite file', () => {
        return executeJavaScript(webview, function() {
          return document.getElementById('theinput').setAttribute('value', 'jimbo');
        })
        .then(() => {
          return saveFocusedDoc()
        })
        .then(() => {
          assert.contains(readFromZip(src_file, './index.html'), 'jimbo');
        })
        .then(() => {
          return reloadDocument()
        })
        .then(() => {
          return executeJavaScript(webview, function() {
            return document.getElementById('theinput').getAttribute('value')
          })
        })
        .then(value => {
          assert.equal(value, 'jimbo');
        })
      });

      it('"Save As" should create a new file', () => {
        let dst_file = Path.join(workdir, 'dst.lhtml');
        return executeJavaScript(webview, function() {
          return document.getElementById('theinput').setAttribute('value', 'garbage');
        })
        .then(() => {
          setDialogAnswer(dst_file)
          return saveAsFocusedDoc()
        })
        .then(() => {
          // Should not have overwritten original
          assert.doesNotContain(readFromZip(src_file, './index.html'), 'garbage')
        })
        .then(() => {
          // Should have written new file with data in it
          assert.contains(readFromZip(dst_file, './index.html'), 'garbage')
        })
        .then(() => {
          return reloadDocument()
        })
        .then(() => {
          // Should be using the new file
          return executeJavaScript(webview, function() {
            return document.getElementById('theinput').getAttribute('value')
          })
        })
        .then(value => {
          assert.equal(value, 'garbage');
        })
      });

      it('"Save As Template" should make a template', () => {
        let dst_file = Path.join(workdir, 'tmpl.lhtml');
        return executeJavaScript(webview, function() {
          return document.getElementById('theinput').setAttribute('value', 'horizon');
        })
        .then(() => {
          setDialogAnswer(dst_file)
          return saveTemplateFocusedDoc()
        })
        .then(() => {
          // Should not have overwritten original
          assert.doesNotContain(readFromZip(src_file, './index.html'), 'horizon')
        })
        .then(() => {
          // Should have written new file
          assert.contains(readFromZip(dst_file, './index.html'), 'horizon')
        })
        .then(() => {
          return reloadDocument()
        })
        .then(() => {
          // Should be using the old file
          return executeJavaScript(webview, function() {
            return document.getElementById('theinput').getAttribute('value')
          })
        })
        .then(value => {
          // Should have old value
          assert.equal(value, null);
        })
      });
    });
  })
})





