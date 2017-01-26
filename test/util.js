module.exports = {};


module.exports.waitUntil = function (func, interval, timeout) {
  interval = interval || 100;
  timeout = timeout || 5000;
  return new Promise((resolve, reject) => {
    let tout;
    let loop;
    var stop = () => {
      clearTimeout(tout);
      clearInterval(loop);
    }

    // timeout
    tout = setTimeout(() => {
      stop();
      reject(new Error('Timed out after ' + timeout + 'ms'));
    }, timeout);
    
    // repeatedly check
    loop = setInterval(() => {
      Promise.resolve(func())
      .then(result => {
        if (result) {
          stop();
          resolve(result);
        }
      });
    }, interval);
  })
}

module.exports.waitUntilEqual = function (func, value, interval, timeout) {
  return module.exports.waitUntil(() => {
    return Promise.resolve(func())
      .then(result => {
        return result === value;
      })
  }, interval, timeout);
}