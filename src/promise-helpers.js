const PromiseDelay = Symbol("PromiseDelay");
/* function setName(func, name) {
  Object.defineProperty(func, "name", {value: name});
} */
const functions = {};
function wrapper(name, {Static, Method, depends = []}) {
  // Validación crítica: async functions rompen el chaining de this.localPromise
  /* if (Static?.constructor?.name === 'AsyncFunction') {
    throw createError("WrapperAsyncError", `Wrapper '${name}' Static function cannot be async - breaks promise chaining`, "WRAPPER_ASYNC");
  }
  if (Method?.constructor?.name === 'AsyncFunction') {
    throw createError("WrapperAsyncError", `Wrapper '${name}' Method function cannot be async - breaks promise chaining`, "WRAPPER_ASYNC");
  } */

  const fn = (localPromise = Promise, force = false) => {
    depends.forEach(depend => {
      functions[depend](localPromise);
    });
    if (Method) {
      // setName(Method, name);
      if (!localPromise.prototype[name] || force) {
        // localPromise.prototype[name] = Method;
        localPromise.prototype[name] = function (...args) {
          return this.constructor.resolve(Method.call(this, ...args));
        };
      }
    }
    if (Static) {
      if (!localPromise[name] || force) {
        // Magia: wrappear con resolve para garantizar this.localPromise
        const wrappedStatic = (...args) => localPromise.resolve(Static.call(localPromise, ...args));
        // setName(wrappedStatic, name);
        localPromise[name] = wrappedStatic;
      }
      if (!localPromise.prototype[name]) {
        //aplicamos el prototype desde Static con magia
        localPromise.prototype[name] = function (...args) {
          return this.constructor.resolve(this.constructor[name](this, ...args));
        };
        // setName(localPromise.prototype[name], name);
      }
    }
  };
  functions[name] = fn;
  return fn;
}
//returns a resolved promise, if the resolved promise is a function, executes it
wrapper("resolvePromise", {
  /**
   * Resolves the promise and executes it if it's a function.
   *
   * @param {Promise} prom - The promise to resolve.
   * @returns {Promise} - A promise that resolves to the result of the executed function or the original value.
   */
  Static(prom) {
    return this.resolve(prom).then(prom => (typeof prom === "function" ? prom() : prom));
  }
});
//delay the resolved promise
wrapper("delay", {
  /**
   * Creates a new Promise that resolves after a specified time with the provided value.
   *
   * @param {number} time - The time in milliseconds to wait before resolving the Promise.
   * @param {*} value - The value to resolve the Promise with.
   * @returns {Promise} A Promise that resolves with the provided value after the specified time.
   */
  // biome-ignore lint/style/useDefaultParameterLast: <explanation>
  Static(time = 100, value) {
    return this.resolvePromise(value).then(
      result =>
        new this(res => {
          setTimeout(res, time, result);
        })
    );
  },
  /**
   * Delays the resolution of a Promise by a specified time.
   *
   * @param {number} time - The time to delay the resolution by.
   * @returns {Promise} A Promise that resolves after the specified time.
   */
  Method(time = 100) {
    const promise = this.constructor;
    return this.then(val => promise.delay(time, val));
  },
  depends: ["resolvePromise"]
});
//wait at least time to return
wrapper("atLeast", {
  /**
   * Returns the given promise after at least specified time.
   *
   * @param {Promise} prom - The promise to be executed.
   * @param {number} time - The time to wait before executing the promise (default is 100ms).
   * @returns {Promise} A promise that resolves with the result of the given promise.
   */
  Static(prom, time = 100) {
    return this.resolve(this.all([this.resolvePromise(prom), this.delay(time)]).get(0));
  },
  depends: ["get", "delay", "resolvePromise"]
});
//timesout a promise if it takes more than time
//TODO implement abotions with signals
wrapper("timeout", {
  /**
   * Executes a promise with a timeout.
   *
   * @param {Promise} prom - The promise to execute.
   * @param {number} time - The time in milliseconds before timing out.
   * @param {string} error - The error message to throw on timeout.
   * @returns {Promise} A promise that resolves when the input promise resolves or rejects on timeout.
   * @throws {Error} PromiseTimeoutError if the promise times out.
   */
  Static(prom, time, error) {
    if (typeof time !== "number") {
      throw createError("PromiseTimeoutError", "time is not a number", "TIMEOUT");
    }
    return this.race([
      this.resolvePromise(prom),
      this.delay(time).then(() => {
        if (typeof prom?.cancel === "function") {
          prom.cancel();
        }
        throw createError("PromiseTimeoutError", error || `Promise timeout in ${time}ms`, "TIMEOUT", {time});
      })
    ]);
  },
  depends: ["delay", "resolvePromise"]
});
//if a promise timesout, return the default value
wrapper("timeoutDefault", {
  /**
   * Executes a promise with a timeout, if it surpasses the timeout, the default is returned
   *
   * @param {Promise} prom - The promise to execute.
   * @param {number} [time=100] - The timeout duration in milliseconds.
   * @param {*} value - The value to return if the promise times out.
   * @param {boolean} [force=false] - Whether to force return the value on timeout.
   * @returns {*} The result of the promise execution or the specified value on timeout.
   * @throws {Error} PromiseTimeoutDefaultError - If no default value is provided for timeout.
   */
  // biome-ignore lint/style/useDefaultParameterLast: <explanation>
  Static(prom, time = 100, value, force = false) {
    if (typeof value === "undefined")
      return this.reject(
        createError("PromiseTimeoutDefaultError", "there is no default for timeoutDefault", "TIMEOUT_DEFAULT")
      );

    return this.timeout(prom, time).then(
      result => result,
      err => {
        if (err.name === "PromiseTimeoutError" || force) return value;
        throw err;
      }
    );
  },
  depends: ["timeout"]
});
//adds te three timers to a promise
wrapper("attachTimers", {
  /**
   * Static method to configure a promise with optional delay, atLeast, and timeout values.
   *
   * @param {Promise} prom - The promise to configure.
   * @param {Object} options - An object containing optional delay, atLeast, and timeout values.
   * @param {number} options.delay - The delay value to set on the promise.
   * @param {number} options.atLeast - The minimum time the promise should take to resolve.
   * @param {number} options.timeout - The maximum time the promise should take to resolve.
   * @returns {Promise} The configured promise.
   * @throws {Error} PromiseTimersCoherenceError - If timeout is not greater than atLeast.
   */
  async Static(prom, options = {}) {
    const {delay, atLeast, timeout} = options;

    if (atLeast && timeout && atLeast >= timeout)
      throw createError(
        "PromiseTimersCoherenceError",
        `timeout (${timeout}) must be greater than atLeast (${atLeast})`,
        "ATTACH_TIMERS",
        {
          delay,
          atLeast,
          timeout
        }
      );
    prom = this.resolvePromise(prom);

    // Encadenar timers dinámicamente manteniendo orden lógico
    const timers = ["atLeast", "timeout", "delay"];

    timers.forEach(timer => {
      if (options[timer]) {
        prom = prom[timer](options[timer]);
      }
    });

    return prom;
  },
  depends: ["delay", "atLeast", "timeout", "resolvePromise"]
});
//same as Array.map
wrapper("map", {
  /**
   * Asynchronously maps over an iterable using a callback function.
   *
   * @param {Iterable} iterable - The iterable to map over.
   * @param {Function} cb - The callback function to apply to each element.
   * @param {Object} options - Additional options.
   * @param {boolean} [options.catchError=true] - Whether to catch errors thrown during mapping.
   * @param {boolean} [options.parallel=true] - Whether to map elements in parallel.
   * @param {number} [options.delay] - Delay in milliseconds before resolving each element.
   * @param {number} [options.atLeast] - Minimum time in milliseconds to wait before resolving each element.
   * @param {number} [options.timeout] - Time in milliseconds after which to reject the promise.
   * @returns {Promise<Array>} A promise that resolves to an array of mapped values.
   */
  async Static(iterable, cb, {catchError = true, parallel = true, delay, atLeast, timeout} = {}) {
    const result = [];
    let id = 0;
    try {
      iterable = await this.resolvePromise(iterable);
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use map without an iterable object", "MAP", {
          iterable
        });
      for (let prom of iterable) {
        try {
          prom = await prom;
          const res = this.resolve(cb(prom, id, iterable)).attachTimers({delay, atLeast, timeout});
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
      throw createError("PromiseMapError", "some callback or iterator throws an error ", "MAP", {
        iterable,
        id,
        result,
        err,
        cause: err
      });
    }
    return parallel ? this.all(result) : result;
  },
  depends: ["attachTimers", "resolvePromise"]
});
wrapper("find", {
  /**
   * Asynchronously finds the first element in an iterable that satisfies the callback condition. Behaves as Array.find
   *
   * @param {Iterable} iterable - The iterable to search in.
   * @param {Function} cb - The callback function to test each element.
   * @param {Object} options - Additional options for the search.
   * @param {boolean} [options.catchError=true] - Flag to determine whether to catch errors during iteration.
   * @param {number} [options.delay] - Delay in milliseconds for each iteration.
   * @param {number} [options.atLeast] - Minimum time in milliseconds for each iteration.
   * @param {number} [options.timeout] - Timeout in milliseconds for each iteration.
   * @returns {*} - The first element that satisfies the callback, or undefined if none found.
   */
  async Static(iterable, cb, {catchError = true, delay, atLeast, timeout} = {}) {
    let id = 0;

    try {
      iterable = await this.resolvePromise(iterable);
      if (!iterable[Symbol.iterator]) {
        throw createError("PromiseIterableError", "trying to use find without an iterable object", "FIND", {iterable});
      }

      for (const prom of iterable) {
        try {
          const item = await prom; // Resolver la promesa primero como hace map
          const result = await this.resolve(cb(item, id, iterable)).attachTimers({delay, atLeast, timeout});
          if (result) {
            return item; // Return rápido - encontré el item
          }
        } catch (err) {
          if (catchError) {
            throw err; // Throw directo para que el catch de abajo lo capture
          }
          // Si catchError = false, no me importan los errores del ciclo, continúo
        }
        id++;
      }
      // Si llego acá, no encontré nada → undefined (como Array.find)
    } catch (err) {
      if (err.name === "PromiseIterableError") throw err; // PromiseIterableError siempre pasa
      // Cualquier otro error del ciclo se convierte en PromiseFindError
      throw createError("PromiseFindError", "some callback or iterator throws an error", "FIND", {
        iterable,
        id,
        err,
        cause: err
      });
    }
  },
  depends: ["attachTimers", "resolvePromise"]
});
wrapper("some", {
  /**
   * Asynchronously iterates over the given iterable behaves as Array.some
   *
   * @param {Iterable} iterable - The iterable to iterate over.
   * @param {Function} cb - The callback function to apply to each element.
   * @param {Object} options - Additional options for the iteration.
   * @param {boolean} [options.catchError=true] - Flag to determine whether to catch errors during iteration.
   * @param {number} [options.delay] - Delay in milliseconds for each iteration.
   * @param {number} [options.atLeast] - Minimum time in milliseconds for each iteration.
   * @param {number} [options.timeout] - Timeout in milliseconds for each iteration.
   * @returns {boolean} - True if any result is truthy during iteration, false otherwise.
   */
  async Static(iterable, cb, options = {}) {
    try {
      return !!(await this.find(iterable, cb, options));
    } catch (err) {
      if (err.name === "PromiseFindError") {
        const {iterable, id, err: originalErr} = err.args;
        throw createError("PromiseSomeError", "find operation failed in some", "SOME", {
          iterable,
          id,
          err: originalErr,
          cause: err
        });
      }
      throw err;
    }
  },
  depends: ["find"]
});
wrapper("forEach", {
  /**
   * Asynchronously iterates over the elements of the given iterable and calls the provided callback function on each element. Behaves as Array.forEach but it can work in "parallel"
   *
   * @param {Iterable} iterable - The iterable to iterate over.
   * @param {Function} cb - The callback function to call on each element.
   * @param {Object} options - Additional options for controlling the iteration.
   * @param {boolean} [options.parallel=true] - Whether to process elements in parallel.
   * @param {number} [options.delay] - Delay between processing elements.
   * @param {number} [options.atLeast] - minimum time for the resulting promise to be returned
   * @param {number} [options.timeout] - Timeout for processing each element.
   * @throws {Error} If an error occurs during iteration.
   */
  async Static(iterable, cb, {parallel = true, delay, atLeast, timeout} = {}) {
    try {
      await this.map(iterable, cb, {catchError: true, parallel, delay, atLeast, timeout});
    } catch (error) {
      if (error.name === "PromiseMapError") {
        const {iterable, id, err} = error.args;
        throw createError("PromiseForEachError", "some callback or iterable throws error", "FOREACH", {
          iterable,
          id,
          err,
          cause: err
        });
      }
      throw error;
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
        throw createError("PromiseSequenceError", "some callback or iterable throws error", "SEQUENCE", {
          iterable,
          id,
          result,
          err,
          cause: err
        });
      }
      throw error;
    }
  },
  depends: ["map", "delay"]
});
wrapper("sequenceAllSettled", {
  /**
   * Asynchronously processes an iterable using a callback function.
   *
   * @param {Iterable} iterable - The iterable to process.
   * @param {Object} options - Additional options for processing.
   * @returns {Array} - An array of processed values.
   * @throws {Error} - Throws an error if processing encounters an issue.
   */
  async Static(iterable, options = {}) {
    const cb = async v => {
      if (typeof v === "number") return this.delay(v, PromiseDelay);
      try {
        const res = this.resolve(v());
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
        throw createError("PromiseSequenceError", "some callback or iterable throws error", "SEQUENCE_ALL_SETTLED", {
          iterable,
          id,
          result,
          err,
          cause: err
        });
      }
      throw error;
    }
  },
  depends: ["map", "delay"]
});
wrapper("reduce", {
  /**
   * Reduces an iterable using a callback function with optional delay, atLeast, and timeout settings.
   *
   * @param {Iterable} iterable - The iterable to reduce.
   * @param {Function} cb - The callback function to execute on each element of the iterable.
   * @param {Promise} initVal - The initial value for the reduction.
   * @param {Object} options - Additional options like delay, atLeast, and timeout.
   * @param {number} options.delay - The delay in milliseconds.
   * @param {number} options.atLeast - The minimum time in milliseconds to wait.
   * @param {number} options.timeout - The maximum time in milliseconds to wait.
   * @returns {Promise} - A promise that resolves to the final result of the reduction.
   */
  async Static(iterable, cb, initVal, {delay, atLeast, timeout} = {}) {
    let result;
    let id = 0;
    let lastResult;
    try {
      result = await initVal;
      iterable = await iterable;
      if (!iterable[Symbol.iterator])
        throw createError("PromiseIterableError", "trying to use reduce without an iterable object", "REDUCE", {
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
      throw createError("PromiseReduceError", "some iterable throws error", "REDUCE", {
        lastResult,
        id,
        err,
        iterable,
        cause: err
      });
    }
    return result;
  },
  depends: ["attachTimers"]
});
wrapper("waterfall", {
  /**
   * Reduces the iterable made of functions or numbers in a waterfall sequence.
   * It allows to concatenates functions and delays to get the last value.
   * If a number is encountered in the iterable, delays the reduction by that amount.
   * If an error occurs during reduction, it is caught and rethrown with additional information.
   *
   * @param {Iterable} iterable - The iterable to be reduced.
   * @param {Function} initVal - The initial value for the reduction.
   * @param {Object} options - Additional options for the reduction.
   * @returns {Promise} - A promise that resolves to the final result of the reduction.
   */
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
        throw createError("PromiseWaterfallError", "some callback or iterable throws error", "WATERFALL", {
          iterable,
          id,
          lastResult,
          err,
          cause: err
        });
      }
      throw error;
    }
  },
  depends: ["reduce"]
});
wrapper("get", {
  /**
   * Asynchronously retrieves a value from a promise result object using a specified key.
   *
   * @param {Promise} prom - The promise to retrieve the result from.
   * @param {string} key - The key to look for in the result object.
   * @returns {Promise} A promise that resolves to the value associated with the specified key.
   * @throws {Error} PromiseNotObject - If the fulfilled promise is not an object.
   * @throws {Error} PromiseKeyNotFound - If the specified key is not found in the result object.
   */
  async Static(prom, key) {
    const result = await prom;
    key = await key;
    if (typeof result !== "object")
      throw createError("PromiseNotObject", "fulfilled promise is not an object", "GET", {result, key});
    if (key in result) return result[key];
    throw createError("PromiseKeyNotFound", `key ${key} not found`, "GET", {result, key});
  }
});
wrapper("keys", {
  /**
   * Asynchronously retrieves the keys of an object from a fulfilled promise.
   *
   * @param {Promise} prom - The promise to retrieve keys from.
   * @returns {Array} An array containing the keys of the object.
   * @throws {Error} If the fulfilled promise is not an object.
   */
  async Static(prom) {
    const result = await prom;
    if (typeof result !== "object")
      throw createError("PromiseNotObject", "fulfilled promise is not an object", "KEYS", {result});
    return Object.keys(await prom);
  }
});
wrapper("call", {
  /**
   * Asynchronous method that calls the resulting promise as a function with the provided arguments.
   *
   * @param {Object} thisObj - The object to bind to the function call.
   * @param {...any} args - Arguments to pass to the function call.
   * @returns {Promise<any>} - A promise that resolves with the result of the function call.
   * @throws {Error} - PromiseCallableError if the resulting promise is not a function.
   */
  async Method(thisObj, ...args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "resulting promise is not a function", "CALL", {result, thisObj, args});
    return result.call(thisObj, ...args);
  }
});
wrapper("apply", {
  /**
   * Asynchronously calls the resulting promise as a function with the provided arguments.
   *
   * @param {Object} thisObj - The object to bind to the function call.
   * @param {Array} args - The arguments to pass to the function call.
   * @returns {Promise} - A promise that resolves with the result of the function call.
   * @throws {Error} - PromiseCallableError if the resulting promise is not a function.
   */
  async Method(thisObj, args) {
    const result = await this;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "resulting promise is not a function", "APPLY", {
        result,
        thisObj,
        args
      });
    return result.apply(thisObj, args);
  }
});
wrapper("exec", {
  /**
   * Asynchronous method that calls a function with the provided arguments.
   *
   * @param {...any} args - Arguments to pass to the function.
   * @returns {Promise<any>} - Result of the function call.
   * @throws {Error} - If the resulting promise is not a function.
   */
  async Static(prom, ...args) {
    const result = await prom;
    if (typeof result !== "function")
      throw createError("PromiseCallableError", "resulting promise is not a function", "EXEC", {result, args});
    return result(...args);
  }
});
wrapper("waitForKey", {
  /**
   * Asynchronously retrieves a key from an object after resolving a promise.
   *
   * @param {Object} obj - The object to retrieve the key from.
   * @param {string} key - The key to retrieve from the object.
   * @param {Object} options - Additional options.
   * @param {number} [options.ellapsed=100] - The time to wait between iterations.
   * @param {number} [options.maxIterations=20] - The maximum number of iterations to attempt.
   * @returns {Promise} - A promise that resolves with the retrieved key value.
   * @throws {Error} - If the key is not found after the maximum iterations.
   */
  async Static(obj, key, {ellapsed = 100, maxIterations = 20} = {}) {
    try {
      return await this.resolvePromise(obj).get(key);
    } catch (error) {
      if (error.name === "PromiseKeyNotFound") {
        --maxIterations;
        if (maxIterations < 0)
          throw createError("PromiseMaxIterationsError", "Max iterations have been reached", "WAIT_FOR_KEY");
        await this.delay(ellapsed);
        return this.waitForKey(obj, key, {ellapsed, maxIterations});
      }
      throw error;
    }
  },
  depends: ["delay", "get", "resolvePromise"]
});
wrapper("waitForResult", {
  /**
   * Asynchronously executes a function with retry logic and timeouts.
   *
   * @param {Function} fn - The function to execute.
   * @param {Object} options - An object containing options for the execution.
   * @param {number} [options.ellapsed=100] - The time to wait between retries.
   * @param {number} options.delay - The delay before the first execution.
   * @param {number} options.atLeast - The minimum time to wait before the next retry.
   * @param {number} [options.maxIterations=20] - The maximum number of iterations before giving up.
   * @param {boolean} [options.retry=true] - Whether to retry on failure.
   * @param {number} options.timeout - The timeout for the function execution.
   * @param {Array} [args=[]] - Arguments to pass to the function.
   * @returns {Promise} - A promise that resolves with the result of the function.
   * @throws {Error} - If the maximum number of iterations is reached.
   */
  async Static(fn, {ellapsed = 100, delay, atLeast, maxIterations = 20, retry = true, timeout} = {}, args = []) {
    if (!Array.isArray(args)) args = [args];
    try {
      args = await this.all(args);
      fn = await fn;
      let result = this.resolve(fn(...args)).attachTimers({delay, atLeast, timeout});
      result = await result;
      if (typeof result !== "undefined") return result;
      --maxIterations;
      if (maxIterations < 0)
        throw createError("PromiseMaxIterationsError", "Max iterations have been reached", "WAIT_FOR_RESULT");
      await this.delay(ellapsed);
      return this.waitForResult(fn, {ellapsed, delay, atLeast, maxIterations, retry}, args);
    } catch (err) {
      if (err.name === "PromiseMaxIterationsError") throw err;
      if (retry) return this.waitForResult(fn, {ellapsed, delay, atLeast, maxIterations, retry, timeout}, args);
      throw err;
    }
  },
  depends: ["delay", "attachTimers"]
});
wrapper("tap", {
  /**
   * Allows "peeking" at a promise's resolution value or rejection reason
   * without affecting the main promise chain. Ideal for logging, debugging,
   * or executing side effects that should not modify the data flow.
   *
   * The callbacks (resultCallback, rejectCallback) are executed with the value or error.
   * The return values of these callbacks are ignored by `tap`. However,
   * if either callback throws an error, the promise returned by `tap`
   * will be rejected with that new error.
   *
   * @memberof Promise.prototype
   * @param {function(value: any): void} [resultCallback] - Function to execute if the promise is fulfilled.
   * It receives the resolution value.
   * @param {function(error: any): void} [rejectCallback] - Function to execute if the promise is rejected.
   * It receives the rejection reason.
   * @returns {Promise<any>} A new promise that resolves or rejects with the same value or error
   * as the original promise, after the appropriate callback (if provided)
   * has been executed.
   **/
  Method(resultCallback, rejectCallback) {
    return this.then(
      val => {
        if (typeof resultCallback === "function") resultCallback(val);
        return val;
      },
      err => {
        if (typeof rejectCallback === "function") rejectCallback(err);
        throw err;
      }
    );
  }
});

wrapper("callAttr", {
  /**
   * Calls a method on the resolved object, maintaining proper 'this' context
   */
  async Static(prom, attr, ...args) {
    const obj = await prom;
    return obj[attr].call(obj, ...args);
  }
});

wrapper("applyAttr", {
  /**
   * Applies a method on the resolved object with arguments array, maintaining proper 'this' context
   */
  async Static(prom, attr, args = []) {
    const obj = await prom;
    return obj[attr].apply(obj, args);
  }
});

//TODO
//implementar props, que entrega el objeto promesa con sus props resueltos.
//posible implementacioin de promisify, orientado al front ya que node lya lo tiene.
//ERRORS
const errors = {};
function createError(name, message, code, args) {
  if (!errors[name])
    errors[name] = class extends Error {
      constructor(message, args) {
        super(message);
        this.name = name;
        this.code = code;
        this.args = args ?? {};
        if (this.args?.err) this.args.cause = this.args.err;
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
export {promiseHelpers, functions, errors, wrapper, createError};
