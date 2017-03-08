const Promise = require('bluebird');
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
      sem = new IOSemaphore({save: 'single', io: 'multiple'});
      let called = [];
      let r1 = sem.acquire('save');
      assert.ok(r1.isResolved(), "Should have acquired immediately");

      let r2 = sem.acquire('save');
      assert.ok(r2.isPending(), "Should be waiting");

      sem.release('save');
      assert.ok(r2.isResolved(), "Should now acquire second one");
    })

    it('save + io should be sequential', () => {
      sem = new IOSemaphore({save: 'single', io: 'multiple'});
      let called = [];
      let r1 = sem.acquire('save');
      assert.ok(r1.isResolved(), "Should have acquired immediately");

      let r2 = sem.acquire('io');
      assert.ok(r2.isPending(), "Should be waiting");

      sem.release('save');
      assert.ok(r2.isResolved(), "Should now acquire second one");
    })

    it('io + save should be sequential', () => {
      sem = new IOSemaphore({save: 'single', io: 'multiple'});
      let called = [];
      let r1 = sem.acquire('io');
      assert.ok(r1.isResolved(), "Should have acquired immediately");

      let r2 = sem.acquire('save');
      assert.ok(r2.isPending(), "Should be waiting");

      sem.release('io');
      assert.ok(r2.isResolved(), "Should now acquire second one");
    })

    it('io + io should be parallel', () => {
      sem = new IOSemaphore({save: 'single', io: 'multiple'});
      let called = [];
      let r1 = sem.acquire('io');
      assert.ok(r1.isResolved(), "Should have acquired immediately");

      let r2 = sem.acquire('io');
      assert.ok(r2.isResolved(), "Should have acquired immediately");
    })

    it('io + io + save + io should be parallel then sequential', () => {
      sem = new IOSemaphore({save: 'single', io: 'multiple'});
      let called = [];
      let r1 = sem.acquire('io');
      assert.ok(r1.isResolved(), "Should have acquired immediately");

      let r2 = sem.acquire('io');
      assert.ok(r2.isResolved(), "Should have acquired immediately");

      let r3 = sem.acquire('save');
      assert.ok(r3.isPending(), "Should wait");

      let r4 = sem.acquire('io');
      assert.ok(r4.isPending(), "Should wait");

      sem.release('io')
      sem.release('io')
      assert.ok(r3.isResolved(), 'waiting save should be acquired');
      assert.ok(r4.isPending(), "next io should still wait")
    })

    // it('save + io should be sequential', () => {
    //   sem = new IOSemaphore({'save': 'single', 'io': 'multiple'});
    //   let called = [];
    //   let p1 = new Deferred();
    //   let r1 = sem.run('save', () => {
    //     called.push('run1');
    //     return p1.promise;
    //   });
    //   assert.ok(_.includes(called, 'run1'), "should immediately run first");

    //   sem.run('io', () => {
    //     called.push('run2');
    //   })
    //   assert.ok(!_.includes(called, 'run2'), "Should not have run second save yet");
    //   p1.resolve('run1 done')
    //   return r1.then(() => {
    //     assert.ok(_.includes(called, 'run2'), "Should run2 after run1 is done");  
    //   })
    // })

    // it('io + io should run in a parallel', () => {
    //   sem = new IOSemaphore({'save': 'single', 'io': 'multiple'});
    //   let called = [];
    //   let p1 = new Deferred();
    //   let r1 = sem.run('io', () => {
    //     called.push('run1');
    //     return p1.promise;
    //   });
    //   assert.ok(_.includes(called, 'run1'), "should immediately run first");

    //   let p2 = new Deferred();
    //   let r2 = sem.run('io', () => {
    //     called.push('run2');
    //     return p2.promise;
    //   })
    //   assert.ok(_.includes(called, 'run2'), "Should not have run second save yet");
    // })
  });
});