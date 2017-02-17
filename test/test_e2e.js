var assert = require('assert');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
const {mock, setDialogAnswer} = require('./mocks.js');
var fs = require('fs-extra');
var Path = require('path');
var {Application} = require('spectron');

const Tmp = require('tmp');
Tmp.setGracefulCleanup();

beforeEach(() => {
  chai.should()
  chai.use(chaiAsPromised)
});

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
        return tapp.T_openPath(Path.join(__dirname, 'cases/form'))
        .then(() => {
          return app.client
            .getWindowCount().should.eventually.equal(2);    
        })  
      })
      
    });

    // BUG: Spectron seems to still think the window is there
    //      even though I can't see it.
    // it('should close the initial window', () => {
    //   return app.client.getWindowCount().then(count => {
    //     assert.equal(count, 1);
    //   })
    // });
    it('should have the form window open', () => {
      console.log('window count', app.client.getWindowCount());
      return app.client
        .windowByIndex(1)
        .getTitle().should.eventually.equal('Form Thing');
    });
  });

  //----------------------------------------------------------------------
  // saving/loading
  //----------------------------------------------------------------------
  // describe('saving', function() {
  //   let workdir;
  //   beforeEach(() => {
  //     workdir = Tmp.dirSync({unsafeCleanup: true}).name;
  //   });

  //   describe('from LHTML dir', function() {
  //     let src_dir;
  //     beforeEach(() => {
  //       src_dir = Path.join(workdir, 'src');
  //       fs.ensureDirSync(src_dir);
  //       fs.writeFileSync(Path.join(src_dir, 'index.html'),
  //         '<html><body><input id="theinput"></body></html>');
  //       console.log('working in', workdir);
  //       return tapp.T_openPath(src_dir)
  //       .then(() => {
  //         return waitUntilEqual(() => {
  //           return app.client.getWindowCount()
  //         }, 2)
  //       })
  //       .then(() => {
  //         // focus on the second window
  //         return app.client.windowByIndex(1);
  //       })
  //     })

  //     describe('save', function() {
  //       it('save', () => {
  //         assert.equal('foo', 'bar');
  //       });
  //     });
  //     describe('save to file', function() {

  //     });
  //     describe('save as', function() {

  //     });
  //     describe('save as template', function() {

  //     });
  //   });

  //   describe('from LHTML file', function() {
  //     describe('save', function() {

  //     });
  //     describe('save as', function() {

  //     });
  //     describe('save as template', function() {

  //     });
  //   });
  // })
})





