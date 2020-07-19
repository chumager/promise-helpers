const PromiseDelay = Symbol("PromiseDelay");
let functions = {};
function wrapper(name, {Static, Method, depends = []}) {
  const fn = (localPromise = Promise, force = false) => {
    depends.forEach(depend => {
      functions[depend](localPromise);
    });
    if (Method) {
      if (!localPromise.prototype[name] || force) {
        localPromise.prototype[name] = Method;
      }
    }
    if (Static) {
      if (!localPromise[name] || force) {
        localPromise[name] = Static;
      }
      if (!localPromise.prototype[name]) {
        //aplicamos el prototype desde Static
        localPromise.prototype[name] = function (...args) {
          return this.constructor[name](this, ...args);
        };
      }
    }
  };
  functions[name] = fn;
  return fn;
}
wrapper("delay", {
  Static(time = 100, value) {
    return new this((res, rej) => {
      setTimeout(res, time, value);
      this.resolve(value).catch(rej);
    });
  },
  Method(time = 100) {
    const promise = this.constructor;
    return this.then(val => promise.delay(time, val));
  }
});
wrapper("atLeast", {
  Static(prom, time = 100) {
    const start = Date.now();
    return this.resolve(prom).then(val => {
      const diff = Date.now() - start;
      if (time > diff) return new this(res => setTimeout(res, time - diff, val));
      return val;
    });
  }
});
wrapper("timeout", {
  Static(prom, time, error) {
    if (typeof time !== "number") {
      throw createError("PromiseTimeoutError", "time is not a number");
    }
    return new this((res, rej) => {
      setTimeout(() => {
        rej(createError("PromiseTimeoutError", error || `Promise timeout in ${time}ms`, {time}));
      }, time);
      const Prom = typeof prom === "function" ? prom : () => prom;
      this.resolve(Prom()).then(res, rej);
    });
  }
});
wrapper("timeoutDefault", {
  async Static(prom, time = 100, value, force = false) {
    if (typeof value === "undefined")
      return this.reject(createError("PromiseTimeoutDefaultError", "there is no default for timeoutDefault"));
    try {
      return await this.timeout(prom, time);
    } catch (err) {
      if (err instanceof errors.PromiseTimeoutError || force) return value;
      return this.reject(err);
    }
  },
  depemds: ["timeout"]
});
wrapper("map", {
  async Static(iterable, cb, {catchError = true, parallel = true, delay, atLeast, timeout} = {}) {
    const result = [];
    let id = 0;
    try {
      iterable = await iterable;
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use map without an iterable object", {
          iterable
        });
      for (let prom of iterable) {
        try {
          prom = await prom;
          let res = this.resolve(cb(prom, id, iterable));
          if (delay) res = res.delay(delay);
          if (atLeast) res = res.atLeast(atLeast);
          if (timeout) res = res.timeout(timeout);
          if (parallel) result.push(res);
          else result.push(await res);
        } catch (err) {
          if (catchError) {
            return this.reject(
              createError("PromiseMapError", "some callback or iterator throws an error", {iterable, id, result, err})
            );
          }
          result.push(err);
        } finally {
          id++;
        }
      }
    } catch (err) {
      if (err instanceof errors.PromiseIterableError) throw err;
      return this.reject(
        createError("PromiseMapError", "some callback or iterator throws an error ", {iterable, id, result, err})
      );
    }
    return parallel ? this.all(result) : result;
  },
  depends: ["delay", "atLeast", "timeout"]
});
wrapper("forEach", {
  async Static(iterable, cb, {parallel = true, delay, atLeast, timeout} = {}) {
    try {
      await this.map(iterable, cb, {catchError: true, parallel, delay, atLeast, timeout});
    } catch (error) {
      if (error instanceof errors.PromiseMapError) {
        const {iterable, id, err} = error.args;
        return this.reject(
          createError("PromiseForEachError", "some callback or iterable throws error", {
            iterable,
            id,
            err
          })
        );
      } else return this.reject(error);
    }
  },
  depends: ["map"]
});
wrapper("sequence", {
  async Static(iterable, options = {}) {
    const cb = v => {
      if (typeof v === "number") return this.delay(v, PromiseDelay);
      return v();
    };
    try {
      const result = await this.map(iterable, cb, {parallel: false, ...options});
      return result.reduce((arr, res) => {
        if (res !== PromiseDelay) arr.push(res);
        return arr;
      }, []);
    } catch (error) {
      if (error instanceof errors.PromiseMapError) {
        const {iterable, id, result, err} = error;
        return this.reject(createError("PromiseSequenceError", "some callback or iterable throws error"), {
          iterable,
          id,
          result,
          err
        });
      } else return this.reject(error);
    }
  },
  depends: ["map", "delay"]
});
wrapper("sequenceAllSettled", {
  async Static(iterable, options = {}) {
    const cb = async v => {
      if (typeof v === "number") return this.delay(v, PromiseDelay);
      try {
        let res = this.resolve(v());
        return {status: "fulfilled", value: await res};
      } catch (reason) {
        return {status: "rejected", reason};
      }
    };
    try {
      const result = await this.map(iterable, cb, {parallel: false, ...options});
      return result.reduce((arr, res) => {
        if (res !== PromiseDelay) arr.push(res);
        return arr;
      }, []);
    } catch (error) {
      if (error instanceof errors.PromiseMapError) {
        const {iterable, id, result, err} = error;
        return this.reject(createError("PromiseSequenceError", "some callback or iterable throws error"), {
          iterable,
          id,
          result,
          err
        });
      } else return this.reject(error);
    }
  },
  depends: ["map", "delay"]
});
wrapper("reduce", {
  async Static(iterable, cb, initVal, {delay, atLeast, timeout} = {}) {
    let result;
    let id = 0;
    let lastResult;
    try {
      result = await initVal;
      iterable = await iterable;
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use reduce without an iterable object", {
          iterable
        });
      lastResult = result;
      for await (const prom of iterable) {
        lastResult = result;
        result = this.resolve(cb(result, prom, id, iterable));
        delay && (result = result.delay(delay));
        atLeast && (result = result.atLeast(atLeast));
        timeout && (result = result.timeout(timeout));
        result = await result;
        lastResult = result;
        id++;
      }
    } catch (err) {
      if (err.name === "PromiseIterableError") throw err;
      return this.reject(
        createError("PromiseReduceError", "some iterable throws error", {lastResult, id, err, iterable})
      );
    }
    return result;
  },
  depends: ["delay", "atLeast", "timeout"]
});
wrapper("waterfall", {
  async Static(iterable, initVal, options) {
    const cb = (result, v) => {
      if (typeof v === "number") return this.delay(v, result);
      return v(result);
    };
    try {
      return await this.reduce(iterable, cb, initVal, options);
    } catch (error) {
      if (error.name === "PromiseReduceError") {
        const {iterable, id, lastResult, err} = error.args;
        return this.reject(
          createError("PromiseWaterfallError", "some callback or iterable throws error", {
            iterable,
            id,
            lastResult,
            err
          })
        );
      } else return this.reject(error);
    }
  },
  depends: ["reduce"]
});
wrapper("get", {
  async Static(prom, key) {
    const result = await prom;
    if (key in result) return result[key];
    throw createError("PromiseKeyNotFound", `key ${key} not found`, {result, key});
  }
});
wrapper("keys", {
  async Static(prom) {
    return Object.keys(await prom);
  }
});
wrapper("call", {
  async Method(thisObj, ...args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "resulting promise is not a function", {result, thisObj, args});
    return result.call(thisObj, ...args);
  }
});
wrapper("apply", {
  async Method(thisObj, args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "resulting promise is not a function", {result, thisObj, args});
    return result.apply(thisObj, args);
  }
});
wrapper("exec", {
  async Method(...args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "resulting promise is not a function", {result, args});
    return result(...args);
  }
});
wrapper("waitForKey", {
  async Static(obj, key, {ellapsed = 100, maxIterations = 10000} = {}) {
    key = await key;
    if (key in obj) return obj[key];
    --maxIterations;
    if (maxIterations < 0) throw createError("PromiseMaxIterationsError", "Max iterations have been reached");
    await this.delay(ellapsed);
    return this.waitForKey(obj, key, {ellapsed, maxIterations});
  },
  depens: ["delay"]
});
wrapper("waitForResult", {
  async Static(fn, {ellapsed = 100, delay, atLeast, maxIterations = 10000, retry = true, timeout} = {}, args = []) {
    if (!Array.isArray(args)) args = [args];
    try {
      args = await this.all(args);
      fn = await fn;
      let result = this.resolve(fn(...args));
      delay && (result = result.delay(delay));
      atLeast && (result = result.atLeast(atLeast));
      timeout && (result = result.timeout(timeout));
      result = await result;
      if (typeof result !== "undefined") return result;
      --maxIterations;
      if (maxIterations < 0) throw createError("PromiseMaxIterationsError", "Max iterations have been reached");
      await new this(res => setTimeout(res, ellapsed));
      return this.waitForResult(fn, {ellapsed, delay, atLeast, maxIterations, retry}, args);
    } catch (err) {
      if (err instanceof errors.PromiseMaxIterationsError) return this.reject(err);
      if (retry) return this.waitForResult(fn, {ellapsed, delay, atLeast, maxIterations, retry, timeout}, args);
      else return this.reject(err);
    }
  }
});
//TODO
//toJSON
//
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
Object.assign(all, functions, errors, {wrapper});

export default all;
export {functions, errors, wrapper};
