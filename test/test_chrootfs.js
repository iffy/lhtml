var assert = require('assert');
var fs = require('fs-extra');
var Path = require('path');
const Tmp = require('tmp');
const {ChrootFS, TooBigError} = require('../chrootfs.js');


describe('ChrootFS', function() {
  let tmpdir;

  beforeEach(() => {
    tmpdir = Tmp.dirSync().name;
  });

  afterEach(() => {
    return fs.remove(tmpdir)
  });

  describe('.writeFile', function() {
    it('lets you read/write files within the chroot dir', () => {
      let chfs = new ChrootFS(tmpdir);
      return chfs.writeFile('hello', 'some contents')
      .then(result => {
        return chfs.readFile('hello');
      })
      .then(contents => {
        assert.equal(contents, 'some contents');
      });
    });

    it("Makes directories when you write to a subdirectory", () => {
      let chfs = new ChrootFS(tmpdir);
      return chfs.writeFile('a/b/c/hello', 'goober')
      .then(result => {
        return chfs.readFile('a/b/c/hello');
      })
      .then(contents => {
        assert.equal(contents, 'goober');
      })
    })

    describe('caps space', function() {
      it('with no other files', () => {
        let chfs = new ChrootFS(tmpdir, {
          maxBytes: 1000,
        });
        let contents = '';
        for (var i = 0; i < 1001; i++) {
          contents += 'A';
        }
        return chfs.writeFile('hello', contents)
          .then(() => {}, () => {})
          .then(() => {
            return chfs.readFile('hello');
          })
          .then(contents => {
            assert.equal(true, false, "Should not have returned contents");
          }, err => {
            assert.equal(true, true, "Should not have made the file");
          });
      });

      it('with subdirectories full of files', () => {
        let chfs = new ChrootFS(tmpdir, {
          maxBytes: 1000,
        });
        let contents = '';
        for (var i = 0; i < 501; i++) {
          contents += 'A';
        }

        return chfs.writeFile('something/here', contents)
          .then(() => {
            return chfs.writeFile('hello', contents)
          })
          .then(() => {}, () => {})
          .then(() => {
            return chfs.readFile('hello');
          })
          .then(contents => {
            assert.equal(true, false, "Should not have returned contents");
          }, err => {
            assert.equal(true, true, "Should not have made the file");
          });
      })
    });

    it("write can't break out of chroot with ..", () => {
      let chfs = new ChrootFS(tmpdir);
      return chfs.writeFile('../something', 'hello')
        .then(() => {
          assert.equal(true, false, "Should not have succeeded");
        })
        .catch(err => {
          assert.equal(true, true);
        });
    });

    it("write can't break out of chroot with /", () => {
      let chfs = new ChrootFS(tmpdir);
      return chfs.writeFile('/tmp/foo', 'hello')
        .then(() => {
          assert.equal(true, false, "Should not have succeeded");
        })
        .catch(err => {
          assert.equal(true, true);
        });
    });
  });

  describe('.tree', function() {
    it('allows listing the whole tree', () => {
      assert.equal(true, false, 'write me');
    })
  });

  describe('.listdir', function() {
    it('allows listing dirs/files', () => {
      assert.equal(true, false, 'write me');
    });
  });

  describe('.remove', function() {
    it('allows deleting files', () => {
      assert.equal(true, false, 'write me');
    });
    it('allows deleting directories', () => {
      assert.equal(true, false, 'write me');
    });
    it('allows deleting full directories', () => {
      assert.equal(true, false, 'write me');
    });
  })
})