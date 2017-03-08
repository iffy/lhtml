const assert = require('assert');
const _ = require('lodash');
const {IOSemaphore} = require('../src/locks.js');

class Deferred {
  constructor() {
    this.done = false;
    this.is_error = false;
    this.result = null;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (arg) => {
        this.done = true;
        this.result = arg;
        this.is_error = false;
        resolve(arg);
      }
      this.reject = (err) => {
        this.done = true;
        this.result = err;
        this.is_error = true;
        reject(err);
      }
    })
  }
}

describe('IOSemaphore', function() {
  describe('basically', function() {
    let sem;
    it('saves should be sequential', () => {
      sem = new IOSemaphore({'save': 'single'});
      let called = [];
      let p1 = new Deferred();
      let r1 = sem.run('save', () => {
        called.push('run1');
        return p1.promise;
      });
      assert.ok(r1 instanceof Promise, "run should return promise");
      assert.ok(_.includes(called, 'run1'), "should immediately run first");

      sem.run('save', () => {
        called.push('run2');
      })
      assert.ok(!_.includes(called, 'run2'), "Should not have run second save yet");
      p1.resolve('run1 done')
      return r1.then(() => {
        assert.ok(_.includes(called, 'run2'), "Should run2 after run1 is done");  
      })
    })

    it('save + io should be sequential', () => {
      sem = new IOSemaphore({'save': 'single', 'io': 'multiple'});
      let called = [];
      let p1 = new Deferred();
      let r1 = sem.run('save', () => {
        called.push('run1');
        return p1.promise;
      });
      assert.ok(_.includes(called, 'run1'), "should immediately run first");

      sem.run('io', () => {
        called.push('run2');
      })
      assert.ok(!_.includes(called, 'run2'), "Should not have run second save yet");
      p1.resolve('run1 done')
      return r1.then(() => {
        assert.ok(_.includes(called, 'run2'), "Should run2 after run1 is done");  
      })
    })

    it('io + io should run in a parallel', () => {
      sem = new IOSemaphore({'save': 'single', 'io': 'multiple'});
      let called = [];
      let p1 = new Deferred();
      let r1 = sem.run('io', () => {
        called.push('run1');
        return p1.promise;
      });
      assert.ok(_.includes(called, 'run1'), "should immediately run first");

      let p2 = new Deferred();
      let r2 = sem.run('io', () => {
        called.push('run2');
        return p2.promise;
      })
      assert.ok(_.includes(called, 'run2'), "Should not have run second save yet");
    })
  });
});