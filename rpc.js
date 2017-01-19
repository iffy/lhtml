// Copyright (c) The LHTML team
// See LICENSE for details.

class RPCService {
  constructor(listener, options) {
    options = options || {};
    this.handlers = {};
    this.listener = listener;
    this.DEFAULT_RPC_TARGET = options.default_target || null;
    this.DEFAULT_RESPONSE_RECEIVER = options.default_receiver || null;
    this._message_id = 0;
    this._pending = {};
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
    console.log(`RPC[${message_id}] call:`, method, params);
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
    console.log(`RPC[${message.id}] request:`, message);
    let receiver = this.DEFAULT_RESPONSE_RECEIVER || event.sender;
    let handler = this.handlers[message.method];
    if (!handler) {
      receiver.send('rpc-response', {
        id: message.id,
        error: 'No such method: ' + message.method,
      })
    } else {
      handler(
        message.params,
        (result) => {
          console.log(`RPC[${message.id}] result:`, result);
          receiver.send('rpc-response', {
            id: message.id,
            result: result,
          })
        },
        (error) => {
          console.log(`RPC[${message.id}] error:`, error);
          receiver.send('rpc-response', {
            id: message.id,
            error: error,
          })
        });
    }
  }
  response_received(event, response) {
    console.log(`RPC[${response.id}] response:`, response);
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
