# Promise Helpers
## Why?
Sometimes I've been stuck operating with external services who are slow, unresponsive or with restrictions.
In the front end world, you should operate in some intervals or just wait until some reactive object has a value.
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
## Notes.
Several functions only works as prototype, so if you're going to use a only function promise be aware it may not work.

