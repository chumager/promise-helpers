# Promise Helpers
## Motivation
Sometimes I've been stuck operating with external services who are slow, unresponsive or with restrictions.
In the front end world, you should operate in some intervals or just wait until some reactive object has a value.
Maybe your process consumes too much resources and don't want to abuse.

This is somehow anti pattern, a developer usually wants to return as fast as possible, but in some case you need a slow, ordered, less resource consume or more controlled approach.

When you develop against somethings not yours you have to adapt to the external service and this will help on that.

When you need to slow down your code or do it sequentially.

When you need to develop with HOF or with high abstraction level.

I love chaining, as almost all methods and statics returns promises (besides forEach) you can always chain.

Imagine a fetch who returns an array of url you must request but one by one, with some time restriction and at least some execution time

```javascript
fetch("someURL")
  .timeout(1000, "first request took too long")
  .get("json")
  .exec()
  .map(url=>
    fetch(url)
      .get(json)
      .exec()
      .timeout(2000, `URL: ${url} took more than 2000ms`),
    {
      atLeast: 1000, 
      parallel: false
    }
  )
```
The .get("json").exec() repeats? No problemo amigo... Lets wrap a new method
```javascript
wrapper("json", {
  Method(){
    return this.get("json").exec();
  }
})(Promise);
```
resulting:
```javascript
fetch("someURL")
  .timeout(1000, "first request took too long")
  .json()
  .map(url=>
    fetch(url)
      .json()
      .timeout(2000, `URL: ${url} took more than 2000ms`),
    {
      atLeast: 1000, 
      parallel: false
    }
  )
```
all your fetch has timeout?
```javascript
wrapper("jsonT", {
  Method(timeout, msg = "fetch took too long"){
    return this.json().timeout(timeout, msg);
  }
})(Promise);
```
resulting:
```javascript
fetch("someURL")
  .jsonT(1000, "first request took too long")
  .map(url=>
    fetch(url)
      .jsonT(2000, `URL: ${url} took more than 2000ms`),
    {
      atLeast: 1000, 
      parallel: false
    }
  )
```

That's why I create this module and obviously I use it in all my develops.
### Notes.
Every helper should be able to process sync/async/function values, sync/async parameters/callbacks and always return a promise object instance of the promise you use to attach the helpers, so in case you find some problem chaining or resolving, please add an issue to the repository. 
## If you hate modify primitives.
For some the primitives are untouchable... I'm not agree with that but I understood. So before you discard this module you can use an extended promise class to avoid it.
```javascript
global.localPromise = class extends Promise {};
```
And then apply the module to your new Promise object.
## Install.
```sh
yarn add @chumager/promise-helpers
```
In your code:
```javascript
const {default: PromiseHelpers} = require("@chumager/promise-helpers");
//with global Promise.
PromiseHelpers();
//or with other promise.
const localPromise = class extends Promise {};
PromiseHelpers(localPromise);
```
### Notes.
Several functions only works as prototype, so if you're going to use a only function promise be aware it may not work.
## Helpers.
### delay.
As static this helper return a promise delayed by time ms and with a optional value.
The signature is:
```javascript
Promise.delay(time[, value]);
//or
somePromise.delay(time);
```
#### Examples.
```javascript
Promise.delay(1000, "Hello World").then(console.log);
```
will print _Hello World_ after 1000ms.

As method it helps to delay a promise to the next chain fulfilled.
```javascript
somePromise.delay(1000).then(console.log);
```
will print the result of somePromise.
In case of a rejected promise it'll not delay the rejection.
```javascript
Promise.reject("ERROR").delay(1000).catch(console.log);
```
Should return in the end of current loop.
### atLeast.
Like delay but it waits at least, useful if you want to set some order in the delivery or need to deliver in some time.
Signature:
```javascript
Promise.atLeast(somePromise, time);
//or
somePromise.atLeast(time);
```
example: 
```javascript
Promise.resolve("Hello World").atLeast(1000).then(console.log);
```
Will print _Hello World_ in around 1000 ms.

