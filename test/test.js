"use strict";
const {
  default: PromiseHelpers,
  errors: {
    PromiseTimeoutError,
    PromiseIterableError,
    PromiseTimeoutDefaultError,
    PromiseKeyNotFound,
    PromiseMaxIterationsError,
    PromiseMapError,
    PromiseForEachError,
    PromiseSequenceError,
    PromiseWaterfallError
  },
  wrapper
} = require("../");
const localPromise = class extends Promise {};
PromiseHelpers(localPromise);
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();

describe("Test", function () {
  this.slow(1);
  beforeEach(function () {
    this.currentTest.normalArray = [1, 2, 3, 4, 5];
    this.currentTest.resultNormalArray = [2, 4, 6, 8, 10];
    this.currentTest.resultMultiplyById = this.currentTest.normalArray.map((v, id) => v * id);
    this.currentTest.promiseArray = this.currentTest.normalArray.map(v => localPromise.resolve(v));
    this.currentTest.promiseArrayInnerReject = [...this.currentTest.promiseArray];
    this.currentTest.promiseArrayInnerReject[2] = localPromise.reject("ERROR");
    Promise.all(this.currentTest.promiseArrayInnerReject).catch(() => true);
  });
  describe("LocalPromise", function () {
    it("resolves", function () {
      return localPromise.resolve(10).should.eventually.be.eq(10);
    });
    it("rejects", function () {
      return localPromise.reject(10).should.eventually.be.rejectedWith(10);
    });
    it("new resolves", function () {
      return new localPromise(res => res(10)).should.eventually.be.eq(10);
    });
    it("new rejects", function () {
      return new localPromise((res, rej) => rej(10)).should.eventually.be.rejectedWith(10);
    });
    it("resolve has delay", function () {
      return localPromise.resolve(10).should.have.property("delay");
    });
    it("reject has delay", function () {
      return localPromise.reject(10).delay(100).should.be.rejectedWith(10);
    });
    it("resolve has atLeast", function () {
      return localPromise.resolve(10).should.have.property("atLeast");
    });
  });
  describe("Delay", function () {
    it("static 100ms", function () {
      return localPromise.delay(100).should.be.fulfilled;
    });
    it("100ms", function () {
      return localPromise.resolve(1).delay(100).should.be.fulfilled;
    });
    it("static with rejected value", function () {
      return localPromise
        .delay(100, localPromise.reject("ERROR"))
        .delay(100)
        .should.eventually.be.rejectedWith("ERROR");
    });
    it("static behaves well with thrown value", function () {
      let prom = new Promise(() => {
        throw "ERROR";
      });
      return localPromise.delay(100, prom).delay(100).should.eventually.be.rejectedWith("ERROR");
    });
    it("after rejection", function () {
      return localPromise.reject("ERROR").delay(100).delay(100).should.eventually.be.rejectedWith("ERROR");
    });
    it("reject after delay, with delay chains after", function () {
      return localPromise
        .delay(100)
        .then(() => localPromise.reject("ERROR"))
        .delay(100)
        .delay(100)
        .should.eventually.be.rejectedWith("ERROR");
    });
    it("reject chained with several delays of 100ms", function () {
      return localPromise.reject("ERROR").delay(100).delay(100).delay(100).delay(100).delay(100).should.eventually.be
        .rejected;
    });
    it("delay chain 5x20ms", function () {
      return localPromise
        .resolve("test")
        .delay(20)
        .delay(20)
        .delay(20)
        .delay(20)
        .delay(20)
        .should.eventually.be.equal("test");
    });
    it("chain in for loop 5x20ms", function () {
      let res = localPromise.resolve("test");
      for (let i = 0; i < 5; i++) {
        res = res.delay(20);
      }
      return res.should.eventually.be.equal("test");
    });
    it("Promise.all wth 5x20ms delay each", function () {
      const arr = [...Array(5).keys()];
      const res = localPromise.all(arr.map(v => localPromise.resolve(v).delay(20)));
      return res.should.eventually.be.eql(arr);
    });
  });
  describe("AtLeast", function () {
    it("100ms", function () {
      return localPromise.resolve(1).atLeast(100).should.be.fulfilled;
    });
    it("after rejection", function () {
      return localPromise.reject("ERROR").atLeast(100).atLeast(100).should.eventually.be.rejectedWith("ERROR");
    });
    it("reject chained with several atLeasts of 100ms", function () {
      return localPromise.reject("ERROR").atLeast(100).atLeast(100).atLeast(100).atLeast(100).atLeast(100).should
        .eventually.be.rejected;
    });
    it("atLeast chain 5x20ms", function () {
      return localPromise
        .resolve("test")
        .atLeast(20)
        .atLeast(20)
        .atLeast(20)
        .atLeast(20)
        .atLeast(20)
        .should.eventually.be.equal("test");
    });
    it("chain in for loop 5x20ms", function () {
      let res = localPromise.resolve("test");
      for (let i = 0; i < 5; i++) {
        res = res.atLeast(20);
      }
      return res.should.eventually.be.equal("test");
    });
    it("Promise.all wth 5x20ms atLeast each", function () {
      const arr = [...Array(5).keys()];
      const res = localPromise.all(arr.map(v => localPromise.resolve(v).atLeast(20)));
      return res.should.eventually.be.eql(arr);
    });
  });
  describe("Timeout", function () {
    it("resolves before 100ms", function () {
      return localPromise.delay(50).timeout(100).should.be.fulfilled;
    });
    it("behaves well with rejection", function () {
      return localPromise.reject(50).timeout(100).should.be.rejectedWith(50);
    });
    it("rejects after 100ms", function () {
      return localPromise.delay(600).timeout(100).should.be.rejected;
    });
    it("timeout error is PromiseTimeoutError", function () {
      return localPromise.delay(200).timeout(100).should.be.rejectedWith(PromiseTimeoutError);
    });
    it("behaves well in chained incremental timeouts", function () {
      return localPromise
        .delay(200)
        .timeout(100)
        .timeout(200)
        .timeout(300)
        .timeout(400)
        .timeout(500)
        .should.be.eventually.rejectedWith(PromiseTimeoutError)
        .with.nested.property("args.time", 100);
    });
    it("timeout behaves well in chained decremental timeouts", function () {
      return localPromise
        .delay(200)
        .timeout(500)
        .timeout(400)
        .timeout(300)
        .timeout(200)
        .timeout(100)
        .should.be.eventually.rejectedWith(PromiseTimeoutError)
        .with.nested.property("args.time", 100);
    });
  });
  describe("TimeoutDefault", function () {
    it("rejects correctly when no default", function () {
      return localPromise.resolve().timeoutDefault(100).should.be.rejectedWith(PromiseTimeoutDefaultError);
    });
    it("timeout in 100ms and returns true as default", function () {
      return localPromise.delay(200).timeoutDefault(100, true).should.eventually.be.eq(true);
    });
    it("rejects and forces to return default", function () {
      return localPromise.reject(false).timeoutDefault(100, true, true).should.eventually.be.eq(true);
    });
  });
  describe("Wrapper", function () {
    it("wraps a add function that adds a value to result", function () {
      wrapper("add", {
        Static(prom, toAdd) {
          return this.resolve(prom).then(val => val + toAdd);
        }
      })(localPromise);
      return typeof localPromise.add == "function" && typeof localPromise.resolve(5).add === "function";
    });
    it("static add", function () {
      return localPromise.add(5, 5).should.eventually.be.eq(10);
    });
    it("method add", function () {
      return localPromise.resolve(5).add(5).should.eventually.be.eq(10);
    });
  });
  describe("Map", function () {
    it("array of numbers and multipliy by 2", function () {
      return localPromise.map(this.test.normalArray, v => v * 2).should.eventually.be.eql(this.test.resultNormalArray);
    });
    it("array of numbers and multipliy by id with inverted delay returns well in around 230ms", function () {
      return localPromise
        .map(this.test.normalArray, async (v, id) => {
          return await localPromise.resolve(v * id).delay((1 / v) * 100);
        })
        .should.eventually.be.eql(this.test.resultMultiplyById);
    });
    it("array of numbers and multipliy by id with inverted delay in parallel \
returns well in around 100ms", function () {
      return localPromise
        .map(
          this.test.normalArray,
          async (v, id) => {
            return await localPromise.resolve(v * id).delay((1 / v) * 100);
          },
          {parallel: true}
        )
        .should.eventually.be.eql(this.test.resultMultiplyById);
    });
    it("promise array of numbers and multipliy by 2", function () {
      return localPromise
        .resolve(this.test.normalArray)
        .map(v => v * 2)
        .should.eventually.be.eql(this.test.resultNormalArray);
    });
    it("array of promises of numbers and multipliy by 2", function () {
      return localPromise
        .resolve(this.test.promiseArray)
        .map(v => v * 2)
        .should.eventually.be.eql(this.test.resultNormalArray);
    });
    it("array of promises of numbers and multipliy by id", function () {
      return localPromise
        .resolve(this.test.promiseArray)
        .map((v, id) => v * id)
        .should.eventually.be.eql(this.test.resultMultiplyById);
    });
    it("array of promises and return array[id]", function () {
      return localPromise
        .resolve(this.test.promiseArray)
        .map((v, id, arr) => arr[id])
        .should.eventually.be.eql(this.test.normalArray);
    });
    it("maps array of promises and multipliy by id, the third rejected", function () {
      return localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .map((v, id) => v * id)
        .should.eventually.be.rejectedWith(PromiseMapError)
        .with.nested.property("args.err", "ERROR");
    });
    it("maps array of promises and multipliy by id, the third rejected with cachtError false", function () {
      return localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .map((v, id) => v * id, {catchError: false})
        .should.eventually.be.eql([0, 2, "ERROR", 12, 20]);
    });
    it("maps array of promises and multipliy by id, if result > 5 the callbacks throws, \
with parallel false", function () {
      return localPromise
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
      return localPromise
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
      return localPromise
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
  describe("ForEach", function () {
    it("array of numbers and multipliy by 2", async function () {
      const arr = [];
      await localPromise.forEach(this.test.normalArray, (v, id) => (arr[id] = v * 2));
      return arr.should.be.eql(this.test.resultNormalArray);
    });
    it("array of numbers and multipliy by id with inverted delay returns well in around 100ms", async function () {
      const arr = [];
      await localPromise.forEach(this.test.normalArray, async (v, id) => {
        arr[id] = await localPromise.resolve(v * id).delay((1 / v) * 100);
      });
      return arr.should.be.eql(this.test.resultMultiplyById);
    });
    it("array of numbers and multipliy by id with inverted delay in sequence \
returns well in around 230", async function () {
      const arr = [];
      await localPromise.forEach(
        this.test.normalArray,
        async (v, id) => {
          arr[id] = await localPromise.resolve(v * id).delay((1 / v) * 100);
        },
        {parallel: false}
      );
      return arr.should.be.eql(this.test.resultMultiplyById);
    });
    it("promise array of numbers and multipliy by 2", async function () {
      const arr = [];
      await localPromise.resolve(this.test.normalArray).forEach((v, id) => (arr[id] = v * 2));
      return arr.should.be.eql(this.test.resultNormalArray);
    });
    it("array of promises of numbers and multipliy by 2", async function () {
      const arr = [];
      await localPromise.resolve(this.test.promiseArray).forEach((v, id) => (arr[id] = v * 2));
      return arr.should.be.eql(this.test.resultNormalArray);
    });
    it("array of promises of numbers and multipliy by id", async function () {
      const arr = [];
      await localPromise.resolve(this.test.promiseArray).map((v, id) => (arr[id] = v * id));
      return arr.should.be.eql(this.test.resultMultiplyById);
    });
    it("array of promises and return array[id]", async function () {
      const arr = [];
      await localPromise.resolve(this.test.promiseArray).map(async (v, id, array) => (arr[id] = await array[id]));
      return arr.should.be.eql(this.test.normalArray);
    });
    it("maps array of promises and multipliy by id, the third rejected", async function () {
      const arr = [];
      return localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .forEach((v, id) => (arr[id] = v * id))
        .should.eventually.be.rejectedWith(PromiseForEachError)
        .with.deep.property("args", {err: "ERROR", id: 2, iterable: this.test.promiseArrayInnerReject});
    });
    it("maps array of promises and multipliy by id, the third rejected with cachtError false", function () {
      return localPromise
        .resolve(this.test.promiseArrayInnerReject)
        .map((v, id) => v * id, {catchError: false})
        .should.eventually.be.eql([0, 2, "ERROR", 12, 20]);
    });
    it("maps array of promises and multipliy by id, if result > 5 the callbacks throws, \
with parallel false", function () {
      return localPromise
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
      return localPromise
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
      return localPromise
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
  describe("Sequence", function () {
    it("Promise sequence resolves around 100ms with 5 delays of 20ms", function () {
      return localPromise
        .sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {delay: 20})
        .should.eventually.eql([1, 2, 3, 4, 5]);
    });
    it("Promise sequence resolves around 200ms with 5 delays of 20ms and one delay of 100ms", function () {
      return localPromise
        .sequence([() => 1, () => 2, () => 3, 100, () => 4, () => 5], {delay: 20})
        .should.eventually.eql([1, 2, 3, 4, 5]);
    });
    it("Promise sequence resolves around 100ms with 5 atLeast of 20ms", function () {
      return localPromise
        .sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {atLeast: 20})
        .should.eventually.eql([1, 2, 3, 4, 5]);
    });
    it("Promise sequence resolves around 100ms with 5 delays of 10ms and atLeast of 20ms", function () {
      return localPromise
        .sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {
          delay: 10,
          atLeast: 20
        })
        .should.eventually.eql([1, 2, 3, 4, 5]);
    });
    it("Promise sequence behaves well with rejected promises", function () {
      return localPromise
        .sequence([() => 1, () => 2, () => localPromise.reject("ERROR"), () => 4, () => 5], {
          delay: 20,
          atLeast: 10
        })
        .should.be.rejectedWith(PromiseSequenceError);
    });
    it("Promise sequence with no iterable rejects correctly", function () {
      return localPromise.sequence({test: "Hello World"}, {delay: 20}).should.be.rejectedWith(PromiseIterableError);
    });
  });
  describe("SequenceAllSettled", function () {
    it("resolves around 100ms with 5 delays of 20ms", function () {
      return localPromise
        .sequenceAllSettled([() => 1, () => 2, () => 3, () => 4, () => 5], {delay: 20})
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "fulfilled", value: 3},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ]);
    });
    it("resolves around 200ms with 5 delays of 20ms and one delay of 100ms", function () {
      return localPromise
        .sequenceAllSettled([() => 1, () => 2, () => 3, 100, () => 4, () => 5], {delay: 20})
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "fulfilled", value: 3},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ]);
    });
    it("resolves around 100ms with 5 atLeast of 20ms", function () {
      return localPromise
        .sequenceAllSettled([() => 1, () => 2, () => 3, () => 4, () => 5], {atLeast: 20})
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "fulfilled", value: 3},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ]);
    });
    it("resolves around 100ms with 5 delays of 20ms and atLeast of 10ms", function () {
      return localPromise
        .sequenceAllSettled([() => 1, () => 2, () => 3, () => 4, () => 5], {
          delay: 20,
          atLeast: 10
        })
        .should.eventually.eql([
          {status: "fulfilled", value: 1},
          {status: "fulfilled", value: 2},
          {status: "fulfilled", value: 3},
          {status: "fulfilled", value: 4},
          {status: "fulfilled", value: 5}
        ]);
    });
    it("behaves well with rejected promises", function () {
      return localPromise
        .sequenceAllSettled(
          [() => 1, () => 2, () => localPromise.delay(20).then(() => localPromise.reject("ERROR")), () => 4, () => 5],
          {
            delay: 20,
            atLeast: 10
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
      return localPromise
        .sequenceAllSettled({test: "Hello World"}, {delay: 20})
        .should.be.rejectedWith(PromiseIterableError);
    });
  });
  describe("Reduce", function () {
    it("resolves around 100ms with global delay of 20ms", function () {
      return localPromise
        .reduce(this.test.normalArray, (res, v) => res + v, 1, {
          delay: 20
        })
        .should.eventually.eq(16);
    });
    it("resolves around 100ms with 5 delays of 20ms", function () {
      return localPromise.reduce(this.test.promiseArray, (res, v) => res + v, 1).should.eventually.eq(16);
    });
    it("behaves well with rejected promises and inform args", function () {
      return localPromise
        .reduce(this.test.promiseArrayInnerReject, (res, v) => res + v, 1)
        .should.be.eventually.rejectedWith(PromiseWaterfallError)
        .to.have.deep.property("args", {
          id: 2,
          err: "ERROR",
          lastResult: 4,
          iterable: this.test.promiseArrayInnerReject
        });
    });
  });
  describe("Waterfall", function () {
    it("resolves around 100ms with global delay of 20ms", function () {
      return localPromise
        .waterfall([v => v + 1, v => v * 2, v => v ** 3, v => v - 4, v => v / 10], 1, {
          delay: 20
        })
        .should.eventually.eq(6);
    });
    it("resolves around 100ms with 5 delays of 20ms", function () {
      return localPromise
        .waterfall(
          [
            v => localPromise.resolve(v + 1).delay(20),
            v => localPromise.resolve(v * 2).delay(20),
            v => localPromise.resolve(v ** 3).delay(20),
            v => localPromise.resolve(v - 4).delay(20),
            v => localPromise.resolve(v / 10).delay(20)
          ],
          1
        )
        .should.eventually.eq(6);
    });
    it("behaves well with rejected promises and inform args", function () {
      const arr = [v => v + 1, v => v * 2, () => localPromise.reject("ERROR"), v => v + 4, v => v * 5];
      return localPromise
        .waterfall(arr, 1)
        .should.be.eventually.rejectedWith(PromiseWaterfallError)
        .to.have.deep.property("args", {id: 2, err: "ERROR", lastResult: 4, iterable: arr});
    });
  });
  describe("get", function () {
    it("Promise resolves object and get property", function () {
      return localPromise.resolve({test: "Hello World"}).get("test").should.eventually.be.eq("Hello World");
    });
    it("Promise rejects well with no key found", function () {
      return localPromise.resolve({test: "Hello World"}).get("a").should.be.rejectedWith(PromiseKeyNotFound);
    });
  });
  describe("keys", function () {
    it("Promise resolves object and get keys", function () {
      return localPromise.resolve({a: 1, b: 2, c: 3}).keys().should.eventually.be.eql(["a", "b", "c"]);
    });
  });
  describe("waitForKey", function () {
    it("assign key after 400ms and resolves", function () {
      const obj = {};
      setTimeout(() => (obj.test = true), 400);
      return localPromise.waitForKey(obj, "test").should.eventually.be.eql(true);
    });
    it("rejects after 2 iterations", function () {
      const obj = {};
      setTimeout(() => (obj.test = true), 400);
      return localPromise
        .waitForKey(obj, "test", {maxIterations: 2})
        .should.eventually.rejectedWith(PromiseMaxIterationsError);
    });
  });
  describe("waitForResult", function () {
    it("resolves with a function who returns randomly", function () {
      const fn = async () => {
        const random = Math.random();
        if (random > 0.8) return true;
        return;
      };
      return localPromise.waitForResult(fn).should.eventually.be.eql(true);
    });
    it("rejects after 2 iterations", function () {
      const fn = async () => {
        return;
      };
      return localPromise
        .waitForResult(fn, {maxIterations: 2})
        .should.eventually.rejectedWith(PromiseMaxIterationsError);
    });
  });
});
