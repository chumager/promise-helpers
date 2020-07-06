const functions = {
  //delay
  delay(localPromise = Promise, force = false) {
    if (!localPromise.delay || force) {
      localPromise.delay = (time = 100, value) => new localPromise(res => setTimeout(res, time, value));
      localPromise.prototype.delay = async function (time = 100) {
        try {
          const val = await this;
          return await new Promise(res => setTimeout(res, time, val));
        } catch (err) {
          return localPromise.reject(err);
        }
      };
    }
  },
  //atLeast
  atLeast(localPromise = Promise, force = false) {
    if (!localPromise.prototype.atLeast || force) {
      localPromise.prototype.atLeast = async function (time = 100) {
        const start = Date.now();
        const val = await this;
        const diff = Date.now() - start;
        if (time > diff) return await new Promise(res => setTimeout(res, time - diff, val));
        return val;
      };
    }
  },
  //timeout
  timeout(localPromise = Promise) {
    localPromise.prototype.timeout = function (time = 100, error) {
      if (typeof time === "string") {
        error = time;
        time = 100;
      }
      let response, reject;
      const P = new Promise((res, rej) => {
        response = res;
        reject = rej;
      });
      setTimeout(() => {
        let localError = createError("PromiseTimeoutError", error || `Promise timeout in ${time}ms`, time);
        reject(localError);
      }, time);
      this.then(response, reject);
      return P;
    };
  },
  //timeout default
  timeoutDefault(localPromise = Promise) {
    localPromise.prototype.timeoutDefault = function (time = 100, options = {default: null, chainable: true}) {
      if (options.default === null)
        return Promise.reject(createError("PromiseTimeoutDefaultError", "there is no default for timeoutDefault"));
      let response, reject;
      const P = new Promise((res, rej) => {
        response = res;
        reject = rej;
      });
      setTimeout(() => {
        response(options.default);
      }, time);
      this.then(response, err => {
        if (options.chainable) return reject(err);
        response(options.default);
      });
      return P;
    };
  },
  //sequence
  sequence(localPromise = Promise, options = {delay: null, atLeast: null}) {
    localPromise.sequence = async (iterable, {delay = null, atLeast = null} = options) => {
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use sequence withour an iterable object", {
          iterable,
          delay,
          atLeast
        });
      const result = [];
      try {
        for (let prom of iterable) {
          if (!["function", "number"].includes(typeof prom))
            throw createError("PromiseIterableError", "iterable is neither function nor number");
          switch (typeof prom) {
            case "function":
              prom = prom();
              break;
            case "number":
              await new localPromise(res => setTimeout(res, prom));
              continue;
          }
          if (delay) prom = localPromise.resolve(prom).delay(delay);
          if (atLeast) prom = localPromise.resolve(prom).atLeast(atLeast);

          result.push(await prom);
        }
      } catch (err) {
        if (err instanceof Error) {
          err.args = {result};
        }
        return localPromise.reject(err);
      }
      return result;
    };
  },
  //waterfall
  waterfall(localPromise = Promise, options = {delay: null, atLeast: null}) {
    localPromise.waterfall = async (iterable, {delay = null, atLeast = null, initial = undefined} = options) => {
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use sequence withour an iterable object", {
          iterable,
          delay,
          atLeast,
          initial
        });
      let result = initial;
      let id = 0;
      const localIterable = [...iterable];
      try {
        for (id = 0; id < localIterable.length; id++) {
          let prom = localIterable[id];
          if (!["function", "number"].includes(typeof prom))
            throw createError("PromiseIterableError", "iterable is neither function nor number");
          if (typeof prom === "number") {
            await new localPromise(res => setTimeout(res, prom));
            continue;
          }
          result = prom(result);
          if (delay) result = localPromise.resolve(result).delay(delay);
          if (atLeast) result = localPromise.resolve(result).atLeast(atLeast);
          result = await result;
        }
      } catch (err) {
        const error = createError("PromiseIterableError", "some iterable throws error");
        error.innerError = err;
        error.args = {result, id};
        return localPromise.reject(error);
      }
      return result;
    };
  },
  //get
  get(localPromise = Promise) {
    localPromise.prototype.get = async function (key) {
      try {
        const result = await this;
        if (key in result) return result[key];
        throw createError("PromiseKeyNotFound", `key ${key} not found`, {result, key});
      } catch (err) {
        return localPromise.reject(err);
      }
    };
  },
  //keys
  keys(localPromise = Promise) {
    localPromise.prototype.keys = async function () {
      return Object.keys(await this);
    };
  },
  //call
  call(localPromise = Promise) {
    localPromise.prototype.call = async function (thisObj, ...args) {
      const result = await this;
      if (typeof result !== "function")
        throw createError("PromiseCallableError", "localPromise is not a function", {thisObj, args});
      return await result.call(thisObj, ...args);
    };
  },
  //apply
  apply(localPromise = Promise) {
    localPromise.prototype.apply = async function (thisObj, args) {
      const result = await this;
      if (typeof result !== "function")
        throw createError("PromiseCallableError", "localPromise is not a function", {thisObj, args});
      return await result.apply(thisObj, args);
    };
  },
  //exec
  exec(localPromise = Promise) {
    localPromise.prototype.exec = async function (...args) {
      const result = await this;
      if (typeof result !== "function")
        throw createError("PromiseCallableError", "localPromise is not a function", {args});
      return await result(...args);
    };
  },
  //waitForKey
  waitForKey(localPromise = Promise, options = {ellapsed: 100, maxIterations: 10000}) {
    localPromise.waitForKey = async function (obj, key, {ellapsed = 100, maxIterations = 10000} = options) {
      if (key in obj) return obj[key];
      --maxIterations;
      if (maxIterations < 0) throw createError("PromiseMaxIterationsError", "Max iterations have been reached");
      await new localPromise(res => setTimeout(res, ellapsed));
      return localPromise.waitForKey(obj, key, {ellapsed, maxIterations});
    };
  },
  //waitForResult
  waitForResult(
    localPromise = Promise,
    options = {ellapsed: 100, delay: null, atLeast: null, maxIterations: 10000, retry: true, timeout: null}
  ) {
    localPromise.waitForResult = async function (
      fn,
      args,
      {ellapsed = 100, delay = null, atLeast = null, maxIterations = 10000, retry = true, timeout = null} = options
    ) {
      if (!Array.isArray(args)) args = [args];
      try {
        let result = localPromise.resolve(fn(...args));
        if (delay) result = result.delay(delay);
        if (atLeast) result = result.atLeast(atLeast);
        if (timeout) result = result.timeout(timeout);
        result = await result;
        if (typeof result !== "undefined") return result;
        --maxIterations;
        if (maxIterations < 0) throw createError("PromiseMaxIterationsError", "Max iterations have been reached");
        return localPromise.waitForResult(fn, args, {ellapsed, delay, atLeast, maxIterations, retry});
      } catch (err) {
        if (err instanceof errors.PromiseMaxIterationsError) return localPromise.reject(err);
        if (retry)
          return localPromise.waitForResult(fn, args, {ellapsed, delay, atLeast, maxIterations, retry, timeout});
        else return localPromise.reject(err);
      }
    };
  }
};
//ERRORS
const errors = {};
function createError(name, message, args) {
  if (!errors[name])
    errors[name] = class extends Error {
      constructor(message, args) {
        super(message);
        this.name = name;
        this.args = args;
      }
    };
  return new errors[name](message, args);
}
//deploy all helpers
function all(localPromise = Promise) {
  for (const key in functions) {
    functions[key](localPromise);
  }
}
//add all helpers to function
Object.assign(all, functions, errors);
export default all;
export {functions, errors};