```javascript
Promise.delay(1000, "Hello World").atLeast(500).then(console.log);
```
Will print _Hello World_ in around 1000 ms.
### timeout.
Waits until the timeout to rejects, if the promise is resolved before then it chains the result.

Signature:
```javascript
Promise.timeout(somePromise, time=100[,error]);
somePromise.timeout(time[, error]);
```
error is the value for the rejection, if not set then a instance of **PromiseTimeoutError** with the message **Promise timeout in ${time}ms** will be the rejected value.

Examples:
```javascript
Promise.delay(1000, "nothing").timeout(500).catch(console.error);
```
Will reject the promise because it took more than 500ms in resolve.
```javascript
Promise.delay(500, "Hello World").timeout(1000, "ERROR").then(console.log);
```
will print _Hello World_ because it resolves in 500ms and the timeout was 1000ms.
### timeoutDefault.
Like **timeout** but supports a "default" value, so in case of timeout you can avoid the rejection and replace it with a default value.

Signature:
```javascript
Promise.timeoutDefault(something, time=100, default, force=false);
//or
somePromise.timeoutDefault(time=100, default, force=false);
```
the "force" argument, defines if you want a default even on rejection,

Examples:
```javascript
const response = await axios("someSlowUrl")
  .then(({data})=>data)
  .timeoutDefault(1000, "Nothing for now");
//will print "Nothing for now".
const badResponse = await axios("some500Url")
  .then(({data})=>data)
  .timeoutDefault(1000, "Default response", true);
//will print "Default response" because the default is forced
//using get
const response = await axios("someURL")
  .get("data")
  .timeoutDefault(1000, "no response");
//will print the data if it's fast enough or "no response" if it's slow
```
### map.
Made to simplify the Promise.all/map process. 

Normal pattern for array
```javascript
const result = await Promise.all(array.map(someFunctionReturningPromises));
```
For a promise that returns an array.
```javascript
const result = await array.then(array=>array.map(someFunctionReturningPromises));
```
Signature:
```javascript
//Static
Promise.map(iterable, cb, {catchError: true, parallel: true});
//method.
somePromiseIterable.map(cb, {catchError: true, parallel: true});
```
If **catchError** is false then will fulfilled with the fulfilled cb and errors, it only works well with parallel false, otherwise the error is rejected in Promise.all.. 
If true (the default) then it will throw an instance of **PromiseMapError** with an arg object containing {iterable, id, result, err}.

If **parallel** is false the iteration will wait until cb resolves and then will be pushed to the array. When true (default) the error could not be catch in the iteration so it will be catch in the Promise.all return so you can only get the first error.

Being:
* iterable, the result of the iterable after resolving.
* id, the id of the iteration who rejects.
* result, the result at that time including the error.
* err, the error returned by the callback

Examples:
```javascript
//a cb that works with no async values
const cb = v=>v+1;
//a promise that returns an array or promises.
const array = Promise.resolve([...Array(5).keys()]).map(v=>Promise.resolve(v));
const result = await array.map(cb);//[1,2,3,4,5];
```
It helps to work with a promise returning an array of promises and "synchronous/asynchronous callback"

The same example but with vanilla js.

```javascript
//a cb that works with async values
const cb = async v=>{
  let result = await v;
  return result + 1;
};
//a promise that returns an array or promises.
const array = Promise.result([...Array(5).keys()]).map(v=>Promise.resolve(v));
let result = await array;
result = await Promise.all(result.map(cb));//[1,2,3,4,5];
```
#### Notes.
* You can use sync functions to process the async data, and it will always returns a promise of an array with inner items already resolved no matter the cb returns a promise. 
### forEach.
Like map and behaves just like **Array.prototype.forEach** but for iterables not just arrays.

The main difference is it behaves well with async cb, so it will wait until finishes to resolve, Array.prototype.forEach doesn't

The problem...
```javascript
async function main() {
  console.log("start");
  const arr = [1, 2, 3, 4, 5];
  await arr.forEach(async v => {
    const res = await new Promise(res => setTimeout(res, 100, v));
    console.log(res);
  });
  console.log("end");
}
main();
```

