var assert = require('assert');
var fs = require('fs-extra');
var Path = require('path');
const Tmp = require('tmp');
const ChrootFS = require('../chrootfs.js');


describe('ChrootFS', function() {
  let tmpdir;

  beforeEach(() => {
    tmpdir = Tmp.dirSync().name;
  });

  afterEach(() => {
    return fs.remove(tmpdir)
  });

  it('lets you write files within the chroot dir', () => {
    console.log('hey');
  });
})