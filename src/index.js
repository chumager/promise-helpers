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
//delay
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
//atLeast
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
//timeout
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
//timeoutDefault
wrapper("timeoutDefault", {
  Static(prom, time = 100, value, force = false) {
    prom = this.resolve(prom);
    if (typeof value === "undefined")
      return this.reject(createError("PromiseTimeoutDefaultError", "there is no default for timeoutDefault"));
    return new this((res, rej) => {
      setTimeout(() => {
        res(value);
      }, time);
      prom.then(res, err => {
        if (force) return res(value);
        rej(err);
      });
    });
  }
});
//uncatch
wrapper("uncatch", {
  async Static(prom, transform = v => v) {
    return this.resolve(prom).catch(transform);
  }
});
//Map
wrapper("map", {
  async Static(iterable, cb, {catchError = true} = {}) {
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
          result.push(await cb(prom, id, iterable));
        } catch (err) {
          if (catchError) {
            if (err instanceof Error) {
              err.args = {
                iterable,
                id,
                result
              };
            }
            return this.reject(err);
          }
          result.push(err);
        } finally {
          id++;
        }
      }
    } catch (err) {
      return this.reject(err);
    }
    return result;
  }
});
//sequence
wrapper("sequence", {
  async Static(iterable, {delay = null, atLeast = null}) {
    const result = [];
    try {
      iterable = await iterable;
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use sequence without an iterable object", {
          iterable,
          delay,
          atLeast
        });
      for await (let prom of iterable) {
        if (!["function", "number"].includes(typeof prom))
          throw createError("PromiseIterableError", "iterable is neither function nor number");
        switch (typeof prom) {
          case "function":
            prom = prom();
            break;
          case "number":
            await new this(res => setTimeout(res, prom));
            continue;
        }
        if (delay) prom = this.resolve(prom).delay(delay);
        if (atLeast) prom = this.resolve(prom).atLeast(atLeast);

        result.push(await prom);
      }
    } catch (err) {
      if (err instanceof Error) {
        err.args = {result};
      }
      return this.reject(err);
    }
    return result;
  }
});
//map
//sequenceAllSettled
wrapper("sequenceAllSettled", {
  async Static(iterable, {delay = null, atLeast = null}) {
    const result = [];
    try {
      iterable = await iterable;
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use sequence withour an iterable object", {
          iterable,
          delay,
          atLeast
        });
      for (let prom of iterable) {
        if (!["function", "number"].includes(typeof prom))
          throw createError("PromiseIterableError", "iterable is neither function nor number");
        switch (typeof prom) {
          case "function":
            prom = prom();
            break;
          case "number":
            await new this(res => setTimeout(res, prom));
            continue;
        }
        if (delay) prom = this.resolve(prom).delay(delay);
        if (atLeast) prom = this.resolve(prom).atLeast(atLeast);
        try {
          const value = await prom;
          result.push({status: "fulfilled", value});
        } catch (reason) {
          result.push({status: "rejected", reason});
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        err.args = {result};
      }
      return this.reject(err);
    }
    return result;
  }
});
//waterfall
wrapper("waterfall", {
  async Static(iterable, {delay = null, atLeast = null, initVal = undefined}) {
    let result = initVal;
    let lastResult;
    let id = 0;
    try {
      iterable = await iterable;
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use sequence withour an iterable object", {
          iterable,
          delay,
          atLeast,
          initVal
        });
      for await (let fn of iterable) {
        lastResult = result;
        if (!["function", "number"].includes(typeof fn))
          throw createError("PromiseIterableError", "iterable is neither function nor number");
        if (typeof fn === "number") {
          await new this(res => setTimeout(res, fn));
          continue;
        }
        result = fn(result);
        if (delay) result = this.resolve(result).delay(delay);
        if (atLeast) result = this.resolve(result).atLeast(atLeast);
        result = await result;
        id++;
      }
    } catch (err) {
      const error = createError("PromiseIterableError", "some iterable throws error");
      error.innerError = err;
      error.args = {lastResult, id};
      return this.reject(error);
    }
    return result;
  }
});
//reduce
//TODO evaluar las condiciones de borde
wrapper("reduce", {
  async Static(iterable, cb, initVal, {delay = null, atLeast = null}) {
    let result = initVal;
    let id = 0;
    try {
      iterable = await iterable;
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use sequence withour an iterable object", {
          iterable,
          delay,
          atLeast,
          initVal
        });
      for await (const prom of iterable) {
        result = await cb(result, prom, id, iterable);
        id++;
      }
    } catch (err) {
      const error = createError("PromiseIterableError", "some iterable throws error");
      error.innerError = err;
      error.args = {result, id};
      return this.reject(error);
    }
    return result;
  }
});
//get
wrapper("get", {
  async Method(key) {
    const promise = this.constructor;
    try {
      const result = await this;
      if (key in result) return result[key];
      throw createError("PromiseKeyNotFound", `key ${key} not found`, {result, key});
    } catch (err) {
      return promise.reject(err);
    }
  }
});
//keys
wrapper("keys", {
  async Method() {
    return Object.keys(await this);
  }
});
//call
wrapper("call", {
  async Method(thisObj, ...args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "resulting promise is not a function", {thisObj, args});
    return result.call(thisObj, ...args);
  }
});
//apply
wrapper("apply", {
  async Method(thisObj, args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "localPromise is not a function", {thisObj, args});
    return result.apply(thisObj, args);
  }
});
//exec
wrapper("exec", {
  async Method(...args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "localPromise is not a function", {args});
    return result(...args);
  }
});
//waitForKey
wrapper("waitForKey", {
  async Static(obj, key, {ellapsed = 100, maxIterations = 10000} = {}) {
    try {
      key = await key;
      if (key in obj) return obj[key];
      --maxIterations;
      if (maxIterations < 0) throw createError("PromiseMaxIterationsError", "Max iterations have been reached");
      await new this(res => setTimeout(res, ellapsed));
      return this.waitForKey(obj, key, {ellapsed, maxIterations});
    } catch (err) {
      return this.reject(err);
    }
  }
});
//waitForResult
wrapper("waitForResult", {
  async Static(
    fn,
    {ellapsed = 100, delay = null, atLeast = null, maxIterations = 10000, retry = true, timeout = null} = {},
    args = []
  ) {
    if (!Array.isArray(args)) args = [args];
    try {
      args = await this.all(args);
      fn = await fn;
      let result = this.resolve(fn(...args));
      if (delay) result = result.delay(delay);
      if (atLeast) result = result.atLeast(atLeast);
      if (timeout) result = result.timeout(timeout);
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