Doesn't work as expected, because the loop in forEach doesn't care about async operations...

The fix...
```javascript
async function main() {
  console.log("start");
  const arr = Promise.resolve([1, 2, 3, 4, 5]);
  await arr.forEach(async v => {
    const res = await Promise.delay(500, v);
    console.log(res);
  });
  console.log("end");
}
main();
//or...
async function main() {
  console.log("start");
  const arr = [1, 2, 3, 4, 5];
  await Promise.forEach(arr, async v => {
    const res = await Promise.delay(500, v);
    console.log(res);
  });
  console.log("end");
}
main();
```
### sequence.
This is designed for High Abstraction Level, when you don't know what's coming, so you send your slaves to work...
In simple terms it's like a map with a callback who executes the iterator, as it's name, in sequence... But it also accepts numbers to make a delay in between.

Signature:
```javascript
//Static
Promise.sequence(IteratorOfFunctions, {catchError: true, delay: null, atLeast: null})
//Method.
somePromiseOfFunctionIterator.sequence({catchError: true, delay: null, atLeast: null});
```
delay and atLeast are applied on every function resolution.
Like map, catchError has the same behavior.

### sequenceAllSettled
Like sequence but when you want yo know the status of the promise and the value o reject reason, just like Promise.allSettled, obviously it has no catchError.

### reduce.
Just like **Array.prototype.reduce*** but supports sync cb with resolved result and iterator. It behaves like map supporting delay, atLeast and timeout, obviously without parallel, because it works in sequence.

### waterfall.
When you have a sequence of functions that have to chain the result. It's meant to High Abstraction Leven when you don't know what's coming or just want to keep your code in order.

When you know, the pattern is:
```javascript
Promise.resolve(initVal)
  .then(func1)
  .then(func2)
  .then(func3)
  .then(func4)
  .then(func5)
```

If you don't know.
```javascript
//some HOF returns a promise with an array of functions.
someFunc().waterfall(initVal)
```
### get.
Gets the value from a key of a promise returning an object.

Normal pattern.
```javascript
const {data} = await axios(someURL);
```
Anti pattern
```javascript
const data = await axios(someURL).get("data");
```
The main difference is with the normal pattern if **data** doesn't exist you get undefined. With "get" you get an PromiseKeyNotFound error, and usually happens you misspell the keys names, and sometimes it takes forever to detect it. 

### keys.
Like **Object.keys** but for Promises... 

Normal pattern:
```javascript
const obj = await somePromise;
Object.keys(obj).someArrayFunction...
```

Anti pattern:
```javascript
await somePromise.keys().somePromiseFunction...
```
### call, apply and exec.
Call and apply works just like the **Function.prototype** equals, exec works like **function(...args)**

For example:

Sometimes class functions depends on **this**, normal call won't work.
```javascript
class someClass {
  constructor(v){
    this.test = v;
  }
  myTest(){
    console.log(this.test);
  }
}
const myClass = new someClass("hello world");
const {myTest} = myClass;
myTest();//won't work becaus "this" doesn't exists"
//this will do
myTest.call(myClass);
```
so in case you depends on this, you could use call or apply in other cases can use exec.

Example of exec.
```javascript
fetch(someUrl).get("json").exec();
```
### waitForKey
Useful for non reactive objects, when other section of your code changes it and want to wait until the key appears.

Signature:
```javascript
//Static
Promise.waitForKey(obj, key, {ellapsed: 100, maxIterations: 1e4});
//Method.
somePromise(key, {ellapsed: 100, maxIterations: 1e4});
```
* ellapsed: the time to wait in each loop.
* maxIterations: how many iterations until throws error if key hasn't appear in the object.

Example:
```javascript
//in some place of your code.
const obj = {};

//creation key emulation.
setTimeout(() => (obj.test = true), 400);

//in some other place...
const value = await Promise.waitForKey(obj, "test");
```
### waitForResult
Imagine a super unstable service and need to get info from an endpoint, this is for you...

