var assert = require('assert');
var Application = require('spectron').Application;

describe('app launch', function() {
  this.timeout(10000);

  beforeEach(() => {
    this.app = new Application({
      path: 'node_modules/.bin/electron',
      args: ['.'],
    });
    return this.app.start();
  });

  afterEach(() => {
    if (this.app && this.app.isRunning()) {
      return this.app.stop();
    }
  });

  it('shows an initial window', () => {
    return this.app.client.getWindowCount().then(count => {
      assert.equal(count, 1);
    })
  })
})