# Promise Helpers
## Motivation
Sometimes I've been stuck operating with external services who are slow, unresponsive or with restrictions.
In the front end world, you should operate in some intervals or just wait until some reactive object has a value.
Maybe your process consumes too much resources and don't want to abuse.

This is somehow anti pattern, a developer usually wants to return as fast as possible, but in some case you need a slow, ordered, less resource consume or more controlled approach.

When you develop against somethings not yours you have to adapt to the external service and this will help on that.

When you need to slow down your code or do it sequentially.

When you need to develop with HOF or with high abstraction level.

That's why I create this module.

## If you hate modify primitives.
For some the primitives are untouchable... I'm not agree with that but I understood. So before you discard this module you can use an extended promise class to avoid it.
```js
global.localPromise = class extends Promise {};
```
And then apply the module to your new Promise object.
## Install.
```sh
yarn add @chumager/promise-helpers
```
In your code:
```js
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
```js
Promise.delay(time[, value]);
//or
somePromise.delay(time);
```
#### Examples.
```js
Promise.delay(1000, "Hello World").then(console.log);
```
will print _Hello World_ after 1000ms.

As method it helps to delay a promise to the next chain fulfilled.
```js
somePromise.delay(1000).then(console.log);
```
will print the result of somePromise.
In case of a rejected promise it'll not delay the rejection.
```js
Promise.reject("ERROR").delay(1000).catch(console.log);
```
Should return in the end of current loop.
### atLeast.
Like delay but it waits at least, useful if you want to set some order in the delivery or need to deliver in some time.
Signature:
```js
Promise.atLeast(somePromise, time);
//or
somePromise.atLeast(time);
```
example: 
```js
Promise.resolve("Hello World").atLeast(1000).then(console.log);
```
Will print _Hello World_ in around 1000 ms.

```js
Promise.delay(1000, "Hello World").atLeast(500).then(console.log);
```
Will print _Hello World_ in around 1000 ms.
### timeout.
Waits until the timeout to rejects, if the promise is resolved before then it chains the result.

Signature:
```js
Promise.timeout(somePromise, time=100[,error]);
somePromise.timeout(time[, error]);
```
error is the value for the rejection, if not set then a instance of **PromiseTimeoutError** with the message **Promise timeout in ${time}ms** will be the rejected value.

Examples:
```js
Promise.delay(1000, "nothing").timeout(500).catch(console.error);
```
Will reject the promise because it took more than 500ms in resolve.
```js
Promise.delay(500, "Hello World").timeout(1000, "ERROR").then(console.log);
```
will print _Hello World_ because it resolves in 500ms and the timeout was 1000ms.
### timeoutDefault.
Like **timeout** but supports a "default" value, so un case of timeout you can avoid the rejection and replace it with a default value.

Signature:
```js
Promise.timeoutDefault(something, time=100, default, force=false);
//or
somePromise.timeoutDefault(time=100, default, force=false);
```
the "force" argument, defines if you want a default even on rejection,

Examples:
```js
const response = await axios("someSlowUrl").then(({body})=>body).timeoutDefault(1000, "Nothing for now");
const badResponse = await axios("some500Url").then(({body})=>body).timeoutDefault(1000, "Default response", true);
```

##Wrapper...
All the helpers definition comes from a wrapper function.
The signature is
```js
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
```
Static(prom: Promise, ...args: Any).
```
With this signature you get automagically Method.
```
Method(...args: Any)
```
For consistency with the class the ```Method``` function assumes ```this``` is the promise. 
So if no Method function is given then Static is used like:
```js
promise.prototype[name] = function(...args){
  return this.constructor[name](this, ...args);
}
```