Signature:
```javascript
//Static
Promise.waitForResult(fn, {ellapsed = 100, delay, atLeast, maxIterations = 10000, retry = true, timeout} = {}, args = []) 
//Method
somePromiseFunction.waitForResult({ellapsed = 100, delay, atLeast, maxIterations = 10000, retry = true, timeout} = {}, args = []) 
```
Where:
* ellapsed: the time in between execution.
* delay, atLeast and timeout: normal behavior.
* maxIterations: how many iterations before throws error.
* retry: Boolean, default true, in case you want to keep executing even if the function throws error
* args: an array of arguments to use with the function. This is to apply Promise.all to the argument.
#### Note:
it'll retry while the result is **undefined** otherwise it will return, so if you need to expect for other result you must implement it in your function.

Example:
```javascript
//fetching data
const result = await Promise.resolve(fetch, undefined, someURL).get("json").exec();

//searching in the DOM.
const search = id => {
  let res = document.getElementById(id);
  return res === null ? undefined : res;
}
Promise.waitForResult(search, undefined, ["myID"]).get("click").exec();
//no await to avoid blocking next code.
```
#### Can I stop this?
As the wrapper returns the resulting value I can't return a cancel function. Suggestions are welcome...

## Wrapper...
All the helpers definition comes from a wrapper function.
The signature is
```javascript
wrapper(name: String, {Static: Function, Method: Function, depends: Array}).
```
Argument|Type|Default|Definition|
---|---|---|---
name|String|none|The name of the Static or Method to add to the promises.
Static|Function|none|The Static function to add, if there is no Method function it'll be created based on Static assuming the first argument is a promise.
Method|Function|Static|The Method to add, it is chained in the promise object.
depends|Array|none|the other wrappers it depends on, for example you can create 3 wrappers and the 3rd depends on the other 2.
### Standard Signatures for Static and Method.
appart of delay, almost all functions has this signature:
```javascript
Static(prom: Promise, ...args: Any).
```
With this signature you get automagically Method.
```javascript
Method(...args: Any)
```
For consistency with the class, the **Method** function assumes **this** as the promise. 
So if no Method function is given then Static is used like:
```javascript
promise.prototype[name] = function(...args){
  return this.constructor[name](this, ...args);
}
```
### Real examples.
Remember wrapper is HOF and need a promise object to be attached.

Suppose you have an express.js service with mongoose and several endpoints answer with res.JSON, but the operation could fail and need to respond well.
```javascript
wrapper("send", {
  Static(prom, res){
    prom.then(res.JSON, err=>{
      res.status(500).JSON({status: "error", message: err.message || err});
    });
  }
})(Promise);
//remember if there is no Method then Static is translated into Method.
//now you can
app.get("/API/Users",(req, res) => {
    db.model("User").find(req.query).exec().send(res);
});
```
The **exec** is assuming it's a Mongoose module.

Now you have to inject some locals to your resulting documents in a query, you can do it with:
```javascript
wrapper("setLocals", {
  async Static(prom, locals){
    const res = await prom;
    if(Array.isArray(res)){
      res.forEach(doc=>doc.$locals = {...doc.$locals, ...locals});
    } else {
      res.$locals = {...res.$locals, ...locals};
    }
    return res;
  }
})(Promise);
//latter
app.get("/API/TrxByDate", (req, res)=>{
  db.model("Trx").find({status: "Finished"})
    .exec()
    .setLocals({date: req.query.date})
    .send(res);
});
```
So if you have some virtuals that depends on date locals, you will deliver the documents with the new virtual data.

Finally, you have to process a query and make some changes in your documents, but when you have an error you don't know in which document, happens

```javascript
db.model("Project")
  .find(someQuery)
  .populate("investments")
  .exec()
  .get("investments")
  .map(someProcessingFunction)
  .catch(err=>{
    //here err.args will have the id before throws, the result before throws and the err (error thrown from the operation).
  });
```
## Final Notes.
This is not **magic**, the way the interpreter works is with one thread and non blocking I/O, so don't expect to work delay, atLeast or timeout with a synchronous function, AFAIK the only way to convert sync to async is with working threads. The same will happens if your async function uses sync methods with high CPU processing.
