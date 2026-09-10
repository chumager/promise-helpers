/* eslint-disable mocha/no-hooks */
/* eslint-disable mocha/no-synchronous-tests */
import {errors, functions, wrapper, createError} from "../src/promise-helpers.js";
createError("TestTimeError", "", "TEST_ERROR", {});
const {
  PromiseTimeoutError,
  PromiseIterableError,
  PromiseTimeoutDefaultError,
  PromiseKeyNotFound,
  PromiseMaxIterationsError,
  PromiseMapError,
  PromiseForEachError,
  PromiseSequenceError,
  PromiseWaterfallError,
  PromiseReduceError,
  PromiseFindError,
  PromiseSomeError,
  PromiseCallableError,
  PromiseTimersCoherenceError,
  TestTimeError
} = errors;
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSubset from "chai-subset";
chai.use(chaiAsPromised);
chai.use(chaiSubset);
chai.should();
function checkTiming(start, expectedDuration, tolerance = 2) {
  const elapsed = Date.now() - start;
  if (Math.abs(elapsed - expectedDuration) > tolerance) {
    throw createError(
      "CheckTiming",
      `Expected ~${expectedDuration}ms but took ${elapsed}ms (tolerance: ±${tolerance}ms)`
    );
  }
  return true;
}

describe("Test", function () {
  this.slow(1);

  beforeEach(function () {
    this.localPromise = class extends Promise {};
    this.currentTest.normalArray = [1, 2, 3, 4, 5];
    this.currentTest.resultNormalArray = [2, 4, 6, 8, 10];
    this.currentTest.resultMultiplyById = this.currentTest.normalArray.map((v, id) => v * id);
    this.currentTest.promiseArray = this.currentTest.normalArray.map(v => this.localPromise.resolve(v));
    this.currentTest.promiseArrayInnerReject = [...this.currentTest.promiseArray];
    this.currentTest.promiseArrayInnerReject[2] = this.localPromise.reject("ERROR");
    Promise.all(this.currentTest.promiseArrayInnerReject).catch(() => true);
  });

  describe("LocalPromise", function () {
    it("resolves", function () {
      return this.localPromise.resolve(10).should.eventually.be.eq(10);
    });

    it("rejects", function () {
      return this.localPromise.reject(10).should.eventually.be.rejectedWith(10);
    });

    it("new resolves", function () {
      return new this.localPromise(res => res(10)).should.eventually.be.eq(10);
    });

    it("new rejects", function () {
      return new this.localPromise((res, rej) => rej(10)).should.eventually.be.rejectedWith(10);
    });

    it("resolve has no delay", function () {
      return this.localPromise.resolve(10).should.not.have.property("delay");
    });

    it("resolve has no atLeast", function () {
      return this.localPromise.resolve(10).should.not.have.property("atLeast");
    });
  });

  describe("Delay", function () {
    beforeEach(function () {
      functions.delay(this.localPromise);
    });
    let timer = 10;

    it(`static ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise.delay(timer).should.be.fulfilled.then(() => checkTiming(start, timer));
    });

    it(`static with function${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer, () => 1)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`static with function returning promise ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer, () => this.localPromise.resolve(1))
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`static chained 5x2ms = ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(2)
        .delay(2)
        .delay(2)
        .delay(2)
        .delay(2)
        .should.be.fulfilled.then(() => checkTiming(start, timer, 5));
    });

    it("static with rejected value", function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer, this.localPromise.reject("ERROR"))
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it("static with rejected function", function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer, () => this.localPromise.reject("ERROR"))
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it("static with thrown sync function", function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer, () => {
          throw "ERROR";
        })
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it("method 100ms", function () {
      const start = Date.now();
      return this.localPromise
        .resolve(1)
        .delay(timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it("method with function 100ms", function () {
      const start = Date.now();
      return this.localPromise
        .resolve(() => 1)
        .delay(timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it("method with function returning promise 100ms", function () {
      const start = Date.now();
      return this.localPromise
        .resolve(() => this.localPromise.resolve(1))
        .delay(timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it("method chained 5x2ms", function () {
      const start = Date.now();
      return this.localPromise
        .resolve(1)
        .delay(2)
        .delay(2)
        .delay(2)
        .delay(2)
        .delay(2)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it("method after rejection in chain", function () {
      const start = Date.now();
      return this.localPromise
        .reject("ERROR")
        .delay(timer)
        .delay(timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it("reject after delay, with delay chains after", function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer)
        .then(() => this.localPromise.reject("ERROR"))
        .delay(timer)
        .delay(timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, timer));
    });

    it("reject chained with several delays of 100ms", function () {
      const start = Date.now();
      return this.localPromise
        .reject("ERROR")
        .delay(100)
        .delay(100)
        .delay(100)
        .delay(100)
        .delay(100)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it("resolved promise chained with delay 5x2ms", function () {
      const start = Date.now();
      return this.localPromise
        .resolve("test")
        .delay(2)
        .delay(2)
        .delay(2)
        .delay(2)
        .delay(2)
        .should.eventually.be.equal("test")
        .then(() => checkTiming(start, timer, 5));
    });

    it("chain in for loop 5x2ms", function () {
      const start = Date.now();
      let res = this.localPromise.resolve("test");
      for (let i = 0; i < 5; i++) {
        res = res.delay(2);
      }
      return res.should.eventually.be.equal("test").then(() => checkTiming(start, timer));
    });

    it(`Promise.all wth 5x${timer}ms delay each`, function () {
      const start = Date.now();
      const arr = [...Array(5).keys()];
      const res = this.localPromise.all(arr.map(v => this.localPromise.resolve(v).delay(timer)));
      return res.should.eventually.be.eql(arr).then(() => checkTiming(start, timer));
    });
  });

  describe("AtLeast", function () {
    beforeEach(function () {
      functions.atLeast(this.localPromise);
    });
    let timer = 10;

    it(`static ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .atLeast(1, timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`static with function ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .atLeast(() => 1, timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`static with function returning promise ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .atLeast(() => this.localPromise.resolve(1), timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`static chained 5x${timer}ms = ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .atLeast(true, timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .should.be.fulfilled.then(() => checkTiming(start, timer));
    });

    it("static with rejected value", function () {
      const start = Date.now();
      return this.localPromise
        .atLeast(this.localPromise.reject("ERROR"), timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it("static with rejected function", function () {
      const start = Date.now();
      return this.localPromise
        .atLeast(() => this.localPromise.reject("ERROR"), timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it("static with thrown sync function", function () {
      const start = Date.now();
      return this.localPromise
        .atLeast(() => {
          throw "ERROR";
        }, timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it(`method ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(1)
        .atLeast(timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`method with function ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(() => 1)
        .atLeast(timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`method with function returning promise ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(() => this.localPromise.resolve(1))
        .atLeast(timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it(`method chained 5x${timer}ms = ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(1)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer));
    });

    it("after rejection", function () {
      const start = Date.now();
      return this.localPromise
        .reject("ERROR")
        .atLeast(timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it(`reject chained with several atLeasts of ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .reject("ERROR")
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it(`atLeast chain 5x${timer}ms = ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve("test")
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .atLeast(timer)
        .should.eventually.be.equal("test")
        .then(() => checkTiming(start, timer));
    });

    it(`chain in for loop 5x${timer}ms = ${timer}ms`, function () {
      const start = Date.now();
      let res = this.localPromise.resolve("test");
      for (let i = 0; i < 5; i++) {
        res = res.atLeast(timer);
      }
      return res.should.eventually.be.equal("test").then(() => checkTiming(start, timer));
    });

    it(`Promise.all wth 5x20ms atLeast each`, function () {
      const start = Date.now();
      const arr = [...Array(5).keys()];
      const res = this.localPromise.all(arr.map(v => this.localPromise.resolve(v).atLeast(20)));
      return res.should.eventually.be.eql(arr).then(() => checkTiming(start, 20));
    });
  });

  describe("Timeout", function () {
    beforeEach(function () {
      functions.timeout(this.localPromise);
    });
    let timer = 10;

    it(`resolves before ${timer}ms using delay`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer / 2)
        .timeout(timer)
        .should.be.fulfilled.then(() => checkTiming(start, timer / 2));
    });

    it("behaves well with rejection", function () {
      const start = Date.now();
      return this.localPromise
        .reject(false)
        .timeout(timer)
        .should.be.rejectedWith(false)
        .then(() => checkTiming(start, 1));
    });

    it("rejected with timeout chain", function () {
      return this.localPromise.reject(false).timeout(100).timeout(200).should.be.rejectedWith(false);
    });

    it(`rejects after ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer * 6)
        .timeout(timer)
        .should.be.rejected.then(() => checkTiming(start, timer));
    });

    it(`timeout error is PromiseTimeoutError after ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer * 2)
        .timeout(timer)
        .should.be.rejectedWith(PromiseTimeoutError)
        .then(() => checkTiming(start, timer));
    });

    it(`static with delay ${timer / 2}ms timeout ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .timeout(this.localPromise.delay(timer / 2, 42), timer)
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer / 2));
    });

    it(`static with function ${timer / 2}ms timeout ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .timeout(() => this.localPromise.delay(timer / 2, 42), timer)
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer / 2));
    });

    it(`static with function returning promise ${timer / 2}ms timeout ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .timeout(() => this.localPromise.delay(timer / 2).then(() => 42), timer)
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer / 2));
    });

    it("static with thrown sync function", function () {
      const start = Date.now();
      return this.localPromise
        .timeout(() => {
          throw "ERROR";
        }, timer)
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it(`method ${timer / 2}ms timeout ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer / 2, 42)
        .timeout(timer)
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer / 2));
    });

    it(`timeout exact edge case ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer, 42)
        .timeout(timer)
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer));
    });

    it("behaves well in chained incremental timeouts", function () {
      return this.localPromise
        .delay(timer * 2)
        .timeout(timer)
        .timeout(timer * 2)
        .timeout(timer * 3)
        .timeout(timer * 4)
        .timeout(timer * 5)
        .should.be.eventually.rejectedWith(PromiseTimeoutError)
        .with.nested.property("args.time", timer);
    });

    it("timeout behaves well in chained decremental timeouts", function () {
      return this.localPromise
        .delay(timer * 2)
        .timeout(timer * 5)
        .timeout(timer * 4)
        .timeout(timer * 3)
        .timeout(timer * 2)
        .timeout(timer * 1)
        .should.be.eventually.rejectedWith(PromiseTimeoutError)
        .with.nested.property("args.time", timer);
    });

    it(`timeout with cancelable promise ${timer}ms`, function () {
      const start = Date.now();
      let cancelled = false;
      const cancelablePromise = new this.localPromise(resolve => {
        setTimeout(() => resolve(42), timer * 2);
      });
      cancelablePromise.cancel = () => {
        cancelled = true;
      };

      return this.localPromise
        .timeout(cancelablePromise, timer)
        .should.be.rejectedWith(PromiseTimeoutError)
        .then(() => {
          checkTiming(start, timer);
          cancelled.should.be.true;
        });
    });
  });

  describe("TimeoutDefault", function () {
    beforeEach(function () {
      functions.timeoutDefault(this.localPromise);
    });
    let timer = 10;

    it("rejects correctly when no default", function () {
      const start = Date.now();
      return this.localPromise
        .resolve()
        .timeoutDefault(timer)
        .should.be.rejectedWith(PromiseTimeoutDefaultError)
        .then(() => checkTiming(start, 1));
    });

    it(`timeout in ${timer}ms and returns true as default`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer * 2)
        .timeoutDefault(timer, true)
        .should.eventually.be.eq(true)
        .then(() => checkTiming(start, timer));
    });

    it("rejects and forces to return default", function () {
      const start = Date.now();
      return this.localPromise
        .reject(false)
        .timeoutDefault(timer, true, true)
        .should.eventually.be.eq(true)
        .then(() => checkTiming(start, 1));
    });

    it(`static with delay ${timer / 2}ms timeout ${timer}ms returns value`, function () {
      const start = Date.now();
      return this.localPromise
        .timeoutDefault(this.localPromise.delay(timer / 2, 42), timer, "default")
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer / 2));
    });

    it(`static with function ${timer / 2}ms timeout ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .timeoutDefault(() => this.localPromise.delay(timer / 2, 42), timer, "default")
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer / 2));
    });

    it(`static timeout ${timer}ms returns default`, function () {
      const start = Date.now();
      return this.localPromise
        .timeoutDefault(() => this.localPromise.delay(timer * 2, 42), timer, "default")
        .should.eventually.be.eq("default")
        .then(() => checkTiming(start, timer));
    });

    it(`method ${timer / 2}ms timeout ${timer}ms returns value`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer / 2, 42)
        .timeoutDefault(timer, "default")
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer / 2));
    });

    it(`method timeout ${timer}ms returns default`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer * 2, 42)
        .timeoutDefault(timer, "default")
        .should.eventually.be.eq("default")
        .then(() => checkTiming(start, timer));
    });

    it(`method with rejection force default`, function () {
      const start = Date.now();
      return this.localPromise
        .reject("ERROR")
        .timeoutDefault(timer, "default", true)
        .should.eventually.be.eq("default")
        .then(() => checkTiming(start, 1));
    });

    it(`method timeout then delay`, function () {
      const start = Date.now();
      return this.localPromise
        .delay(timer * 2, 42)
        .timeoutDefault(timer, "default")
        .should.eventually.be.eq("default")
        .then(() => checkTiming(start, timer));
    });
  });

  describe("AttachTimers", function () {
    beforeEach(function () {
      functions.attachTimers(this.localPromise);
    });
    let timer = 10;

    it(`delay only ${timer * 2}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {delay: timer * 2})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 2));
    });

    it(`atLeast only ${timer * 2}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {atLeast: timer * 2})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 2));
    });

    it(`timeout only ${timer * 10}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {timeout: timer * 10})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, 1));
    });

    it(`delay ${timer}ms + atLeast ${timer * 2}ms = ${timer * 3}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {delay: timer, atLeast: timer * 2})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 3));
    });

    it(`delay ${timer * 2}ms + timeout ${timer * 10}ms = ${timer * 2}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {delay: timer * 2, timeout: timer * 10})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 2));
    });

    it(`atLeast ${timer * 2}ms + timeout ${timer * 10}ms = ${timer * 2}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {atLeast: timer * 2, timeout: timer * 10})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 2));
    });

    it(`delay ${timer}ms + atLeast ${timer * 2}ms + timeout ${timer * 10}ms = ${timer * 3}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {delay: timer, atLeast: timer * 2, timeout: timer * 10})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 3));
    });

    it(`rejects when timeout ${timer * 0.5}ms <= atLeast ${timer}ms`, function () {
      return this.localPromise
        .attachTimers(this.localPromise.resolve(42), {atLeast: timer, timeout: timer * 0.5})
        .should.be.rejectedWith(PromiseTimersCoherenceError);
    });

    // Comprehensive edge case tests requested by user
    it(`slow promise ${timer * 2}ms + atLeast ${timer}ms = ${timer * 2}ms`, function () {
      const start = Date.now();
      const slowPromise = new this.localPromise(resolve => {
        setTimeout(() => resolve(42), timer * 2);
      });

      return this.localPromise
        .attachTimers(slowPromise, {atLeast: timer})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 2, 5));
    });

    it(`fast promise + atLeast ${timer}ms = ${timer}ms`, function () {
      const start = Date.now();
      const fastPromise = this.localPromise.resolve(42);

      return this.localPromise
        .attachTimers(fastPromise, {atLeast: timer})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer));
    });

    it(`promise ${timer * 3}ms + atLeast ${timer}ms + timeout ${timer * 2}ms = timeout at ${timer * 2}ms`, function () {
      const start = Date.now();
      const slowPromise = new this.localPromise(resolve => {
        setTimeout(() => resolve(42), timer * 3);
      });

      return this.localPromise
        .attachTimers(slowPromise, {atLeast: timer, timeout: timer * 2})
        .should.be.rejectedWith(PromiseTimeoutError)
        .then(() => checkTiming(start, timer * 2, 5));
    });

    it(`fast promise + delay ${timer * 1.5}ms + timeout ${timer}ms = ${timer * 1.5}ms (no timeout)`, function () {
      const start = Date.now();
      const promise = this.localPromise.resolve(42);

      return this.localPromise
        .attachTimers(promise, {delay: timer * 1.5, timeout: timer})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 1.5, 5));
    });

    it(`promise ${timer * 5}ms + atLeast ${timer}ms + timeout ${timer * 2}ms = timeout at ${timer * 2}ms`, function () {
      const start = Date.now();
      const verySlowPromise = new this.localPromise(resolve => {
        setTimeout(() => resolve(42), timer * 5);
      });

      return this.localPromise
        .attachTimers(verySlowPromise, {atLeast: timer, timeout: timer * 2})
        .should.be.rejectedWith(PromiseTimeoutError)
        .then(() => checkTiming(start, timer * 2, 5));
    });

    it(`fast promise + delay ${timer * 1.2}ms + atLeast ${timer * 0.5}ms + timeout ${timer}ms = ${timer * 1.7}ms (no timeout)`, function () {
      const start = Date.now();
      const promise = this.localPromise.resolve(42);

      return this.localPromise
        .attachTimers(promise, {delay: timer * 1.2, atLeast: timer * 0.5, timeout: timer})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 1.7, 5));
    });

    it(`chained attachTimers: delay ${timer * 5}ms then atLeast ${timer * 10}ms = ${timer * 15}ms`, function () {
      const start = Date.now();
      const promise = this.localPromise.resolve(42);

      return this.localPromise
        .attachTimers(promise, {delay: timer * 5})
        .then(result => this.localPromise.attachTimers(result, {atLeast: timer * 10}))
        .then(result => {
          result.should.eq(42);
          checkTiming(start, timer * 15, 5);
        });
    });

    it(`rejected promise + delay ${timer * 5}ms + atLeast ${timer * 3}ms = immediate rejection`, function () {
      const start = Date.now();
      const rejectedPromise = this.localPromise.reject(new Error("TEST_ERROR"));

      return this.localPromise.attachTimers(rejectedPromise, {delay: timer * 5, atLeast: timer * 3}).then(
        () => {
          throw new Error("Should have rejected");
        },
        err => {
          checkTiming(start, 1);
          err.message.should.eq("TEST_ERROR");
        }
      );
    });

    it(`promise ${timer}ms + timeout ${timer * 1.5}ms = ${timer}ms (no timeout)`, function () {
      const start = Date.now();
      const promise = new this.localPromise(resolve => {
        setTimeout(() => resolve(42), timer);
      });

      return this.localPromise
        .attachTimers(promise, {timeout: timer * 1.5})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer, 3));
    });

    it(`zero values delay 0ms + atLeast 0ms + timeout ${timer * 100}ms = ~0ms`, function () {
      const start = Date.now();
      const promise = this.localPromise.resolve(42);

      return this.localPromise
        .attachTimers(promise, {delay: 0, atLeast: 0, timeout: timer * 100})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, 0, 10));
    });

    it(`parallel timing: 5 promises with delay ${timer * 2}ms + atLeast ${timer * 1.5}ms = ${timer * 3.5}ms`, function () {
      const start = Date.now();
      const promises = Array.from({length: 5}, (_, i) =>
        this.localPromise.resolve(i).attachTimers({delay: timer * 2, atLeast: timer * 1.5})
      );

      return this.localPromise
        .all(promises)
        .should.eventually.deep.equal([0, 1, 2, 3, 4])
        .then(() => checkTiming(start, timer * 3.5, 5));
    });

    it(`coherence validation: atLeast ${timer}ms === timeout ${timer}ms should reject`, function () {
      const promise = this.localPromise.resolve(42);
      return this.localPromise
        .attachTimers(promise, {atLeast: timer, timeout: timer})
        .should.be.rejectedWith(PromiseTimersCoherenceError);
    });

    it(`fast promise + atLeast ${timer * 1.5}ms + timeout ${timer}ms = coherence error`, function () {
      const promise = this.localPromise.resolve(42);
      return this.localPromise
        .attachTimers(promise, {atLeast: timer * 1.5, timeout: timer})
        .should.be.rejectedWith(PromiseTimersCoherenceError);
    });

    it(`promise ${timer * 1.5}ms + timeout ${timer}ms = timeout at ${timer}ms`, function () {
      const start = Date.now();
      const slowPromise = new this.localPromise(resolve => {
        setTimeout(() => resolve(42), timer * 1.5);
      });

      return this.localPromise
        .attachTimers(slowPromise, {timeout: timer})
        .should.be.rejectedWith(PromiseTimeoutError)
        .then(() => checkTiming(start, timer, 3));
    });

    // Additional comprehensive tests following Delay/AtLeast/Timeout pattern
    it(`static with function returning promise delay ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(() => this.localPromise.delay(timer / 2, 42), {delay: timer})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer + timer / 2, 3));
    });

    it(`static with rejected function`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(() => this.localPromise.reject("ERROR"), {delay: timer, atLeast: timer * 2})
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it(`static with thrown sync function`, function () {
      const start = Date.now();
      return this.localPromise
        .attachTimers(
          () => {
            throw "ERROR";
          },
          {delay: timer}
        )
        .should.eventually.be.rejectedWith("ERROR")
        .then(() => checkTiming(start, 1));
    });

    it(`method chaining with different timers`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(42)
        .attachTimers({delay: timer})
        .attachTimers({atLeast: timer * 2})
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, timer * 2, 5));
    });

    it(`Promise.all with multiple attachTimers`, function () {
      const start = Date.now();
      const promises = Array.from({length: 3}, (_, i) =>
        this.localPromise.attachTimers(this.localPromise.resolve(i), {delay: timer, atLeast: timer * 2})
      );
      return this.localPromise
        .all(promises)
        .should.eventually.deep.equal([0, 1, 2])
        .then(() => checkTiming(start, timer * 3, 5));
    });
  });

  describe("Wrapper", function () {
    beforeEach(function () {
      wrapper("add", {
        Static(prom, toAdd) {
          return this.resolve(prom).then(val => val + toAdd);
        }
      })(this.localPromise);
    });

    it("wraps an add function that adds a value to result", function () {
      return typeof this.localPromise.add == "function" && typeof this.localPromise.resolve(5).add === "function";
    });

    it("static add", function () {
      return this.localPromise.add(5, 5).should.eventually.be.eq(10);
    });

    it("method add", function () {
      return this.localPromise.resolve(5).add(5).should.eventually.be.eq(10);
    });
  });

  describe("Map", function () {
    beforeEach(function () {
      functions.map(this.localPromise);
    });
    let timer = 10;

    it("array of numbers and multipliy by 2", function () {
      return this.localPromise
        .map(this.test.normalArray, v => v * 2)
        .should.eventually.be.eql(this.test.resultNormalArray);
    });

    it(`array of numbers and multipliy by id with inverted delay returns well in around ${timer * 3}ms, parallel false`, function () {
      const start = Date.now();
      return this.localPromise
        .map(
          this.test.normalArray,
          async (v, id) => {
            return await this.localPromise.resolve(v * id).delay(timer);
          },
          {parallel: false}
        )
        .should.eventually.be.eql(this.test.resultMultiplyById)
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`array of numbers and multipliy by id with inverted delay in parallel returns well in around ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .map(
          this.test.normalArray,
          async (v, id) => {
            return await this.localPromise.resolve(v * id).delay(timer);
          },
          {parallel: true}
        )
        .should.eventually.be.eql(this.test.resultMultiplyById)
        .then(() => checkTiming(start, timer));
    });

    it("promise array of numbers and multipliy by 2", function () {
      return this.localPromise
        .resolve(this.test.normalArray)
        .map(v => v * 2)
        .should.eventually.be.eql(this.test.resultNormalArray);
    });

    it("array of promises of numbers and multipliy by 2", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map(v => v * 2)
        .should.eventually.be.eql(this.test.resultNormalArray);
    });

    it("array of promises of numbers and multipliy by id", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map((v, id) => v * id)
        .should.eventually.be.eql(this.test.resultMultiplyById);
    });

    it("array of promises and return array[id]", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map((v, id, arr) => arr[id])
        .should.eventually.be.eql(this.test.normalArray);
    });

    it("maps array of promises and multipliy by id, the third rejected", function () {
      return this.localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .map((v, id) => v * id)
        .should.eventually.be.rejectedWith(PromiseMapError)
        .with.property("args")
        .to.include({err: "ERROR", id: 2, iterable: this.test.promiseArrayInnerReject});
    });

    it("maps array of promises and multipliy by id, the third rejected with cachtError false", function () {
      return this.localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .map((v, id) => v * id, {catchError: false})
        .should.eventually.be.eql([0, 2, "ERROR", 12, 20]);
    });

    it("maps array of promises and multipliy by id, if result > 5 the callbacks throws, \
with parallel false", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map(
          async (v, id) => {
            const res = v * id;
            if (res > 5) throw "ERROR";
            return res;
          },
          {parallel: false}
        )
        .should.eventually.be.rejectedWith(PromiseMapError)
        .with.nested.property("args.err", "ERROR");
    });

    it("maps array of promises and multipliy by id, if result > 10 \
the callbacks throws with catchError false", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map(
          async (v, id) => {
            const res = v * id;
            if (res > 10) throw "ERROR";
            return res;
          },
          {catchError: false}
        )
        .should.eventually.be.rejectedWith("ERROR");
    });

    it("maps array of promises and multipliy by id, if result > 10 \
the callbacks throws with catchError false and parallel false", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map(
          async (v, id) => {
            const res = v * id;
            if (res > 10) throw "ERROR";
            return res;
          },
          {catchError: false, parallel: false}
        )
        .should.eventually.be.eql([0, 2, 6, "ERROR", "ERROR"]);
    });

    it(`map with rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .map((v, id) => v * id)
        .should.eventually.be.rejectedWith(PromiseMapError)
        .then(() => checkTiming(start, 1));
    });

    it(`map with callback rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(this.test.normalArray)
        .map((v, id) => {
          if (id === 2) throw "ERROR";
          return v * id;
        })
        .should.eventually.be.rejectedWith(PromiseMapError)
        .then(() => checkTiming(start, 1));
    });

    it(`map with delay option ${timer}ms parallel`, function () {
      const start = Date.now();
      return this.localPromise
        .map(this.test.normalArray, v => v * 2, {delay: timer})
        .should.eventually.be.eql(this.test.resultNormalArray)
        .then(() => checkTiming(start, timer));
    });

    it(`map with delay option ${timer}ms sequential`, function () {
      const start = Date.now();
      return this.localPromise
        .map(this.test.normalArray, v => v * 2, {delay: timer, parallel: false})
        .should.eventually.be.eql(this.test.resultNormalArray)
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`map with atLeast option ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .map(this.test.normalArray, v => v * 2, {atLeast: timer})
        .should.eventually.be.eql(this.test.resultNormalArray)
        .then(() => checkTiming(start, timer));
    });

    it(`map with timeout option ${timer}ms should timeout`, function () {
      const start = Date.now();
      return this.localPromise
        .map(this.test.normalArray, v => this.localPromise.delay(timer * 3, v * 2), {timeout: timer})
        .should.eventually.be.rejectedWith(PromiseMapError)
        .then(() => checkTiming(start, timer));
    });

    it(`map chaining with timing verification ${timer * 2}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .map(this.test.normalArray, v => this.localPromise.delay(timer, v * 2))
        .map(v => v + 1)
        .should.eventually.be.eql([3, 5, 7, 9, 11])
        .then(() => checkTiming(start, timer));
    });

    it("map with invalid iterable should reject", function () {
      const start = Date.now();
      return this.localPromise
        .map(null, v => v * 2)
        .should.eventually.be.rejectedWith(PromiseMapError)
        .then(() => checkTiming(start, 1));
    });
  });

  describe("Filter", function () {
    beforeEach(function () {
      functions.filter(this.localPromise);
    });
    let timer = 10;

    it("array of numbers keeping the even ones", function () {
      return this.localPromise.filter(this.test.normalArray, v => v % 2 === 0).should.eventually.be.eql([2, 4]);
    });

    it("keeps the element, not the callback result", function () {
      return this.localPromise.filter(this.test.normalArray, () => "truthy").should.eventually.be.eql(this.test.normalArray);
    });

    it("keeps falsy elements when the callback is truthy", function () {
      return this.localPromise.filter([0, null, "", false], () => true).should.eventually.be.eql([0, null, "", false]);
    });

    it("empty array returns empty", function () {
      return this.localPromise.filter([], () => true).should.eventually.be.eql([]);
    });

    it("nothing passes returns empty", function () {
      return this.localPromise.filter(this.test.normalArray, () => false).should.eventually.be.eql([]);
    });

    it("undefined from the callback excludes", function () {
      return this.localPromise.filter(this.test.normalArray, v => (v > 3 ? true : undefined)).should.eventually.be.eql([4, 5]);
    });

    it("async callback", function () {
      return this.localPromise
        .filter(this.test.normalArray, async v => v > 3)
        .should.eventually.be.eql([4, 5]);
    });

    it("promise array of numbers keeping the even ones", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .filter(v => v % 2 === 0)
        .should.eventually.be.eql([2, 4]);
    });

    it("array of promises, callback receives id and iterable", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .filter((v, id, arr) => arr.length === this.test.normalArray.length && id < 2)
        .should.eventually.be.eql([1, 2]);
    });

    it(`filters with delay in parallel, around ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .filter(this.test.normalArray, async v => v > 2, {parallel: true, delay: timer})
        .should.eventually.be.eql([3, 4, 5])
        .then(() => checkTiming(start, timer, 5));
    });

    it(`filters with delay sequentially, around ${timer * 5}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .filter(this.test.normalArray, async v => v > 2, {parallel: false, delay: timer})
        .should.eventually.be.eql([3, 4, 5])
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it("rejects with PromiseFilterError when the callback throws", function () {
      return this.localPromise
        .filter(this.test.normalArray, v => {
          if (v === 3) throw new Error("ERROR");
          return true;
        })
        .should.eventually.be.rejectedWith(errors.PromiseFilterError)
        .with.property("args")
        .to.include({id: 2});
    });

    it("catchError false leaves out the element that threw", function () {
      return this.localPromise
        .filter(
          this.test.normalArray,
          v => {
            if (v === 3) throw new Error("ERROR");
            return true;
          },
          {catchError: false}
        )
        .should.eventually.be.eql([1, 2, 4, 5]);
    });

    it("rejects with PromiseIterableError when it is not iterable", function () {
      return this.localPromise.filter(42, () => true).should.eventually.be.rejectedWith(PromiseIterableError);
    });
  });

  describe("ForEach", function () {
    beforeEach(function () {
      functions.forEach(this.localPromise);
    });
    let timer = 10;

    it("array of numbers and multipliy by 2", async function () {
      const arr = [];
      await this.localPromise.forEach(this.test.normalArray, (v, id) => (arr[id] = v * 2));
      return arr.should.be.eql(this.test.resultNormalArray);
    });

    it(`array of numbers and multipliy by id with inverted delay returns well in around ${timer}ms`, async function () {
      const start = Date.now();
      const arr = [];
      await this.localPromise.forEach(this.test.normalArray, async (v, id) => {
        arr[id] = await this.localPromise.resolve(v * id).delay((1 / v) * timer);
      });
      checkTiming(start, timer);
      return arr.should.be.eql(this.test.resultMultiplyById);
    });

    it(`array of numbers and multipliy by id with inverted delay in sequence returns well in around ${timer * 5}ms`, async function () {
      const start = Date.now();
      const arr = [];
      await this.localPromise.forEach(
        this.test.normalArray,
        async (v, id) => {
          arr[id] = await this.localPromise.resolve(v * id).delay(timer);
        },
        {parallel: false}
      );
      checkTiming(start, timer * 5, 5);
      return arr.should.be.eql(this.test.resultMultiplyById);
    });

    it("promise array of numbers and multipliy by 2", async function () {
      const arr = [];
      await this.localPromise.resolve(this.test.normalArray).forEach((v, id) => (arr[id] = v * 2));
      return arr.should.be.eql(this.test.resultNormalArray);
    });

    it("array of promises of numbers and multipliy by 2", async function () {
      const arr = [];
      await this.localPromise.resolve(this.test.promiseArray).forEach((v, id) => (arr[id] = v * 2));
      return arr.should.be.eql(this.test.resultNormalArray);
    });

    it("array of promises of numbers and multipliy by id", async function () {
      const arr = [];
      await this.localPromise.resolve(this.test.promiseArray).forEach((v, id) => (arr[id] = v * id));
      return arr.should.be.eql(this.test.resultMultiplyById);
    });

    it("array of promises and return array[id]", async function () {
      const arr = [];
      await this.localPromise
        .resolve(this.test.promiseArray)
        .forEach(async (v, id, array) => (arr[id] = await array[id]));
      return arr.should.be.eql(this.test.normalArray);
    });

    it("array of promises and multipliy by id, the third rejected", async function () {
      const arr = [];
      return this.localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .forEach((v, id) => (arr[id] = v * id))
        .should.eventually.be.rejectedWith(PromiseForEachError)
        .with.property("args")
        .to.include({err: "ERROR", id: 2, iterable: this.test.promiseArrayInnerReject});
    });

    it(`forEach with rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .forEach((v, id) => v * id)
        .should.eventually.be.rejectedWith(PromiseForEachError)
        .then(() => checkTiming(start, 1));
    });

    it(`forEach with callback rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .forEach(this.test.normalArray, (v, id) => {
          if (id === 2) throw "ERROR";
          return v * id;
        })
        .should.eventually.be.rejectedWith(PromiseForEachError)
        .then(() => checkTiming(start, 1));
    });

    it(`forEach with delay option ${timer}ms parallel`, async function () {
      const start = Date.now();
      const arr = [];
      await this.localPromise.forEach(this.test.normalArray, (v, id) => (arr[id] = v * 2), {delay: timer});
      checkTiming(start, timer);
      return arr.should.be.eql(this.test.resultNormalArray);
    });

    it(`forEach with delay option ${timer}ms sequential`, async function () {
      const start = Date.now();
      const arr = [];
      await this.localPromise.forEach(this.test.normalArray, (v, id) => (arr[id] = v * 2), {
        delay: timer,
        parallel: false
      });
      checkTiming(start, timer * 5, 5);
      return arr.should.be.eql(this.test.resultNormalArray);
    });

    it(`forEach with atLeast option ${timer}ms`, async function () {
      const start = Date.now();
      const arr = [];
      await this.localPromise.forEach(this.test.normalArray, (v, id) => (arr[id] = v * 2), {atLeast: timer});
      checkTiming(start, timer);
      return arr.should.be.eql(this.test.resultNormalArray);
    });

    it(`forEach with timeout option ${timer}ms should timeout`, function () {
      const start = Date.now();
      return this.localPromise
        .forEach(this.test.normalArray, v => this.localPromise.delay(timer * 3, v * 2), {timeout: timer})
        .should.eventually.be.rejectedWith(PromiseForEachError)
        .then(() => checkTiming(start, timer));
    });

    it("forEach with invalid iterable should reject", function () {
      const start = Date.now();
      return this.localPromise
        .forEach(null, v => v * 2)
        .should.eventually.be.rejectedWith(PromiseForEachError)
        .then(() => checkTiming(start, 1));
    });

    it("maps array of promises and multipliy by id, if result > 5 the callbacks throws, \
with parallel false", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map(
          async (v, id) => {
            const res = v * id;
            if (res > 5) throw "ERROR";
            return res;
          },
          {parallel: false}
        )
        .should.eventually.be.rejectedWith(PromiseMapError)
        .with.nested.property("args.err", "ERROR");
    });

    it("maps array of promises and multipliy by id, if result > 10 \
the callbacks throws with catchError false", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map(
          async (v, id) => {
            const res = v * id;
            if (res > 10) throw "ERROR";
            return res;
          },
          {catchError: false}
        )
        .should.eventually.be.rejectedWith("ERROR");
    });

    it("maps array of promises and multipliy by id, if result > 10 \
the callbacks throws with catchError false and parallel false", function () {
      return this.localPromise
        .resolve(this.test.promiseArray)
        .map(
          async (v, id) => {
            const res = v * id;
            if (res > 10) throw "ERROR";
            return res;
          },
          {catchError: false, parallel: false}
        )
        .should.eventually.be.eql([0, 2, 6, "ERROR", "ERROR"]);
    });
  });

  describe("Sequence ", function () {
    beforeEach(function () {
      functions.sequence(this.localPromise);
    });
    let timer = 10;

    it(`Promise sequence resolves around ${timer * 5}ms with 5 delays of ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {delay: timer})
        .should.eventually.eql([1, 2, 3, 4, 5])
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`Promise sequence resolves around ${timer * 15}ms with 5 delays of ${timer}ms and one delay of ${timer * 10}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequence([() => 1, () => 2, () => 3, timer * 10, () => 4, () => 5], {delay: timer})
        .should.eventually.eql([1, 2, 3, 4, 5])
        .then(() => checkTiming(start, timer * 15, 15));
    });

    it(`Promise sequence resolves around ${timer * 5}ms with 5 atLeast of ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {atLeast: timer})
        .should.eventually.eql([1, 2, 3, 4, 5])
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`Promise sequence resolves around ${timer * 15}ms with 5 delays of ${timer}ms and atLeast of ${timer * 2}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {
          delay: timer,
          atLeast: timer * 2
        })
        .should.eventually.eql([1, 2, 3, 4, 5])
        .then(() => checkTiming(start, timer * 15, 15));
    });

    it(`sequence with rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequence([
          () => 1,
          () => {
            throw "ERROR";
          },
          () => 3
        ])
        .should.eventually.be.rejectedWith(PromiseSequenceError)
        .then(() => checkTiming(start, 1));
    });

    it(`sequence with timeout option ${timer}ms should timeout`, function () {
      const start = Date.now();
      return this.localPromise
        .sequence([() => this.localPromise.delay(timer * 3, 1)], {timeout: timer})
        .should.eventually.be.rejectedWith(PromiseSequenceError)
        .then(() => checkTiming(start, timer));
    });

    it("sequence with invalid iterable should reject", function () {
      const start = Date.now();
      return this.localPromise
        .sequence(null)
        .should.eventually.be.rejectedWith(PromiseSequenceError)
        .then(() => checkTiming(start, 1));
    });

    it("Promise sequence behaves well with rejected promises", function () {
      return this.localPromise
        .sequence(
          [
            () => 1,
            () => 2,
            () => {
              //throw new Error("ERROR2");
              return this.localPromise.reject(new Error("ERROR2"));
            },
            () => 4,
            () => 5
          ],
          {
            delay: 20,
            atLeast: 10
          }
        )
        .should.be.rejectedWith(PromiseSequenceError);
    });

    it("Promise sequence with no iterable rejects correctly", function () {
      return this.localPromise
        .sequence({test: "Hello World"}, {delay: 20})
        .should.be.rejectedWith(PromiseIterableError);
    });
  });

  describe("SequenceAllSettled", function () {
    beforeEach(function () {
      functions.sequenceAllSettled(this.localPromise);
    });
    let timer = 10;

    it(`resolves around ${timer * 5}ms with global delay of ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequenceAllSettled([() => 1, () => 2, () => 3, () => 4, () => 5], {delay: timer})
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "fulfilled", value: 3},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ])
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`resolves around ${timer * 15}ms with 5 delays of ${timer}ms and one delay of ${timer * 10}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequenceAllSettled([() => 1, () => 2, () => 3, timer * 10, () => 4, () => 5], {delay: timer})
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "fulfilled", value: 3},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ])
        .then(() => checkTiming(start, timer * 15, 15));
    });

    it(`resolves around ${timer * 5}ms with 5 atLeast of ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .sequenceAllSettled([() => 1, () => 2, () => 3, () => 4, () => 5], {atLeast: timer})
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "fulfilled", value: 3},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ])
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`sequenceAllSettled with rejection should continue`, function () {
      const start = Date.now();
      return this.localPromise
        .sequenceAllSettled([
          () => 1,
          () => {
            throw "ERROR";
          },
          () => 3
        ])
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "rejected", reason: "ERROR"},
          {status: "fulfilled", value: 3}
        ])
        .then(() => checkTiming(start, 1));
    });

    it(`sequenceAllSettled with timeout option ${timer}ms should timeout`, function () {
      const start = Date.now();
      return this.localPromise
        .sequenceAllSettled([() => this.localPromise.delay(timer * 3, 1)], {timeout: timer})
        .should.eventually.be.rejectedWith(PromiseSequenceError)
        .then(() => checkTiming(start, timer));
    });

    it("sequenceAllSettled with invalid iterable should reject", function () {
      const start = Date.now();
      return this.localPromise
        .sequenceAllSettled(null)
        .should.eventually.be.rejectedWith(PromiseSequenceError)
        .then(() => checkTiming(start, 1));
    });

    it("rejects around 100ms with 5 timeouts of 10ms and atLeast of 20ms (timers coherence)", function () {
      const arr = [() => 1, () => 2, () => 3, () => 4, () => 5];
      return this.localPromise
        .sequenceAllSettled(arr, {
          timeout: 10,
          atLeast: 20
        })
        .should.eventually.rejectedWith(PromiseSequenceError)
        .with.property("args");
    });

    it("behaves well with rejected functions", function () {
      return this.localPromise
        .sequenceAllSettled(
          [
            () => 1,
            () => 2,
            () => this.localPromise.delay(20).then(() => this.localPromise.reject("ERROR")),
            () => 4,
            () => 5
          ],
          {
            delay: 10,
            atLeast: 20
          }
        )
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "rejected", reason: "ERROR"},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ]);
    });

    it("no iterable rejects correctly", function () {
      return this.localPromise
        .sequenceAllSettled({test: "Hello World"}, {delay: 20})
        .should.be.rejectedWith(PromiseIterableError);
    });
  });

  describe("Reduce", function () {
    beforeEach(function () {
      functions.reduce(this.localPromise);
    });
    let timer = 10;

    it(`resolves around ${timer * 5}ms with global delay of ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .reduce(this.test.normalArray, (res, v) => res + v, 1, {
          delay: timer
        })
        .should.eventually.eq(16)
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`resolves around ${timer}ms with 5 promises`, function () {
      const start = Date.now();
      return this.localPromise
        .reduce(this.test.promiseArray, (res, v) => res + v, 1)
        .should.eventually.eq(16)
        .then(() => checkTiming(start, 1));
    });

    it(`reduce with rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .reduce(this.test.promiseArrayInnerReject, (res, v) => res + v, 1)
        .should.be.eventually.rejectedWith(PromiseReduceError)
        .then(() => checkTiming(start, 1));
    });

    it(`reduce with callback rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .reduce(
          this.test.normalArray,
          (res, v, id) => {
            if (id === 2) throw "ERROR";
            return res + v;
          },
          1
        )
        .should.eventually.be.rejectedWith(PromiseReduceError)
        .then(() => checkTiming(start, 1));
    });

    it(`reduce with atLeast option ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .reduce(this.test.normalArray, (res, v) => res + v, 1, {atLeast: timer})
        .should.eventually.eq(16)
        .then(() => checkTiming(start, timer * 5, 5));
    });

    it(`reduce with timeout option ${timer}ms should timeout`, function () {
      const start = Date.now();
      return this.localPromise
        .reduce(this.test.normalArray, () => this.localPromise.delay(timer * 3, 1), 1, {timeout: timer})
        .should.eventually.be.rejectedWith(PromiseReduceError)
        .then(() => checkTiming(start, timer));
    });

    it("reduce with invalid iterable should reject", function () {
      const start = Date.now();
      return this.localPromise
        .reduce(null, (res, v) => res + v, 1)
        .should.eventually.be.rejectedWith(PromiseReduceError)
        .then(() => checkTiming(start, 1));
    });

    it("behaves well with rejected promises and inform args", function () {
      return this.localPromise
        .reduce(this.test.promiseArrayInnerReject, (res, v) => res + v, 1)
        .should.be.eventually.rejectedWith(PromiseReduceError)
        .with.property("args")
        .to.include({
          id: 2,
          err: "ERROR",
          lastResult: 4,
          iterable: this.test.promiseArrayInnerReject
        });
    });
  });

  describe("Waterfall", function () {
    beforeEach(function () {
      functions.waterfall(this.localPromise);
    });

    it("resolves around 100ms with global delay of 20ms", function () {
      return this.localPromise
        .waterfall([v => v + 1, v => v * 2, v => v ** 3, v => v - 4, v => v / 10], 1, {
          delay: 20
        })
        .should.eventually.eq(6);
    });

    it("resolves around 100ms with 5 delays of 20ms", function () {
      return this.localPromise
        .waterfall(
          [
            v => this.localPromise.resolve(v + 1).delay(20),
            v => this.localPromise.resolve(v * 2).delay(20),
            v => this.localPromise.resolve(v ** 3).delay(20),
            v => this.localPromise.resolve(v - 4).delay(20),
            v => this.localPromise.resolve(v / 10).delay(20)
          ],
          1
        )
        .should.eventually.eq(6);
    });

    it("behaves well with rejected promises and inform args", function () {
      const arr = [v => v + 1, v => v * 2, () => this.localPromise.reject("ERROR"), v => v + 4, v => v * 5];
      return this.localPromise
        .waterfall(arr, 1)
        .should.be.eventually.rejectedWith(PromiseWaterfallError)
        .with.property("args")
        .to.include({id: 2, err: "ERROR", lastResult: 4, iterable: arr});
    });
  });

  describe("get", function () {
    beforeEach(function () {
      functions.get(this.localPromise);
    });

    it("Promise resolves object and get property", function () {
      return this.localPromise.resolve({test: "Hello World"}).get("test").should.eventually.be.eq("Hello World");
    });

    it("Promise rejects well with no key found", function () {
      return this.localPromise.resolve({test: "Hello World"}).get("a").should.be.rejectedWith(PromiseKeyNotFound);
    });
  });

  describe("keys", function () {
    it("Promise resolves object and get keys", function () {
      functions.keys(this.localPromise);
      return this.localPromise.resolve({a: 1, b: 2, c: 3}).keys().should.eventually.be.eql(["a", "b", "c"]);
    });
  });

  describe("waitForKey", function () {
    beforeEach(function () {
      functions.waitForKey(this.localPromise);
    });

    it("assign key after 100ms and resolves", function () {
      const obj = {};
      setTimeout(() => (obj.test = true), 100);
      return this.localPromise.waitForKey(obj, "test").should.eventually.be.eql(true);
    });

    it("inner assign key after 100ms and resolves", function () {
      const obj = new this.localPromise(res => {
        const obj = {};
        setTimeout(() => (obj.test = true), 100);
        res(obj);
      });
      return obj.waitForKey("test").should.eventually.be.eql(true);
    });

    it("rejects after 2 iterations", function () {
      const obj = {};
      setTimeout(() => (obj.test = true), 300);
      return this.localPromise
        .waitForKey(obj, "test", {maxIterations: 2})
        .should.eventually.rejectedWith(PromiseMaxIterationsError);
    });

    it("uses onRetry function instead of ellapsed delay", async function () {
      const obj = {};
      let retryTimestamps = [];

      const onRetry = async () => {
        retryTimestamps.push(Date.now());
        // onRetry con delay de 50ms
        await new Promise(resolve => setTimeout(resolve, 50));
      };

      // Asignar la key después de 3 retries (~150ms con onRetry de 50ms)
      setTimeout(() => {
        obj.test = "success";
      }, 120);

      const startTime = Date.now();
      const result = await this.localPromise.waitForKey(obj, "test", {
        ellapsed: 200, // Si usara este delay, tardaría mucho más
        maxIterations: 10,
        onRetry
      });

      const totalTime = Date.now() - startTime;

      result.should.equal("success");
      retryTimestamps.length.should.be.at.least(2); // Al menos 2 retries

      // Verificar que los retries ocurrieron con ~50ms de diferencia, no 200ms
      if (retryTimestamps.length >= 2) {
        const timeBetweenRetries = retryTimestamps[1] - retryTimestamps[0];
        timeBetweenRetries.should.be.within(45, 65); // ~50ms con tolerancia
      }

      // El tiempo total debería ser ~120-150ms, no 400ms+ si usara ellapsed
      totalTime.should.be.below(200);
    });

    it("onRetry can execute sync functions like nextTick simulation", async function () {
      const obj = {};
      let callOrder = [];

      const onRetry = async () => {
        callOrder.push("onRetry-start");
        // Simular un nextTick con setImmediate
        await new Promise(resolve =>
          setImmediate(() => {
            callOrder.push("onRetry-nextTick");
            resolve();
          })
        );
        callOrder.push("onRetry-end");
      };

      // Asignar después del primer retry
      setImmediate(() => {
        callOrder.push("assign-key");
        obj.test = "done";
      });

      const result = await this.localPromise.waitForKey(obj, "test", {
        ellapsed: 100,
        maxIterations: 5,
        onRetry
      });

      result.should.equal("done");
      // Verificar que onRetry se ejecutó antes de asignar la key
      const onRetryIndex = callOrder.indexOf("onRetry-start");
      const assignIndex = callOrder.indexOf("assign-key");
      onRetryIndex.should.be.at.least(0);
      assignIndex.should.be.above(onRetryIndex);
    });

    it("onRetry with throwing error propagates correctly", async function () {
      const obj = {};
      let retryCount = 0;

      const onRetry = async () => {
        retryCount++;
        if (retryCount === 2) {
          throw new Error("Custom onRetry error");
        }
      };

      // Nunca asignar la key
      const promise = this.localPromise.waitForKey(obj, "test", {
        ellapsed: 10,
        maxIterations: 5,
        onRetry
      });

      await promise.should.be.rejectedWith("Custom onRetry error");
      retryCount.should.equal(2);
    });
  });

  describe("waitForResult", function () {
    beforeEach(function () {
      functions.waitForResult(this.localPromise);
    });

    it("resolves with a function who returns randomly", function () {
      const fn = async () => {
        const random = Math.random();
        if (random > 0.8) return true;
        return;
      };
      return this.localPromise.waitForResult(fn).should.eventually.be.eql(true);
    });

    it("rejects after 2 iterations", function () {
      const fn = async () => {
        return;
      };
      return this.localPromise
        .waitForResult(fn, {maxIterations: 2})
        .should.eventually.rejectedWith(PromiseMaxIterationsError);
    });

    it("stops polling on null (null is a legitimate value, not a 'keep waiting' signal)", function () {
      // null is treated as "result obtained" → returns null immediately on first iteration.
      let calls = 0;
      const fn = () => {
        calls++;
        return null;
      };
      return this.localPromise
        .waitForResult(fn, {maxIterations: 10})
        .should.eventually.be.null.then(() => calls.should.equal(1));
    });

    it("stops polling on falsy values (false, 0, empty string)", async function () {
      const cases = [false, 0, "", NaN];
      for (const value of cases) {
        let calls = 0;
        const fn = () => {
          calls++;
          return value;
        };
        const result = await this.localPromise.waitForResult(fn, {maxIterations: 10});
        // Use Object.is to handle NaN (NaN !== NaN with === but Object.is(NaN, NaN) === true).
        Object.is(result, value).should.be.true;
        calls.should.equal(1);
      }
    });

    it("continues polling while undefined is returned, resolves on first non-undefined value", function () {
      let calls = 0;
      const fn = () => {
        calls++;
        if (calls < 3) return undefined; // explicitly undefined → keep polling
        return "done";
      };
      return this.localPromise
        .waitForResult(fn, {ellapsed: 10, maxIterations: 10})
        .should.eventually.equal("done")
        .then(() => calls.should.equal(3));
    });

    it("polls a DOM-style API (returning null) only when wrapped with ?? undefined", function () {
      // Simulates document.querySelector pattern: returns null until target appears.
      let attempts = 0;
      let target = null;
      // Schedule the "element appearing" after a few polls.
      setTimeout(() => (target = {tagName: "DIV"}), 50);

      const fn = () => {
        attempts++;
        return target ?? undefined; // ✅ wrap null → undefined to keep polling
      };
      return this.localPromise
        .waitForResult(fn, {ellapsed: 20, maxIterations: 20})
        .should.eventually.deep.equal({tagName: "DIV"})
        .then(() => attempts.should.be.greaterThan(1));
    });
  });

  describe("find", function () {
    beforeEach(function () {
      functions.find(this.localPromise);
    });
    let timer = 10;

    it("finds first element that satisfies condition", function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v > 3)
        .should.eventually.be.eq(4)
        .then(() => checkTiming(start, 1));
    });

    it("returns undefined when no element satisfies condition", function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v > 10)
        .should.eventually.be.undefined.then(() => checkTiming(start, 1));
    });

    it("finds first element with index condition", function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, (v, id) => id === 2)
        .should.eventually.be.eq(3)
        .then(() => checkTiming(start, 1));
    });

    it("works with promise array", function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.promiseArray, v => v > 3)
        .should.eventually.be.eq(4)
        .then(() => checkTiming(start, 1));
    });

    it(`find with delay option ${timer}ms finds first element (position 0)`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v >= 1, {delay: timer})
        .should.eventually.be.eq(1)
        .then(() => checkTiming(start, timer * 1)); // Processes [1] only
    });

    it(`find with delay option ${timer}ms finds second element (position 1)`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v >= 2, {delay: timer})
        .should.eventually.be.eq(2)
        .then(() => checkTiming(start, timer * 2)); // Processes [1,2]
    });

    it(`find with delay option ${timer}ms finds third element (position 2)`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v >= 3, {delay: timer})
        .should.eventually.be.eq(3)
        .then(() => checkTiming(start, timer * 3)); // Processes [1,2,3]
    });

    it(`find with delay option ${timer}ms finds fourth element (position 3)`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v > 3, {delay: timer})
        .should.eventually.be.eq(4)
        .then(() => checkTiming(start, timer * 4)); // Processes [1,2,3,4]
    });

    it(`find with delay option ${timer}ms finds fifth element (position 4)`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v === 5, {delay: timer})
        .should.eventually.be.eq(5)
        .then(() => checkTiming(start, timer * 5)); // Processes [1,2,3,4,5] all
    });

    it(`find with delay option ${timer}ms sequential`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, v => v > 3, {delay: timer, parallel: false})
        .should.eventually.be.eq(4)
        .then(() => checkTiming(start, timer * 4, 4));
    });

    it(`find with timeout option ${timer}ms should timeout`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, () => this.localPromise.delay(timer * 3, true), {timeout: timer})
        .should.eventually.be.rejectedWith(PromiseFindError)
        .then(() => checkTiming(start, timer));
    });

    it(`find with rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .find(this.test.normalArray, (v, id) => {
          if (id === 2) throw "ERROR";
          return v > 10;
        })
        .should.eventually.be.rejectedWith(PromiseFindError)
        .then(() => checkTiming(start, 1));
    });

    it("find with invalid iterable should reject", function () {
      const start = Date.now();
      return this.localPromise
        .find(null, v => v > 3)
        .should.eventually.be.rejectedWith(PromiseFindError)
        .then(() => checkTiming(start, 1));
    });

    it("works with promise iterable", function () {
      return this.localPromise
        .resolve(this.test.normalArray)
        .find(v => v > 3)
        .should.eventually.be.eq(4);
    });

    it("stops at first match (early return)", function () {
      let callCount = 0;
      return this.localPromise
        .find(this.test.normalArray, v => {
          callCount++;
          return v === 3;
        })
        .then(result => {
          result.should.eq(3);
          callCount.should.eq(3); // Should stop after finding 3
        });
    });

    it("rejects with PromiseIterableError for non-iterable", function () {
      return this.localPromise.find({test: "not iterable"}, v => v).should.be.rejectedWith(PromiseIterableError);
    });

    it("rejects with PromiseFindError when callback throws and catchError=true", function () {
      return this.localPromise
        .find(this.test.normalArray, v => {
          if (v === 3) throw new Error("TEST_ERROR");
          return false;
        })
        .should.be.rejectedWith(Error)
        .and.eventually.have.property("name", "PromiseFindError");
    });

    it("continues when callback throws and catchError=false", function () {
      return this.localPromise
        .find(
          this.test.normalArray,
          v => {
            if (v === 3) throw new Error("TEST_ERROR");
            return v === 4;
          },
          {catchError: false}
        )
        .should.eventually.be.eq(4);
    });

    it("works with delay option", function () {
      return this.localPromise.find(this.test.normalArray, v => v > 3, {delay: 10}).should.eventually.be.eq(4);
    });

    it("works with timeout option", function () {
      return this.localPromise
        .find(
          this.test.normalArray,
          async v => {
            await this.localPromise.delay(5);
            return v > 3;
          },
          {timeout: 50}
        )
        .should.eventually.be.eq(4);
    });

    it("handles rejected promises in array with catchError=false", function () {
      return this.localPromise
        .find(this.test.promiseArrayInnerReject, v => v > 3, {catchError: false})
        .should.eventually.be.eq(4);
    });

    it("rejects when encountering rejected promise with catchError=true", function () {
      return this.localPromise
        .find(this.test.promiseArrayInnerReject, v => v > 2)
        .should.be.rejectedWith(Error)
        .and.eventually.have.property("name", "PromiseFindError");
    });
  });

  describe("some (refactored)", function () {
    beforeEach(function () {
      functions.some(this.localPromise);
    });
    let timer = 10;

    it("returns true when element satisfies condition", function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v > 3)
        .should.eventually.be.true.then(() => checkTiming(start, 1));
    });

    it("returns false when no element satisfies condition", function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v > 10)
        .should.eventually.be.false.then(() => checkTiming(start, 1));
    });

    it("works with promise array", function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.promiseArray, v => v > 3)
        .should.eventually.be.true.then(() => checkTiming(start, 1));
    });

    it("works with promise iterable", function () {
      const start = Date.now();
      return this.localPromise
        .resolve(this.test.normalArray)
        .some(v => v > 3)
        .should.eventually.be.true.then(() => checkTiming(start, 1));
    });

    it(`some with delay option ${timer}ms finds first element (position 0)`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v >= 1, {delay: timer})
        .should.eventually.be.true.then(() => checkTiming(start, timer * 1)); // Processes [1] only
    });

    it(`some with delay option ${timer}ms finds second element (position 1)`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v >= 2, {delay: timer})
        .should.eventually.be.true.then(() => checkTiming(start, timer * 2)); // Processes [1,2]
    });

    it(`some with delay option ${timer}ms finds third element (position 2)`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v >= 3, {delay: timer})
        .should.eventually.be.true.then(() => checkTiming(start, timer * 3)); // Processes [1,2,3]
    });

    it(`some with delay option ${timer}ms finds fourth element (position 3)`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v > 3, {delay: timer})
        .should.eventually.be.true.then(() => checkTiming(start, timer * 4)); // Processes [1,2,3,4]
    });

    it(`some with delay option ${timer}ms finds fifth element (position 4)`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v === 5, {delay: timer})
        .should.eventually.be.true.then(() => checkTiming(start, timer * 5)); // Processes [1,2,3,4,5] all
    });

    it(`some with delay option ${timer}ms finds no element (processes all)`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v > 10, {delay: timer})
        .should.eventually.be.false.then(() => checkTiming(start, timer * 5)); // Processes [1,2,3,4,5] all, returns false
    });

    it(`some with delay option ${timer}ms sequential`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, v => v > 3, {delay: timer, parallel: false})
        .should.eventually.be.true.then(() => checkTiming(start, timer * 4, 4));
    });

    it(`some with timeout option ${timer}ms should timeout`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, () => this.localPromise.delay(timer * 3, true), {timeout: timer})
        .should.eventually.be.rejectedWith(PromiseSomeError)
        .then(() => checkTiming(start, timer));
    });

    it(`some with rejection timing verification ${timer}ms`, function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, (v, id) => {
          if (id === 2) throw "ERROR";
          return v > 10;
        })
        .should.eventually.be.rejectedWith(PromiseSomeError)
        .then(() => checkTiming(start, 1));
    });

    it("some converts PromiseFindError to PromiseSomeError correctly", function () {
      const start = Date.now();
      return this.localPromise
        .some(this.test.normalArray, (v, id) => {
          if (id === 1) throw "FIND_ERROR";
          return v > 10;
        })
        .should.eventually.be.rejectedWith(PromiseSomeError)
        .with.property("args")
        .to.include({id: 1, err: "FIND_ERROR"})
        .then(() => checkTiming(start, 1));
    });

    it("some with invalid iterable should reject", function () {
      const start = Date.now();
      return this.localPromise
        .some(null, v => v > 3)
        .should.eventually.be.rejectedWith(PromiseSomeError)
        .then(() => checkTiming(start, 1));
    });

    it("propagates PromiseIterableError from find", function () {
      return this.localPromise.some({test: "not iterable"}, v => v).should.be.rejectedWith(PromiseIterableError);
    });

    it("converts PromiseFindError to PromiseSomeError", function () {
      return this.localPromise
        .some(this.test.normalArray, v => {
          if (v === 3) throw new Error("TEST_ERROR");
          return false;
        })
        .should.be.rejectedWith(Error)
        .and.eventually.have.property("name", "PromiseSomeError");
    });

    it("works with catchError=false", function () {
      return this.localPromise.some(
        this.test.normalArray,
        v => {
          if (v === 3) throw new Error("TEST_ERROR");
          return v === 4;
        },
        {catchError: false}
      ).should.eventually.be.true;
    });

    it("works with delay and timeout options", function () {
      return this.localPromise.some(
        this.test.normalArray,
        async v => {
          await this.localPromise.delay(5);
          return v > 3;
        },
        {delay: 5, timeout: 50}
      ).should.eventually.be.true;
    });
  });

  describe("call", function () {
    beforeEach(function () {
      functions.call(this.localPromise);
    });
    let timer = 10;

    it("calls function with correct this and arguments (method)", function () {
      const start = Date.now();
      const testObj = {value: 42};
      const testFn = function (a, b) {
        return this.value + a + b;
      };
      return this.localPromise
        .resolve(testFn)
        .call(testObj, 10, 20)
        .should.eventually.be.eq(72)
        .then(() => checkTiming(start, 1));
    });

    it("rejects with PromiseCallableError when result is not function", function () {
      const start = Date.now();
      return this.localPromise
        .resolve("not a function")
        .call({}, 1, 2)
        .should.be.rejectedWith(PromiseCallableError)
        .then(() => checkTiming(start, 1));
    });

    it(`works with async functions ${timer}ms`, function () {
      functions.delay(this.localPromise);
      const start = Date.now();
      const asyncFn = async function (a) {
        await this.localPromise.delay(timer);
        return a * 2;
      }.bind(this);
      return this.localPromise
        .resolve(asyncFn)
        .call(null, 5)
        .should.eventually.be.eq(10)
        .then(() => checkTiming(start, timer));
    });
  });

  describe("apply", function () {
    beforeEach(function () {
      functions.apply(this.localPromise);
    });
    let timer = 10;

    it("applies function with correct this and arguments array (method)", function () {
      const start = Date.now();
      const testObj = {value: 42};
      const testFn = function (a, b) {
        return this.value + a + b;
      };
      return this.localPromise
        .resolve(testFn)
        .apply(testObj, [10, 20])
        .should.eventually.be.eq(72)
        .then(() => checkTiming(start, 1));
    });

    it("rejects with PromiseCallableError when result is not function", function () {
      const start = Date.now();
      return this.localPromise
        .resolve("not a function")
        .apply({}, [1, 2])
        .should.be.rejectedWith(PromiseCallableError)
        .then(() => checkTiming(start, 1));
    });

    it("works with empty arguments array", function () {
      const testFn = function () {
        return "called";
      };
      return this.localPromise.resolve(testFn).apply(null, []).should.eventually.be.eq("called");
    });
  });

  describe("exec", function () {
    beforeEach(function () {
      functions.exec(this.localPromise);
    });
    let timer = 10;

    it("executes function with arguments (method)", function () {
      const start = Date.now();
      const testFn = (a, b, c) => a + b + c;
      return this.localPromise
        .resolve(testFn)
        .exec(1, 2, 3)
        .should.eventually.be.eq(6)
        .then(() => checkTiming(start, 1));
    });

    it("executes function with arguments (static)", function () {
      const start = Date.now();
      const testFn = (a, b, c) => a + b + c;
      return this.localPromise
        .exec(Promise.resolve(testFn), 1, 2, 3)
        .should.eventually.be.eq(6)
        .then(() => checkTiming(start, 1));
    });

    it("rejects with PromiseCallableError when result is not function", function () {
      const start = Date.now();
      return this.localPromise
        .resolve(42)
        .exec(1, 2, 3)
        .should.be.rejectedWith(PromiseCallableError)
        .then(() => checkTiming(start, 1));
    });

    it("works with no arguments", function () {
      const testFn = () => "executed";
      return this.localPromise.resolve(testFn).exec().should.eventually.be.eq("executed");
    });

    it("works with async functions", function () {
      functions.delay(this.localPromise);
      const asyncFn = async x => {
        await this.localPromise.delay(10);
        return x * 3;
      };
      return this.localPromise.resolve(asyncFn).exec(7).should.eventually.be.eq(21);
    });
  });

  describe("tap", function () {
    beforeEach(function () {
      functions.tap(this.localPromise);
    });
    let timer = 10;

    it("executes result callback without affecting value", function () {
      const start = Date.now();
      let tappedValue;
      return this.localPromise
        .resolve(42)
        .tap(val => {
          tappedValue = val;
        })
        .then(result => {
          result.should.eq(42);
          tappedValue.should.eq(42);
          checkTiming(start, 1);
        });
    });

    it("executes reject callback without affecting error", function () {
      let tappedError;
      return this.localPromise
        .reject("TEST_ERROR")
        .tap(null, err => {
          tappedError = err;
        })
        .should.be.rejectedWith("TEST_ERROR")
        .then(() => {
          tappedError.should.eq("TEST_ERROR");
        });
    });

    it("passes through value when no result callback provided", function () {
      return this.localPromise.resolve(42).tap().should.eventually.be.eq(42);
    });

    it("passes through error when no reject callback provided", function () {
      return this.localPromise.reject("TEST_ERROR").tap().should.be.rejectedWith("TEST_ERROR");
    });

    it("rejects if result callback throws", function () {
      return this.localPromise
        .resolve(42)
        .tap(() => {
          throw new Error("TAP_ERROR");
        })
        .should.be.rejectedWith("TAP_ERROR");
    });

    it("rejects if reject callback throws", function () {
      return this.localPromise
        .reject("ORIGINAL_ERROR")
        .tap(null, () => {
          throw new Error("TAP_ERROR");
        })
        .should.be.rejectedWith("TAP_ERROR");
    });

    it("works with synchronous callbacks only", function () {
      let tappedValue;
      return this.localPromise
        .resolve(42)
        .tap(val => {
          tappedValue = val * 2;
        })
        .then(result => {
          result.should.eq(42);
          tappedValue.should.eq(84);
        });
    });
  });

  describe("callAttr", function () {
    beforeEach(function () {
      functions.callAttr(this.localPromise);
    });
    let timer = 10;

    it("calls method on resolved object maintaining this context", function () {
      const start = Date.now();
      const testObj = {
        value: 42,
        getValue() {
          return this.value;
        }
      };
      return this.localPromise
        .resolve(testObj)
        .callAttr("getValue")
        .should.eventually.be.eq(42)
        .then(() => checkTiming(start, 1));
    });

    it("calls method with arguments", function () {
      const start = Date.now();
      const testObj = {
        value: 10,
        add(x) {
          return this.value + x;
        }
      };
      return this.localPromise
        .resolve(testObj)
        .callAttr("add", 5)
        .should.eventually.be.eq(15)
        .then(() => checkTiming(start, 1));
    });

    it("static method works with native promises", function () {
      const start = Date.now();
      const testObj = {
        msg: "hello",
        upper() {
          return this.msg.toUpperCase();
        }
      };
      return this.localPromise
        .callAttr(Promise.resolve(testObj), "upper")
        .should.eventually.be.eq("HELLO")
        .then(() => checkTiming(start, 1));
    });
  });

  describe("applyAttr", function () {
    beforeEach(function () {
      functions.applyAttr(this.localPromise);
    });
    let timer = 10;

    it("applies method on resolved object with arguments array", function () {
      const start = Date.now();
      const testObj = {
        base: 100,
        calculate(a, b, c) {
          return this.base + a + b + c;
        }
      };
      return this.localPromise
        .resolve(testObj)
        .applyAttr("calculate", [1, 2, 3])
        .should.eventually.be.eq(106)
        .then(() => checkTiming(start, 1));
    });

    it("static method works with native promises", function () {
      const start = Date.now();
      const testObj = {
        nums: [1, 2, 3],
        sum(...args) {
          return this.nums.reduce((a, b) => a + b, 0) + args.reduce((a, b) => a + b, 0);
        }
      };
      return this.localPromise
        .applyAttr(Promise.resolve(testObj), "sum", [10, 20])
        .should.eventually.be.eq(36) // [1,2,3] + [10,20] = 6 + 30 = 36
        .then(() => checkTiming(start, 1));
    });
  });
});
