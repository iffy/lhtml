const Promise = require('bluebird');


class IOSemaphore {
  //
  // groups is an object whose keys are group names
  // and whose values are one of:
  //  'single' - to only allow one thing to run at a time
  //  'multiple' - to allow multiple things of the same group
  //               to run at the same time.
  constructor(groups) {
    this.flag_holder = null;
    this.flags_held = 0;
    this.groups = groups
    this.queue = [];
  }
  acquire(group) {
    return new Promise((resolve, reject) => {
      this.queue.push({group, resolve, reject});
      this.pump();
    })
  }
  release(group) {
    if (!this.flag_holder || this.flag_holder !== group) {
      throw new Error("Trying to release a job that wasn't acquired.")
    }
    this.flags_held -= 1;
    if (this.flags_held === 0) {
      // done with all jobs of this type
      this.flag_holder = null;
      this.pump();
    }
  }
  pump() {
    if (!this.queue.length) {
      return;
    }
    if (!this.flag_holder) {
      // nothing is running
      this._serviceNext();
      this.pump();
    } else {
      // something is running
      let flag_group_type = this.groups[this.flag_holder] || 'single';
      if (flag_group_type === 'multiple') {
        // the currently running thing allows parallel running
        if (this.flag_holder === this.queue[0].group) {
          // next thing is in matching group
          this._serviceNext();
          this.pump();
        }
      }
    }
  }
  _serviceNext() {
    let acquiree = this.queue.shift();
    this.flag_holder = acquiree.group;
    this.flags_held += 1;
    acquiree.resolve(true);
  }
}

module.exports = {IOSemaphore};
