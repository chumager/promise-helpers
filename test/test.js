"use strict";
const {
  default: PromiseHelpers,
  errors: {
    PromiseTimeoutError,
    PromiseIterableError,
    PromiseTimeoutDefaultError,
    PromiseKeyNotFound,
    PromiseMaxIterationsError
  }
} = require("../");
PromiseHelpers();
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();

describe("Test", function () {
  this.slow(100);
  describe("delay", function () {
    it("Promise.delay took around 100ms", function () {
      return Promise.delay(100).should.be.fulfilled;
    });
    it("Promise.delay behaves well with rejections", function () {
      return Promise.reject("ERROR")
        .delay(100)
        .catch(err => err)
        .delay(100)
        .should.eventually.be.equal("ERROR");
    });
    it("delay behaves well with rejections in several delay chained", function () {
      return Promise.reject("ERROR").delay(100).delay(100).delay(100).delay(100).delay(100).should.eventually.be
        .rejected;
    });
    it("Promise.resolve.delay took around 100ms", function () {
      const res = Promise.resolve("test").delay(100);
      return res.should.eventually.be.equal("test");
    });
    it("Promise delay chain took around 100ms", function () {
      const res = Promise.resolve("test").delay(20).delay(20).delay(20).delay(20).delay(20);
      return res.should.eventually.be.equal("test");
    });
    it("Promise delay chain in for loop took around 100ms", function () {
      let res = Promise.resolve("test");
      for (let i = 0; i < 5; i++) {
        res = res.delay(20);
      }
      return res.should.eventually.be.equal("test");
    });
    it("Promise all delay took around 100ms", function () {
      const arr = [...Array(5).keys()];
      const res = Promise.all(arr.map(v => Promise.resolve(v).delay(20)));
      return res.should.eventually.be.eql(arr);
    });
  });
  describe("atLeast", function () {
    it("Promise resolves at least in 100ms", function () {
      return Promise.delay(50).atLeast(100).should.be.fulfilled;
    });
    it("Promise resolves arround 100ms with atLeast 50ms", function () {
      return Promise.delay(100).atLeast(50).should.be.fulfilled;
    });
    it("Promise of 50ms chained with 5 atLeast of 100ms", function () {
      return Promise.delay(50).atLeast(100).atLeast(100).atLeast(100).atLeast(100).atLeast(100).should.be.fulfilled;
    });
  });
  describe("timeout", function () {
    it("Promise resolves before 100ms", function () {
      return Promise.delay(50).timeout(100).should.be.fulfilled;
    });
    it("Promise behaves well with rejection", function () {
      return Promise.reject(50).timeout(100).should.be.rejectedWith(50);
    });
    it("Promise rejects after 100ms", function () {
      return Promise.delay(600).timeout(100).should.be.rejected;
    });
    it("Promise timeout error is PromiseTimeoutError", function () {
      return Promise.delay(200).timeout(100).should.be.rejectedWith(PromiseTimeoutError);
    });
    it("timeout behaves well in chained incremental timeouts", function () {
      return Promise.delay(200)
        .timeout(100)
        .timeout(200)
        .timeout(300)
        .timeout(400)
        .timeout(500)
        .should.be.rejectedWith(PromiseTimeoutError);
    });
    it("timeout behaves well in chained decremental timeouts", function () {
      return Promise.delay(200)
        .timeout(500)
        .timeout(400)
        .timeout(300)
        .timeout(200)
        .timeout(100)
        .should.be.rejectedWith(PromiseTimeoutError);
    });
  });
  describe("timeoutDefault", function () {
    it("Promise rejects correctly with no default", function () {
      return Promise.resolve().timeoutDefault(100).should.be.rejectedWith(PromiseTimeoutDefaultError);
    });
    it("Promise timeout in 100ms and returns true as default", function () {
      return Promise.delay(200).timeoutDefault(100, {default: true}).should.eventually.be.eq(true);
    });
    it("Promise rejects and chain with timeoutDefault", function () {
      return Promise.reject(false).timeoutDefault(100, {default: true, chainable: false}).should.eventually.be.eq(true);
    });
  });
  describe("sequence", function () {
    it("Promise sequence resolves around 100ms with 5 delays of 20ms", function () {
      return Promise.sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {delay: 20}).should.eventually.eql([
        1,
        2,
        3,
        4,
        5
      ]);
    });
    it("Promise sequence resolves around 200ms with 5 delays of 20ms and one delay of 100ms", function () {
      return Promise.sequence([() => 1, () => 2, () => 3, 100, () => 4, () => 5], {delay: 20}).should.eventually.eql([
        1,
        2,
        3,
        4,
        5
      ]);
    });
    it("Promise sequence resolves around 100ms with 5 atLeast of 20ms", function () {
      return Promise.sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {atLeast: 20}).should.eventually.eql([
        1,
        2,
        3,
        4,
        5
      ]);
    });
    it("Promise sequence resolves around 100ms with 5 delays of 20ms and atLeast of 10ms", function () {
      return Promise.sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {
        delay: 20,
        atLeast: 10
      }).should.eventually.eql([1, 2, 3, 4, 5]);
    });
    it("Promise sequence behaves well with rejected promises", function () {
      return Promise.sequence([() => 1, () => 2, () => Promise.reject("ERROR"), () => 4, () => 5], {
        delay: 20,
        atLeast: 10
      }).should.be.rejectedWith("ERROR");
    });
    it("Promise sequence with no iterable rejects correctly", function () {
      return Promise.sequence({test: "Hello World"}, {delay: 20}).should.be.rejectedWith(PromiseIterableError);
    });
  });
  describe("waterfall", function () {
    it("Promise waterfall resolves around 100ms with global delay of 20ms", function () {
      return Promise.waterfall([v => v + 1, v => v * 2, v => v ** 3, v => v - 4, v => v / 10], {
        delay: 20,
        initial: 1
      }).should.eventually.eq(6);
    });
    it("Promise waterfall resolves around 100ms with 5 delays of 20ms", function () {
      return Promise.waterfall(
        [
          v => Promise.resolve(v + 1).delay(20),
          v => Promise.resolve(v * 2).delay(20),
          v => Promise.resolve(v ** 3).delay(20),
          v => Promise.resolve(v - 4).delay(20),
          v => Promise.resolve(v / 10).delay(20)
        ],
        {
          initial: 1
        }
      ).should.eventually.eq(6);
    });
    /*
     *it("Promise sequence resolves around 200ms with 5 delays of 20ms and one delay of 100ms", function () {
     *  return Promise.sequence([() => 1, () => 2, () => 3, 100, () => 4, () => 5], {delay: 20}).should.eventually.eql([
     *    1,
     *    2,
     *    3,
     *    4,
     *    5
     *  ]);
     *});
     */
    /*
     *it("Promise sequence resolves around 100ms with 5 atLeast of 20ms", function () {
     *  return Promise.sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {atLeast: 20}).should.eventually.eql([
     *    1,
     *    2,
     *    3,
     *    4,
     *    5
     *  ]);
     *});
     */
    /*
     *it("Promise sequence resolves around 100ms with 5 delays of 20ms and atLeast of 10ms", function () {
     *  return Promise.sequence([() => 1, () => 2, () => 3, () => 4, () => 5], {
     *    delay: 20,
     *    atLeast: 10
     *  }).should.eventually.eql([1, 2, 3, 4, 5]);
     *});
     */
    it("waterfall behaves well with rejected promises and inform last id well proccessed", function () {
      return Promise.waterfall([v => v + 1, v => v * 2, () => Promise.reject("ERROR"), v => v + 4, v => v * 5], {
        delay: 20,
        atLeast: 10
      })
        .should.be.eventually.rejectedWith(PromiseIterableError, "some iterable")
        .to.have.nested.property("args.id", 2);
    });
    /*
     *it("Promise sequence with no iterable rejects correctly", function () {
     *  return Promise.sequence({test: "Hello World"}, {delay: 20}).should.be.rejectedWith(PromiseIterableError);
     *});
     */
  });
  describe("get", function () {
    it("Promise resolves object and get property", function () {
      return Promise.resolve({test: "Hello World"}).get("test").should.eventually.be.eq("Hello World");
    });
    it("Promise rejects well with no key found", function () {
      return Promise.resolve({test: "Hello World"}).get("a").should.be.rejectedWith(PromiseKeyNotFound);
    });
  });
  describe("keys", function () {
    it("Promise resolves object and get keys", function () {
      return Promise.resolve({a: 1, b: 2, c: 3}).keys().should.eventually.be.eql(["a", "b", "c"]);
    });
  });
  describe("waitForKey", function () {
    it("assign key after 400ms and resolves", function () {
      const obj = {};
      setTimeout(() => (obj.test = true), 400);
      return Promise.waitForKey(obj, "test").should.eventually.be.eql(true);
    });
    it("rejects after 2 iterations", function () {
      const obj = {};
      setTimeout(() => (obj.test = true), 400);
      return Promise.waitForKey(obj, "test", {maxIterations: 2}).should.eventually.rejectedWith(
        PromiseMaxIterationsError
      );
    });
  });
});
