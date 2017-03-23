var Promise = require("bluebird");
var fs = require('fs-extra');
Promise.promisifyAll(fs);
var Path = require('path');
const klaw = require('klaw');
const _ = require('lodash');

class CBPromise {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class UnsafePath extends Error {}
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

class FakeLock {
  run(func) {
    return new Promise((resolve, reject) => {
      try {
        return resolve(func())
      } catch(err) {
        reject(err);
      }
    })
  }
}


class ChrootFS {
  //
  // lock - if given, a class with a `run(func)` method that requests
  //        a file access lock for reading/writing
  // options.increaseSizePrompt - a function that will be called
  //        if a write operation would exceed the maxBytes allowed
  //        for this document.  Spec is:
  //        (requestedMaxBytes, currentMaxBytes) => { return newMaxBytes };
  //        to deny the request, return currentMaxBytes
  //        to allow the request, return requestedMaxBytes (or higher)
  constructor(path, options, lock) {
    options = options || {};
    this._root = null;
    this._tmp_root = Path.resolve(path);
    this.maxBytes = options.maxBytes || (10 * 2 ** 20);
    this.increaseSizePrompt = options.increaseSizePrompt || (() => { return this.maxBytes; });
    this.lock = lock || (new FakeLock());
  }
  setRoot(path) {
    this._root = null;
    this._tmp_root = path;
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
  _getPath(relpath) {
    // Turn a path relative to the root of the chroot
    // into an absolute-to-the-filesystem path.
    // Throws a UnsafePath if the path is outside the chroot.
    return this._getRoot()
    .then(root => {
      return safe_join(root, relpath);
    });
  }
  writeFile(path, data, ...args) {
    console.log('writeFile called', path, data, args);
    return this._getPath(path)
    .then(abspath => {
      // XXX check that the amount of data being written is okay.
      // For now, we're going to stat every file every time, but in
      // the future, perhaps we could cache some information.
      return getDirSize(this._root)
        .then(size => {
          let projected_size = size + data.length;
          if (projected_size > this.maxBytes) {
            return Promise.resolve(this.increaseSizePrompt(projected_size, this.maxBytes))
            .then(newMaxBytes => {
              if (newMaxBytes >= projected_size) {
                this.maxBytes = newMaxBytes;
                return abspath;
              } else {
                throw new TooBigError("This operation will exceed the max size of " + this.maxBytes);
              }
            })
          } else {
            return abspath;
          }
        })
    })
    .then(abspath => {
      return this.lock.run(() => {
        return new Promise((resolve, reject) => {
          fs.ensureDir(Path.dirname(abspath), (err) => {
            resolve(err)
          })
        })
        .then(() => {
          return fs.writeFileAsync(abspath, data, ...args);
        });  
      })
    });
  }
  readFile(path, ...args) {
    return this._getPath(path)
    .then(abspath => {
      return this.lock.run(() => {
        return fs.readFileAsync(abspath, ...args);
      })
    })
  }
  listdir(path, options) {
    if (_.isObject(path)) {
      options = path;
      path = undefined;
    }
    path = path || '/';
    options = options || {};
    let recursive = _.isNil(options.recursive) ? true : options.recursive;
    function listdirItem(root, path, stats) {
      let relpath = Path.relative(root, path);
      let dirname = Path.dirname(relpath);
      if (dirname === '.') {
        dirname = '';
      }
      let ret = {
        name: Path.basename(relpath),
        path: relpath,
        dir: dirname,
        size: stats.size,
      }
      if (stats.isDirectory()) {
        ret.isdir = true;
      }
      return ret;
    }
    return this._getPath(path)
    .then(abspath => {
      if (recursive) {
        return new Promise((resolve, reject) => {
          let items = [];
          klaw(abspath)
            .on('readable', function() {
              let item;
              while (item = this.read()) {
                let path = Path.relative(abspath, item.path);
                if (path === '') {
                  // root
                  continue
                }
                items.push(listdirItem(abspath, item.path, item.stats));
              }
            })
            .on('error', (err, item) => {
              console.error('error', err, item);
            })
            .on('end', () => {
              resolve(items);
            })
        });
      } else {
        // not recursive
        return fs.readdirAsync(abspath)
        .then(contents => {
          return _.map(contents, basename => {
            let path = Path.join(abspath, basename)
            let ret = listdirItem(abspath,
              path,
              fs.lstatSync(path));
            return ret;
          })
        })
      }
    })
  }
  remove(path) {
    return this._getPath(path)
    .then(abspath => {
      return this.lock.run(() => {
        return new Promise((resolve, reject) => {
          fs.remove(abspath, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve(null);
            }
          });
        });
      })
    })
  }
}

function is_string_path_within(root, child) {
  // Return true if absolute child path string is a child of absolute root path string
  // This just does string comparison.
  // You are expected to make root and child absolute.
  let relative = Path.relative(root, child);
  if (relative.startsWith('..')) {
    return false;
  } else {
    return true;
  }
}

function resolve_path(x) {
  return new Promise((resolve, reject) => {  
    fs.realpath(x, (err, resolvedPath) => {
      if (err) {
        if (err.code === "ENOENT") {
          // file does not exist
          resolve({
            exists: false,
            path: x,
            orig: x,
          });
        } else {
          // some other error
          reject(err);
        }
      } else {
        // file exists
        resolve({
          exists: true,
          path: resolvedPath,
          orig: x,
        });
      }
    })
  });
}


function safe_join() {
  let base = Path.normalize(arguments[0]);
  let rest = [].slice.call(arguments).slice(1);

  // Resolve the relative path
  rest = Path.normalize(Path.join(...rest));
  if (Path.isAbsolute(rest)) {
    rest = Path.relative('/', rest);
  }
  let alleged_path = Path.resolve(base, rest);

  let resolved_path = resolve_path(alleged_path);
  let resolved_base = resolve_path(base);

  return Promise.all([resolved_base, resolved_path])
  .then(result => {
    let r_base = result[0];
    let r_path = result[1];
    if (r_base.exists) {
      if (r_path.exists) {
        if (is_string_path_within(r_base.path, r_path.path)) {
          return r_path.orig;
        }
      } else {
        if (is_string_path_within(r_base.orig, r_path.path)
          || is_string_path_within(r_base.path, r_path.path)) {
          return r_path.path;
        }
      }
    } else {
      // root doesn't exist
      if (is_string_path_within(r_base.path, r_path.path)) {
        return r_path.path;
      }
    }
    throw new UnsafePath(r_path.orig + ' is outside base dir.');
  });
}


module.exports = {ChrootFS, TooBigError, safe_join};
