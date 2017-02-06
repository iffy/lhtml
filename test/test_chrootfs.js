var assert = require('assert');
var fs = require('fs-extra');
var Path = require('path');
const _ = require('lodash');
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

  describe('.listdir', function() {
    it('lists recursively by default', () => {
      let chfs = new ChrootFS(tmpdir);
      fs.writeFileSync(Path.join(tmpdir, 'a.txt'), 'a contents');
      fs.writeFileSync(Path.join(tmpdir, 'b.txt'), 'b contents');
      fs.ensureDirSync(Path.join(tmpdir, 'sub'))
      fs.writeFileSync(Path.join(tmpdir, 'sub/c.txt'), 'c contents');
      fs.writeFileSync(Path.join(tmpdir, 'sub/d.txt'), 'd contents');
      return chfs.listdir()
        .then(contents => {
          assert.equal(contents.length, 5);
          _.each(contents, file => {
            if (file.name === 'a.txt') {
              assert.equal(file.path, 'a.txt');
              assert.equal(file.dir, '');
              assert.equal(file.size, 'a contents'.length);
            } else if (file.name === 'b.txt') {
              assert.equal(file.path, 'b.txt');
              assert.equal(file.dir, '');
              assert.equal(file.size, 'b contents'.length);
            } else if (file.name === 'sub') {
              assert.equal(file.path, 'sub');
              assert.equal(file.dir, '');
              assert.equal(file.isdir, true);
            } else if (file.name === 'c.txt') {
              assert.equal(file.path, 'sub/c.txt');
              assert.equal(file.dir, 'sub');
              assert.equal(file.size, 'c contents'.length);
            } else if (file.name === 'd.txt') {
              assert.equal(file.path, 'sub/d.txt');
              assert.equal(file.dir, 'sub');
              assert.equal(file.size, 'd contents'.length);
            } else {
              assert.equal(true, false, "Unexpected file: " + file.name);
            }
          })
        });
    })
  });

  describe('.remove', function() {
    it('deletes files', () => {
      let chfs = new ChrootFS(tmpdir);
      fs.writeFileSync(Path.join(tmpdir, 'a.txt'), 'a contents');
      return chfs.remove('a.txt')
        .then(() => {
          return chfs.listdir();
        })
        .then(contents => {
          assert.equal(contents.length, 0);
        });
    });
    it('deletes directories', () => {
      let chfs = new ChrootFS(tmpdir);
      fs.ensureDirSync(Path.join(tmpdir, 'subdir'));
      return chfs.remove('subdir')
        .then(() => {
          return chfs.listdir();
        })
        .then(contents => {
          assert.equal(contents.length, 0);
        });
    });
    it('deletes full directories', () => {
      let chfs = new ChrootFS(tmpdir);
      fs.ensureDirSync(Path.join(tmpdir, 'subdir'));
      fs.writeFileSync(Path.join(tmpdir, 'subdir/a.txt'), 'a contents');
      return chfs.remove('subdir')
        .then(() => {
          return chfs.listdir();
        })
        .then(contents => {
          assert.equal(contents.length, 0);
        });
    });
  })
})