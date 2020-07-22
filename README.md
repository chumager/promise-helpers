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
require("@chumager/promise-helpers").default();
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
const {wrapper} = require("@chumager/promise-helpers");

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

For more info about this module please refer to [The Project GitHub Page](https://chumager.github.io/promise-helpers/)
