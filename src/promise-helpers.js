const PromiseDelay = Symbol("PromiseDelay");
function setName(func, name) {
  Object.defineProperty(func, "name", {value: name});
}
let functions = {};
function wrapper(name, {Static, Method, depends = []}) {
  const fn = (localPromise = Promise, force = false) => {
    depends.forEach(depend => {
      functions[depend](localPromise);
    });
    if (Method) {
      setName(Method, "name", name);
      if (!localPromise.prototype[name] || force) {
        localPromise.prototype[name] = Method;
      }
    }
    if (Static) {
      if (!localPromise[name] || force) {
        setName(Static, name);
        localPromise[name] = Static;
      }
      if (!localPromise.prototype[name]) {
        //aplicamos el prototype desde Static
        localPromise.prototype[name] = function (...args) {
          return this.constructor[name](this, ...args);
        };
        setName(localPromise.prototype[name], name);
      }
    }
  };
  functions[name] = fn;
  return fn;
}
wrapper("resolvePromise", {
  Static(prom) {
    return this.resolve(prom).then(prom => (typeof prom === "function" ? prom() : prom));
  }
});
wrapper("delay", {
  Static(time = 100, value) {
    return this.resolvePromise(value).then(
      result =>
        new this(res => {
          setTimeout(res, time, result);
        })
    );
  },
  Method(time = 100) {
    const promise = this.constructor;
    return this.then(val => promise.delay(time, val));
  },
  depends: ["resolvePromise"]
});
wrapper("atLeast", {
  Static(prom, time = 100) {
    return this.resolve(this.all([this.resolvePromise(prom), this.delay(time)]).get(0));
  },
  depends: ["get", "delay", "resolvePromise"]
});
wrapper("timeout", {
  Static(prom, time, error) {
    if (typeof time !== "number") {
      throw createError("PromiseTimeoutError", "time is not a number");
    }
    return this.race([
      this.resolvePromise(prom),
      this.delay(time).then(() => {
        if (typeof prom?.cancel === "function") {
          prom.cancel();
        }
        throw createError("PromiseTimeoutError", error || `Promise timeout in ${time}ms`, {time});
      })
    ]);
  },
  depends: ["delay", "resolvePromise"]
});
wrapper("timeoutDefault", {
  async Static(prom, time = 100, value, force = false) {
    if (typeof value === "undefined")
      throw createError("PromiseTimeoutDefaultError", "there is no default for timeoutDefault");
    try {
      return await this.timeout(prom, time);
    } catch (err) {
      if (err.name === "PromiseTimeoutError" || force) return value;
      throw err;
    }
  },
  depends: ["timeout"]
});
wrapper("attachTimers", {
  Static(prom, {delay, atLeast, timeout} = {}) {
    //check con coherence.
    if (atLeast && timeout && atLeast >= timeout)
      throw createError("PromiseTimersCoherenceError", "timeout must be greather than atLeast", {
        delay,
        atLeast,
        timeout
      });
    prom = this.resolvePromise(prom);
    atLeast && prom.atLeast(atLeast);
    timeout && prom.timeout(timeout);
    delay && prom.delay(delay);
    return prom;
  },
  depends: ["delay", "atLeast", "timeout", "resolvePromise"]
});
wrapper("map", {
  async Static(iterable, cb, {catchError = true, parallel = true, delay, atLeast, timeout} = {}) {
    const result = [];
    let id = 0;
    try {
      iterable = await this.resolvePromise(iterable);
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use map without an iterable object", {
          iterable
        });
      for (let prom of iterable) {
        try {
          prom = await prom;
          let res = this.resolve(cb(prom, id, iterable)).then(val => this.attachTimers(val, {delay, atLeast, timeout}));
          if (parallel) result.push(res);
          else result.push(await res);
        } catch (err) {
          if (catchError) {
            id--; //preserve id because of finally
            throw err;
          }
          result.push(err);
        } finally {
          id++;
        }
      }
    } catch (err) {
      if (err.name === "PromiseIterableError") throw err;
      throw createError("PromiseMapError", "some callback or iterator throws an error ", {iterable, id, result, err});
    }
    return parallel ? this.all(result) : result;
  },
  depends: ["attachTimers", "resolvePromise"]
});
wrapper("forEach", {
  async Static(iterable, cb, {parallel = true, delay, atLeast, timeout} = {}) {
    try {
      await this.map(iterable, cb, {catchError: true, parallel, delay, atLeast, timeout});
    } catch (error) {
      if (error.name === "PromiseMapError") {
        const {iterable, id, err} = error.args;
        throw createError("PromiseForEachError", "some callback or iterable throws error", {
          iterable,
          id,
          err
        });
      } else throw error;
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
      if (error.name === "PromiseMapError") {
        const {iterable, id, result, err} = error.args;
        throw createError("PromiseSequenceError", "some callback or iterable throws error", {
          iterable,
          id,
          result,
          err
        });
      } else throw error;
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
      const result = await this.map(iterable, cb, {...options, parallel: false});
      return result.reduce((arr, res) => {
        if (res !== PromiseDelay) arr.push(res);
        return arr;
      }, []);
    } catch (error) {
      if (error.name === "PromiseMapError") {
        const {iterable, id, result, err} = error.args;
        throw createError("PromiseSequenceError", "some callback or iterable throws error", {
          iterable,
          id,
          result,
          err
        });
      } else throw error;
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
      lastResult = result; //in case first iterator fails
      for await (const prom of iterable) {
        lastResult = result; //in case the result fails
        result = this.resolve(cb(result, prom, id, iterable)).attachTimers({delay, atLeast, timeout});
        result = await result;
        lastResult = result; //in case next iterator fails
        id++;
      }
    } catch (err) {
      if (err.name === "PromiseIterableError") throw err;
      throw createError("PromiseReduceError", "some iterable throws error", {lastResult, id, err, iterable});
    }
    return result;
  },
  depends: ["attachTimers"]
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
        throw createError("PromiseWaterfallError", "some callback or iterable throws error", {
          iterable,
          id,
          lastResult,
          err
        });
      } else throw error;
    }
  },
  depends: ["reduce"]
});
wrapper("get", {
  async Static(prom, key) {
    const result = await prom;
    key = await key;
    if (typeof result !== "object")
      throw createError("PromiseNotObject", "fulfilled promise is not an object", {result, key});
    if (key in result) return result[key];
    throw createError("PromiseKeyNotFound", `key ${key} not found`, {result, key});
  }
});
wrapper("keys", {
  async Static(prom) {
    const result = await prom;
    if (typeof result !== "object")
      throw createError("PromiseNotObject", "fulfilled promise is not an object", {result});
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
    try {
      return await this.resolvePromise(obj).get(key);
    } catch (error) {
      if (error.name === "PromiseKeyNotFound") {
        --maxIterations;
        if (maxIterations < 0) throw createError("PromiseMaxIterationsError", "Max iterations have been reached");
        await this.delay(ellapsed);
        return this.waitForKey(obj, key, {ellapsed, maxIterations});
      }
      throw error;
    }
  },
  depends: ["delay", "get", "resolvePromise"]
});
wrapper("waitForResult", {
  async Static(fn, {ellapsed = 100, delay, atLeast, maxIterations = 10000, retry = true, timeout} = {}, args = []) {
    if (!Array.isArray(args)) args = [args];
    try {
      args = await this.all(args);
      fn = await fn;
      let result = this.resolve(fn(...args)).attachTimers({delay, atLeast, timeout});
      result = await result;
      if (typeof result !== "undefined") return result;
      --maxIterations;
      if (maxIterations < 0) throw createError("PromiseMaxIterationsError", "Max iterations have been reached");
      await this.delay(ellapsed);
      return this.waitForResult(fn, {ellapsed, delay, atLeast, maxIterations, retry}, args);
    } catch (err) {
      if (err.name === "PromiseMaxIterationsError") throw err;
      if (retry) return this.waitForResult(fn, {ellapsed, delay, atLeast, maxIterations, retry, timeout}, args);
      else throw err;
    }
  },
  depends: ["delay", "attachTimers"]
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
        if (args?.err?.stack) this.stack += `\n  From Previous Error:\n${args.err.stack}`;
      }
    };
  return new errors[name](message, args);
}
//deploy all helpers
function promiseHelpers(localPromise = Promise) {
  for (const key in functions) {
    functions[key](localPromise);
  }
}
export {promiseHelpers, functions, errors, wrapper};
