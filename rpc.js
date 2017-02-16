// Copyright (c) The LHTML team
// See LICENSE for details.

const log = require('electron-log');

class RPCService {
  constructor(listener, options) {
    options = options || {};
    this.handlers = {};
    this.listener = listener;
    this.DEFAULT_RPC_TARGET = options.default_target || null;
    this.DEFAULT_RESPONSE_RECEIVER = options.default_receiver || null;
    this._message_id = 0;
    this._pending = {};
    this._sender_id = options.sender_id || null;
  }
  call(method, params, target) {
    target = target || this.DEFAULT_RPC_TARGET;
    if (!target) {
      throw 'No target given';
    }
    let message_id = this._message_id++;
    let message = {
      method: method,
      params: params,
      id: message_id,
    };
    if (this._sender_id) {
      message.sender_id = this._sender_id;
    }
    log.info(`RPC[${message_id}] ${message.method} call`);
    log.debug('params', params);
    return new Promise((resolve, reject) => {
      this._pending[message_id] = {
        resolve: resolve,
        reject: reject,
      };
      target.send('rpc', message)
    })
  }
  listen() {
    this.listener.on('rpc', (event, message) => {
      return this.request_received(event, message);
    });
    this.listener.on('rpc-response', (event, response) => {
      return this.response_received(event, response);
    });
    return this;
  }
  request_received(event, message) {
    log.info(`RPC[${message.id}] ${message.method} req`);
    log.debug('MESSAGE', message);
    let receiver = this.DEFAULT_RESPONSE_RECEIVER || event.sender;
    let handler = this.handlers[message.method];
    if (!handler) {
      receiver.send('rpc-response', {
        id: message.id,
        error: 'No such method: ' + message.method,
      })
    } else {
      let ctx = {
        sender_id: message.sender_id,
      }
      let response;
      try {
        response = Promise.resolve(handler(ctx, message.params))
      } catch(err) {
        response = Promise.reject(err);
      }
      return response.then((result) => {
        log.info(`RPC[${message.id}] ${message.method} done`);
        log.debug(result);
        receiver.send('rpc-response', {
          id: message.id,
          result: result,
        })
      }, (error) => {
        log.info(`RPC[${message.id}] ${message.method} error`);
        log.debug(error);
        receiver.send('rpc-response', {
          id: message.id,
          error: error,
        })
      })
    }
  }
  response_received(event, response) {
    log.info(`RPC[${response.id}] response`);
    log.debug(response);
    var handler = this._pending[response.id];
    delete this._pending[response.id];
    if (response.error) {
      handler.reject(response.error);
    } else {
      handler.resolve(response.result);
    }
  }
}

module.exports = {};
module.exports.RPCService = RPCService;
