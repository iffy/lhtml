var assert = require('assert');
var fs = require('fs-extra');
var Path = require('path');
var {Application} = require('spectron');
const {waitUntil, waitUntilEqual} = require('./util.js');

describe('app launch', function() {
  this.timeout(10000);
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
    if (app && app.isRunning()) {
      return app.stop();
    } else {
      return app.exit();
    }
  });

  it('shows an initial window', () => {
    return app.client.getWindowCount().then(count => {
      assert.equal(count, 1);
    })
  });

  describe('open form file', function() {
    beforeEach(() => {
      return tapp.T_openPath(Path.join(__dirname, 'cases/form'))
      .then(() => {
        return waitUntilEqual(() => {
          return app.client.getWindowCount()
        }, 2)
      })
      .then(() => {
        return app.client.windowByIndex(1);
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
        return app.client.getTitle()
        .then(title => {
          assert.equal(title, 'Form Thing');
        });
    });
  })
})