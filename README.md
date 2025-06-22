# @chumager/promise-helpers

Promise Helpers to enhance your asynchronous workflows with advanced control, chaining, and extensibility.

## Motivation

Working with promises, especially when interacting with external services or managing complex asynchronous flows, often requires more than the basic Promise API offers. You might find yourself:

* Dealing with slow or unreliable services that necessitate timeouts or controlled delays.
* Needing to sequence operations strictly, one after another, perhaps with pauses in between.
* Wanting to process collections asynchronously (like `map` or `forEach`) with control over parallelism and timing for each operation.
* Looking for a way to make your promise chains more expressive and less verbose for common patterns.

While a common goal is to resolve promises as quickly as possible, many real-world scenarios benefit from a more **controlled, sequential, or resource-aware** approach. This library provides a suite of chainable helper methods to augment native `Promise` (or any Promise A+ compatible constructor) with these capabilities, making it easier to manage such complex asynchronous workflows with a high level of abstraction.

And yes, I love chaining! Almost all methods (static and instance) in this library return promises, so you can keep those chains flowing.

## Key Features

* **Timing Control:** `delay`, `timeout`, `atLeast` to precisely manage when and how long promises take to resolve or before they are considered overdue.
* **Flow Control:** Asynchronous versions of `map`, `forEach`, `some`, `reduce`, plus `sequence` and `waterfall` for orchestrating complex ordered operations.
* **Utility Methods:** Helpers like `get` (retrieve a property from a resolved object, expecting it to be a function if used with `exec`), `exec`/`call`/`apply` (invoke a resolved function-promise), `resolvePromise` (resolves a value, and executes it if it's a function).
* **Highly Extensible:** Use the powerful `wrapper` function to easily define and attach your own custom chainable methods to any Promise constructor.
* **Flexible:** Works with the global native `Promise` or can be applied to custom Promise-compatible classes, keeping global prototypes untouched if you prefer.
* **Fluent API:** Most methods return promises, allowing for expressive and readable promise chains.

## Installation

```sh
# pnpm
pnpm add @chumager/promise-helpers

# yarn
yarn add @chumager/promise-helpers

# npm
npm install @chumager/promise-helpers
```

## Basic Usage

To activate the helpers on the global `Promise` object (this modifies `Promise.prototype` and `Promise` itself):

```javascript
import { promiseHelpers } from '@chumager/promise-helpers';

// Enhances the global Promise object
promiseHelpers();

// Now you can use the helpers:
Promise.resolve([1, 2, 3])
  .map(async num => {
    await Promise.delay(10 * num); // Static delay
    return num * 2;
  }, { parallel: true }) // Process in parallel
  .tap(console.log, console.error);    // Output: [2, 4, 6] (order may vary due to parallelism)

Promise.resolve("Hello")
  .delay(100) // Instance delay
  .then(msg => console.log(`${msg} after 100ms!`));
```

## Advanced Usage & Extensibility

A core strength of `promise-helpers` is its extensibility. You can easily create and attach your own custom promise methods using the `wrapper` function.

**Example: Simplifying Repetitive Fetch Logic**

Imagine a scenario where you fetch data, then need to get its JSON representation, and this pattern repeats.

**Initial code using base helpers:**
```javascript
import { promiseHelpers } from '@chumager/promise-helpers';
promiseHelpers(); // Augment global Promise

// Assuming fetch is available and returns a Promise<Response>
// And Response.json() returns a Promise<any>

fetch("someURL")
  .timeout(1000, "First request took too long")
  .get("json") // Gets the 'json' method from the Response object
  .exec()      // Executes the Response.json() method
  .map( // Use static map for clarity or if arrayOfUrls is not a promise
    async url => fetch(url)
      .get("json")
      .exec()
      .timeout(2000, `URL: ${url} took more than 2000ms`),
        {
          atLeast: 1000,    // Each fetch operation takes at least 1s
          parallel: false   // Process URLs sequentially
        }
  )
  .tap(results => console.log("Final results:", results),
  error => console.error("Error in sequence:", error));
```

The `.get("json").exec()` part is repetitive. Let's create a custom `.json()` method:

```javascript
import { promiseHelpers, wrapper } from '@chumager/promise-helpers';

promiseHelpers(); // Ensure global Promise is augmented with base helpers like .get, .exec

wrapper("json", { // Define a new instance method called "json"
  Method() {
    return this.get("json").exec(); // 'this' refers to the promise instance
  }
})(Promise); // Attach it to the global Promise

// Now the code becomes cleaner:
fetch("someURL")
  .timeout(1000, "First request took too long")
  .json() // Our new custom method!
  .map(
    async url => fetch(url)
      .json() // Use it again!
      .timeout(2000, `URL: ${url} took more than 2000ms`),
        {
          atLeast: 1000,
          parallel: false
        }
  );
});
```

Want a `.json()` method that also includes a timeout? Easy!

```javascript
import { promiseHelpers, wrapper } from '@chumager/promise-helpers';
promiseHelpers();
wrapper("json", { Method() { return this.get("json").exec(); }})(Promise); // From previous example

wrapper("jsonT", { // "jsonWithTimeout"
  Method(ms, errorMessage = "Fetch (jsonT) took too long") {
    return this.json().timeout(ms, errorMessage);
  }
})(Promise);

// Resulting usage:
fetch("someURL")
  .jsonT(1000, "First request (jsonT) took too long")
  .then(arrayOfUrls => { /* ... */ });
```

That's why I created this module, and obviously, I use it in all my developments!

## Avoiding Global Prototype Modification

If you prefer not to modify the global `Promise.prototype` (a valid concern for some projects or teams), you can apply these helpers exclusively to your own custom Promise class:

```javascript
import { promiseHelpers, wrapper } from '@chumager/promise-helpers';

class MySafePromise extends Promise {}

// Apply base helpers only to MySafePromise
promiseHelpers(MySafePromise);

// Example: Add a custom .json() method only to MySafePromise
wrapper("json", {
  Method() {
    // .get and .exec come from promiseHelpers(MySafePromise)
    return this.get("json").exec();
  }
})(MySafePromise);


// Now use MySafePromise for all operations needing these helpers
MySafePromise.resolve(fetch("someURL")) // Wrap the fetch promise
  .json() // Uses the .json method from MySafePromise.prototype
  .then(data => console.log("Delayed data:", data));

// Global Promise remains untouched
// Promise.resolve().json(); // This would error, as global Promise is not augmented
```

## Important Considerations

* **Versatile Inputs:** Most helpers are designed to seamlessly process synchronous values, asynchronous promises, or functions (which might return values or promises) as their inputs or callback arguments. This is typically handled by an internal `resolvePromise` call on inputs where appropriate.
* **Consistent Promise Type:** All methods that return new promises will return an instance of the `Promise` constructor you originally augmented (be it the global `Promise` or your custom class). This ensures type consistency throughout your chains.
* **Prototypal & Static Methods:** The library adds both static methods (e.g., `Promise.map()`) and instance methods (e.g., `aPromise.map()`). The `wrapper` automatically creates an instance method that calls the static one if an instance method isn't explicitly provided.

## Found an Issue or Have a Suggestion?

This library aims to be robust. If you find any problems with chaining, resolution, or have ideas for new helpers, please [add an issue to the repository](https://github.com/chumager/promise-helpers/issues).

## API Reference

<details>
<summary><strong>🕐 Timing Control</strong></summary>

### `delay(time = 100, value)`
Delays execution by specified milliseconds.
```javascript
// Method (most common after promiseHelpers())
fetch("/api").delay(50); // Delays fetch result by 50ms
axios.get("/users").delay(100); // Works with any promise

// Static
Promise.delay(100, "hello").then(console.log); // "hello" after 100ms

// With function
Promise.delay(100, () => "computed").then(console.log);
```

### `timeout(promise, time, errorMessage)`
Rejects if promise takes longer than specified time.
```javascript
// Method (most common)
fetch("/api").timeout(1000, "API too slow"); // Fails after 1s
axios.post("/data", payload).timeout(5000, "Post timeout");

// Static
Promise.timeout(fetch("/api"), 1000, "API too slow");

// Chaining with other methods
fetch("/api").timeout(2000).callAttr("json");
```

### `atLeast(promise, time = 100)`
Ensures promise takes at least the specified time.
```javascript
// Method (most common)
fetch("/fast-api").atLeast(500); // At least 500ms even if API is faster
axios.get("/cache").atLeast(200); // Prevents UI flicker

// Static
Promise.atLeast(fetch("/api"), 100);

// UX improvements - loading states
loadUser().atLeast(1000); // Show spinner for at least 1s
```

### `attachTimers(promise, options)`
**Options:** `{delay?, atLeast?, timeout?}`
Combines all timing controls in one call.
```javascript
// Method (most common)
fetch("/api").attachTimers({
  atLeast: 100,   // At least 100ms
  timeout: 5000,  // Max 5s  
  delay: 50       // Plus 50ms delay
}).callAttr("json"); // Perfect chaining!

// Static
Promise.attachTimers(fetch("/api"), {timeout: 1000, atLeast: 200});

// Real world - controlled API calls
getUserData().attachTimers({atLeast: 500, timeout: 10000});
```

</details>

<details>
<summary><strong>🔄 Flow Control</strong></summary>

### `map(iterable, callback, options)`
**Options:** `{catchError = true, parallel = true, delay?, atLeast?, timeout?}`
Async version of Array.map with timing and parallelism control.
```javascript
// Method (most common) - API REST calls
Promise.resolve(userIds).map(async id => {
  return fetch(`/api/users/${id}`).callAttr('json');
}, {parallel: true, timeout: 2000}); // Parallel API calls with timeout

// Static - Database queries
Promise.map(records, async record => db.save(record), {parallel: false});

// File operations - Sequential to avoid overload
filePaths.map(path => fs.readFile(path), {parallel: false, delay: 50});
```

### `forEach(iterable, callback, options)`
**Options:** `{parallel = true, delay?, atLeast?, timeout?}`
Async forEach with parallel/sequential control.
```javascript
// Method (most common) - Database batch operations
Promise.resolve(users).forEach(async user => {
  await db.updateUser(user.id, user.data);
  console.log(`Updated user ${user.id}`);
}, { parallel: false }); // Sequential to avoid DB overload

// Static - API endpoints
Promise.forEach(endpoints, url => fetch(url).callAttr('json'));

// File processing with rate limiting
logFiles.forEach(file => processLogFile(file), {delay: 100, timeout: 5000});
```

### `find(iterable, callback, options)`
**Options:** `{catchError = true, delay?, atLeast?, timeout?}`
Async version of Array.find - returns first truthy result.
```javascript
// Method (most common) - Find available server
Promise.resolve(serverUrls).find(async url => {
  return fetch(`${url}/health`).timeout(1000).callAttr('json');
}); // Returns first healthy server

// Static - Database search
Promise.find(userIds, async id => db.findUser(id));

// File search - First existing file
configPaths.find(path => fs.access(path), {timeout: 500});
```

### `some(iterable, callback, options)`
**Options:** `{catchError = true, delay?, atLeast?, timeout?}`
Async version of Array.some - returns boolean.
```javascript
// Method (most common) - Check if any API is responsive  
Promise.resolve(apiEndpoints).some(async endpoint => {
  return fetch(`${endpoint}/ping`).timeout(2000).callAttr('json');
}); // Returns true if any API responds

// Static - Database validation
Promise.some(records, async record => db.validate(record));

// File system check - Any file exists?
backupPaths.some(path => fs.access(path), {timeout: 1000});
```

### `reduce(iterable, callback, initialValue, options)`
**Options:** `{delay?, atLeast?, timeout?}`
Async reduce with timing control.
```javascript
// Method (most common) - Aggregate API responses
Promise.resolve(apiUrls).reduce(async (results, url) => {
  const data = await fetch(url).callAttr('json');
  return {...results, [url]: data};
}, {});

// Static - Database aggregation  
Promise.reduce(userIds, async (total, id) => {
  const user = await db.getUser(id);
  return total + user.score;
}, 0);

// File processing - Build combined result
logFiles.reduce(async (combined, file) => {
  const content = await fs.readFile(file);
  return combined + content;
}, '', {delay: 50});
```

</details>

<details>
<summary><strong>🔗 Sequencing</strong></summary>

### `sequence(iterable, options)`
**Options:** `{delay?, atLeast?, timeout?}`
Executes functions/promises sequentially, filtering out delays.
```javascript
// Method (most common)
Promise.resolve([
  () => fetch('/api1'),
  100,  // 100ms delay
  () => fetch('/api2')
]).sequence(); // Returns [api1Result, api2Result] - delays filtered

// Static
Promise.sequence([
  () => fetch('/api1'),
  100,
  () => fetch('/api2')
]);

// With timing control
tasks.sequence({timeout: 5000, delay: 50});
```

### `waterfall(iterable, initialValue, options)`
**Options:** `{delay?, atLeast?, timeout?}`
Passes result from one function to the next.
```javascript
// Method (most common)
Promise.resolve([
  data => processStep1(data),
  50,  // 50ms pause
  data => processStep2(data)
]).waterfall(initialData);

// Static
Promise.waterfall([
  data => processStep1(data),
  data => processStep2(data)
], initialData);

// With timing
steps.waterfall(input, {timeout: 10000});
```

### `sequenceAllSettled(iterable, options)`
**Options:** `{delay?, atLeast?, timeout?}`
Like sequence but returns `{status, value/reason}` objects.
```javascript
// Method (most common)
Promise.resolve([
  () => fetch('/api1'),
  () => fetch('/failing-api'),
  () => fetch('/api3')
]).sequenceAllSettled(); // Returns [{status: "fulfilled", value: ...}, {status: "rejected", reason: ...}]

// Static
Promise.sequenceAllSettled(tasks);

// With error handling
risky_tasks.sequenceAllSettled({timeout: 2000});
```

</details>

<details>
<summary><strong>🛠️ Utility Methods</strong></summary>

### `get(promise, key)`
Gets property from resolved object.
```javascript
// Method (most common)
fetch('/api').json().get('users'); // Gets users property

// Static
Promise.get(fetch('/api').json(), 'users');

// Chain access
response.get('data').get('items').get(0);
```

### `keys(promise)`
Gets object keys from resolved object.
```javascript
// Method (most common)
fetch('/api').json().keys(); // Returns Object.keys(result)

// Static
Promise.keys(fetch('/api').json());

// With processing
obj.keys().map(key => processKey(key));
```

### `exec(promise, ...args)`
Executes resolved function.
```javascript
// Method (most common) - Only Static available
Promise.resolve(() => "hello").exec(); // Not available as method

// Static
Promise.exec(Promise.resolve(() => "hello")); // Calls the function

// With arguments
Promise.exec(Promise.resolve((a, b) => a + b), 1, 2); // Returns 3
```

### `call(thisObj, ...args)` / `apply(thisObj, args)`
Executes resolved function with proper context.
```javascript
// Method only (most common)
Promise.resolve(obj.method).call(obj, arg1, arg2); // With context
Promise.resolve(func).apply(context, [arg1, arg2]); // Array args

// Not available as Static (conflicts with Function.prototype)

// Real world usage
Promise.resolve(user.getName).call(user);
```

### `callAttr(promise, attr, ...args)` / `applyAttr(promise, attr, args)`
Calls method on resolved object maintaining context.
```javascript
// Method (most common) - THE POWER COMBO!
fetch('/api').timeout(2000).callAttr('json'); // Perfect!
axios.get('/users').callAttr('data'); // Gets data property and calls it
fetch('/api').attachTimers({timeout: 1000}).callAttr('text');

// Static
Promise.callAttr(fetch('/api'), 'json');
Promise.applyAttr(userService.getUser(), 'format', ['short']);

// Real world magic
fetch('/upload').callAttr('blob').then(processBlob);
```

### `tap(resultCallback, errorCallback)`
Peek at values without affecting the chain.
```javascript
// Method only (most common) - DEBUGGING MASTER!
fetch('/api')
  .tap(response => console.log('Response:', response.status))
  .callAttr('json')
  .tap(data => console.log('Data:', data))
  .then(processData);

// Not available as Static

// Real debugging workflow
axios.get('/users').tap(console.log).get('data').tap(console.log);
```

### `waitForKey(object, key, options)` / `waitForResult(fn, options, args)`
**waitForKey Options:** `{ellapsed = 100, maxIterations = 20}`
**waitForResult Options:** `{ellapsed = 100, maxIterations = 20, retry = true, delay?, atLeast?, timeout?}`
Polls until condition is met.
```javascript
// Method (most common)
Promise.resolve(dynamicObj).waitForKey('result', {
  ellapsed: 100,      // Check every 100ms
  maxIterations: 50   // Max 5s total
});

// Static
Promise.waitForKey(dynamicObj, 'result');
Promise.waitForResult(fetchFunction, {retry: true, timeout: 1000}, [arg1]);

// Polling example
obj.waitForKey('status').then(status => console.log(status));
```

</details>

<details>
<summary><strong>⚙️ Extensibility</strong></summary>

### `wrapper(name, {Static, Method, depends})`
Create custom chainable methods.
```javascript
import { wrapper } from '@chumager/promise-helpers';

// Add .json() method to promises
wrapper("json", {
  Method() {
    return this.get("json").exec();
  }
})(Promise);

// Now use it
fetch("/api").json().then(console.log);
```

</details>

## Further Information

For more details and examples, visit the [GitHub Repository](https://github.com/chumager/promise-helpers).
