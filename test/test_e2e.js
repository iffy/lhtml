var assert = require('assert');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
const {mock, setDialogAnswer} = require('./mocks.js');
var fs = require('fs-extra');
var Path = require('path');
var {Application} = require('spectron');
const {waitUntilEqual} = require('./util.js');

const Tmp = require('tmp');
Tmp.setGracefulCleanup();

beforeEach(() => {
  chai.should()
  chai.use(chaiAsPromised)
});

function valueOf(promise) {
  return promise.then(result => {
    return result.value;
  }, err => {
    throw err;
  })
}

describe('app launch', function() {
  this.timeout(60000);
  let app;
  let tapp;

  beforeEach(() => {
    app = new Application({
      path: 'node_modules/.bin/electron',
      args: ['.', '-r', Path.join(__dirname, 'mocks.js')],
      env: {RUNNING_IN_SPECTRON: '1'},
    });
    return app.start()
      .then(() => {
        tapp = app.electron.remote.app;
      });
  });

  function openDocument(path) {
    return tapp.T_openPath(path)
    .then(() => {
      return waitUntilEqual(function() {
        return app.client.getWindowCount()
      }, 2 /* 1 for the document, 1 for the webview */)
      .then(() => {
        // Focus on the <webview>
        return app.client.windowByIndex(1);
      })
      .then(() => {
        // Hack to give documents the time to load :(
        // return new Promise((resolve, reject) => {
        //   setTimeout(function() {
        //     resolve(null);
        //   }, 2000);
        // });
      })
    })
  }

  function closeDocument() {
    return tapp.T_close()
    .then(() => {
      return waitUntilEqual(function() {
        return app.client.getWindowCount()
      }, 0)
    })
  }

  afterEach(() => {
    if (app) {
      return app.stop();
    }
  });

  it('shows an initial window', () => {
    return app.client.waitUntilWindowLoaded()
      .getWindowCount().should.eventually.equal(1);
  });

  describe('open form file', function() {
    beforeEach(() => {
      return app.client.waitUntilWindowLoaded()
      .then(() => {
        return openDocument(Path.join(__dirname, 'cases/form'))
      });
    });

    it('should close the initial window', () => {
      return app.client.getWindowCount().then(count => {
        assert.equal(count, 2 /* 1 for the window, 1 for the webview */);
      })
    });
    it('should have the form window open', () => {
      console.log('window count', app.client.getWindowCount());
      return app.client
        .getTitle().should.eventually.equal('Form Thing');
    });
  });

  //----------------------------------------------------------------------
  // saving/loading
  //----------------------------------------------------------------------
  describe('saving', function() {
    let workdir;
    beforeEach(() => {
      workdir = Tmp.dirSync({unsafeCleanup: true}).name;
    });

    describe('from LHTML dir,', function() {
      let src_dir;
      beforeEach(() => {
        src_dir = Path.join(workdir, 'src');
        fs.ensureDirSync(src_dir);
        fs.writeFileSync(Path.join(src_dir, 'index.html'),
          '<!doctype html><html><body><input id="theinput"></body></html>');
        console.log('working in', workdir);
        return openDocument(src_dir);
      })

      describe('save,', function() {
        it('should save in the dir', () => {
          return app.client
            .setValue('#theinput', 'argon')
            .then(() => {
              return app.client.windowByIndex(0);
            })
            .then(() => {
              console.log('saveFocusedDoc', tapp);
              return tapp.T_saveFocusedDoc();
            })
            .then(() => {
              console.log('close?');
              return closeDocument();
            })
            .then(() => {
              console.log('opening again', src_dir);
              return openDocument(src_dir)
            })
            .then(() => {
              return app.client
                .getValue('#theinput').should.eventually.equal('argon');
            })
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





