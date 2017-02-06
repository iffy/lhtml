var fs = require('fs-extra');
var Path = require('path');
const _ = require('lodash');

class CBPromise {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class OutsideChrootError extends Error {}
class TooBigError extends Error {}

// Get the current size being taken by a directory.
function getDirSize(path) {
  // Adapted from http://stackoverflow.com/questions/7529228/how-to-get-totalsize-of-files-in-directory
  return new Promise((resolve, reject) => {
    fs.lstat(path, (err, stats) => {
      if (err) {
        reject(err)
      } else if (stats.isDirectory()) {
        let total = stats.size;
        fs.readdir(path, (err, list) => {
          if (err) {
            reject(err);
          } else {
            Promise.all(_.map(list, subdir => {
              return getDirSize(Path.join(path, subdir));
            }))
              .then(sizes => {
                resolve(_.sum(sizes) + total);
              })
              .catch(err => {
                reject(err);
              })
          }
        });
      } else {
        resolve(stats.size);
      }
    })
  })
}

class ChrootFS {
  constructor(path, options) {
    options = options || {};
    this._root = null;
    this._tmp_root = Path.resolve(path);
    this.maxBytes = options.maxBytes || (10 * 2 ** 20);
  }
  _getRoot() {
    if (this._root) {
      return Promise.resolve(this._root);
    } else {
      return new Promise((resolve, reject) => {
        fs.realpath(this._tmp_root, (err, resolvedPath) => {
          if (err) {
            reject(err);
          } else {
            this._root = resolvedPath;
            resolve(this._root);
          }
        })
      })
    }
  }
  _isWithin(root, child) {
    // Return true if child path string is a child of root path string
    // This just does string comparison.
    if (root === child || (root + Path.sep) === child || root === (child + Path.sep)) {
      return true;
    } else if (child.startsWith(root + Path.sep)) {
      return true;
    } else {
      return false
    }
  }
  _getPath(relpath) {
    // Turn a path relative to the root of the chroot
    // into an absolute-to-the-filesystem path.
    // Throws a OutsideChrootError if the path is outside the chroot.
    return this._getRoot()
    .then(root => {
      let cautionarypath = Path.resolve(this._root, Path.normalize(relpath));
      if (!this._isWithin(this._root, cautionarypath)) {
        return Promise.reject(new OutsideChrootError(relpath));
      } else {
        // cautionarypath is definitely inside _root, but let's make
        // sure it's not a symlink pointing outside root.
        return new Promise((resolve, reject) => {
          fs.realpath(cautionarypath, (err, resolvedPath) => {
            if (err) {
              if (err.code === "ENOENT") {
                // file doesn't exist
                // Since this file doesn't exist and we already know
                // the path is within the _root, it's safe
                resolve(cautionarypath);
              } else {
                console.log('unknown err.code', err.code);
                console.log('err', err);
                reject(err);
              }
            } else {
              if (this._isWithin(this._root, resolvedPath)) {
                resolve(resolvedPath);
              } else {
                reject(new OutsideChrootError(relpath));
              }
            }
          });
        });
      }
    });
  }
  writeFile(path, contents) {
    return this._getPath(path)
    .then(abspath => {
      // XXX check that the amount of data being written is okay.
      // For now, we're going to stat every file every time, but in
      // the future, perhaps we could cache some information.
      return getDirSize(this._root)
        .then(size => {
          let projected_size = size + contents.length;
          if (projected_size > this.maxBytes) {
            throw new TooBigError("This operation will exceed the max size of " + this.maxBytes);
          } else {
            return abspath;
          }
        })
    })
    .then(abspath => {
      return new Promise((resolve, reject) => {
        fs.ensureDir(Path.dirname(abspath), (err) => {
          resolve(err)
        })
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          fs.writeFile(abspath, contents, null, (err) => {
            resolve(err);
          });  
        })
      });
    });
  }
  readFile(path) {
    return this._getPath(path)
    .then(abspath => {
      return new Promise((resolve, reject) => {
        fs.readFile(abspath, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }); 
      })
    })
  }
}


module.exports = {ChrootFS, TooBigError};
