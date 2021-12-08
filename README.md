# Sahara

Sahara is an inversion of control container. It supports constructor,
property and method injection, parsing the method signature automatically
to determine dependencies.

[![NPM version](https://badge.fury.io/js/sahara.png)](http://badge.fury.io/js/sahara)

## Topics
* [Installation](#installation)
* [Usage](#usage)
	* [API Summary](#api)
	* Registration
		* [Registering an instance](#registering-an-instance)
		* [Registering a type](#registering-a-type)
			* [Named functions](#named-functions)
			* [Anonymous functions](#anonymous-functions)
		* [Deferred registration with factories](#registering-a-factory)
		* [Determining if something is registered](#determining-if-something-is-registered)
	* [Asynchronous resolution](#asynchronous-resolution)
	* [Handling cyclic dependencies](#cyclic-dependencies)
	* [Lifetime management](#lifetime-management)
	* [Injection](#injection)
		* [Property injection](#property-injection)
		* [Method injection](#method-injection)
		* [Manual injection](#manual-injection)
	* [Interception](#interception)
	* [Creating child containers](#creating-child-containers)
	* [Events](#events)
* [Development](#development)


## Installation
Install using NPM: `npm install sahara`

**As of v5.0.0, there is no support for Node < v8.0.0. Use v4.x for node v0.10-v7.
In addition, all asynchronous calls are Promise-based rather than callback-based.**

As of v4.0.0, [interception](#interception) as been moved out of the
default container. Use `require('sahara').interception.Container` to utilize
interception.

As of v3.0.0 there is support for ES6 features such as classes and fat-arrow functions.

## Usage
### API
All of these are explained in mind-numbing detail below. See also the 
[TypeScript declarations](./index.d.ts).

```javascript
class Container {
	registerType(ctor[, options]) {}
	registerType(ctor[, key, lifetime, injection, injection...]) {}
	registerTypeAndArgAlias(ctor, key, argAlias) {}

	registerInstance(instance[, options]) {}
	registerInstance(instance[, key, lifetime, injection, injection...]) {}
	registerInstanceAndArgAlias(instance, key, argAlias) {}

	registerFactory(factory[, options]) {}
	registerFactory(factory[, key, lifetime, injection, injection...]) {}
	registerFactoryAndArgAlias(instance, key, argAlias) {}

	isRegistered(key) {}

	resolve(key) {}
	resolveSync(key) {}
	tryResolveSync(key) {}

	inject(instance[, key]) {}
	injectSync(instance[, key]) {}

	createChildContainer() {}
}

sahara.inject = {
	property: (name, key) => {},
	propertyValue: (name, value) => {},
	method: (name, args) => {}
};

sahara.lifetime = {
	transient: () => {},
	memory: () => {}
};
```

Of note: there are two ways to register something in the container. You can
pass an `options` object, or you can specify everything explicitly in the
arguments. So these are equivalent:

```javascript
const options = {
	key: 'foo',
	lifetime: lifetime.memory(),
	injections: [ inject.property('foo', 'bar'), inject.method('doStuff', [ 'arg1', 'arg2' ]) ]
};

container.registerInstance({}, options);
container.registerInstance({}, options.key, options.lifetime, options.injections[0], options.injections[1]);
```

### Registering an instance
Sahara is simply a container for objects and object dependencies. In the simplest
case, you shove an object into it using `registerInstance()` and retrieve it
using `resolveSync()` (or, asynchronously using `Promise`s with `resolve()`):

```javascript
const Container = require('sahara').Container;
const container = new Container();

const myObject = { oh: 'hi mark' };
container.registerInstance(myObject, 'MyObject');
const instance = container.resolveSync('MyObject');
console.log(myObject === instance); //true, they are literally the same instance
```

But that's not abundantly interesting. The magic comes when you want to inject
your `myObject` instance somewhere else. Like into another object via a constructor
argument:

```javascript
function AnotherObject(/** MyObject */theObject) {
	this.obj = theObject;
}

container.registerType(AnotherObject);

const anotherObject = container.resolveSync(AnotherObject);
console.log(anotherObject.obj); // { oh: 'hai mark' }
```

This will dynamically create an instance of `AnotherObject`, using the
container to resolve its dependencies (in this case, it's dependency was
of type `MyObject`).

### Registering a type
You might have noticed there was a little bit of hand-waving going on up
above. When registering a type, Sahara will do some fancy regular expression
voodoo to ferret out the constructor signature, as well as the types of
the constructor arguments.

Since JavaScript isn't even close to a statically typed language, and doesn't
have a reflection API, we have to use doc comments to specify the types.
Specifically, they must be
[inline doc comments](https://code.google.com/p/jsdoc-toolkit/wiki/InlineDocs). 

```javascript
function Foo(message) { this.message = message; }
function Bar(/** Foo */foo) { this.foo = foo; }
function Baz(/** Bar */bar) { this.bar = bar; }

container
	.registerInstance(new Foo('oh hi mark'))
	.registerType(Bar)
	.registerType(Baz)
	.resolveSync(Baz)
	.bar.foo.message; //"oh hi mark"
```

**NOTE**: When using `registerType`, you *MUST* register a class or a function that
is a constructor.

#### Registering arguments
__As of v6.0.0__ you can use the `register*AndArgAlias()` methods to register a specific
_argument name_. This will eliminate the need for doc comments and play nice with bundlers
that remove comments. The one caveat is that these registrations apply to _all_ resolutions
where the argument name matches. So _any_ method with a parameter named `foo` will be
resolved by whatever you registered with `registerTypeAndArgAlias(Foo, 'foo')`.

Note that you __cannot use doc comments with register*AsArg() functions__. In other
words, your function signature must not have a doc comment for arguments that are 
registered via `register*AndArgAlias()`. Doc comments take precedence and will be used instead
of the named argument key.

For example:

```javascript
class Foo {
	constructor(arg1, arg2) {}
}

class Bar {}
class Baz {}

container
    .registerType(Foo)
    .registerTypeAndArgAlias(Bar, 'arg1')
    .registerInstanceAndArgAlias(new Baz(), 'myBarInstance', 'arg2')
    .resolveSync(Foo);
```

Internally this actually registers the `Bar` type with resolution key `$arg:arg1`. So you
can also do `container.resolve('$arg:arg1')`. This is an internal implementation detail and 
should not be relied upon (i.e. the `$arg:` prefix could change at any time).

#### Register aliases
__As of v6.0.0__ you can use `registerAlias()` to register an alias of a previously
registered type/instance/object.

```javascript
const instance = {};

container
    .registerInstance(instance, 'myInstance')
    .registerAlias('myInstance', 'somethingElse');

console.log(container.resolveSync('myInstance') === container.resolveSync('somethingElse')); // true
```

This is the same mechanism by which __arg aliases__ work as described above.

#### Named functions
By default, Sahara will use the name of the class or constructor as the resolution key.
As a means of convenience (as you can see by most of the examples on this page),
you can also pass the constructor to the `resolveSync()` function instead of
the resolution key.

If you pass a constructor to `resolveSync()`, it'll use `ctor.name` to deduce the
resolution key.

Otherwise, you need to pass in a `key` property in the `options` argument
to the `register*()` methods. Alternatively, as a means of convenience,
you can also just pass a straight-up string as the second argument in
lieu of the options object, and it will be used as the key.

```javascript
function Foo() {}

//the following registrations are equivalent
container.registerType(Foo);
container.registerType(Foo, { key: 'Foo' });
container.registerType(Foo, 'Foo');

//the following resolutions are equivalent
container.resolveSync(Foo); //uses Foo.name
container.resolveSync('Foo');
```

When registering instances, it'll try and use `instance.constructor.name` to
get the resolution key.

```javascript
function Foo() {}

const instance = new Foo();

//the following registrations are equivalent
container.registerInstance(instance)
container.registerInstance(instance, { key: 'Foo' });
container.registerInstance(instance, 'Foo');
```

#### Anonymous functions
If you don't have a named function, you can also register an anonymous
function, but you *must* provide a resolution key for it:

```javascript
const foo = function() {};
container.registerType(foo, 'MySpecialName');
const fooInstance = container.resolveSync('MySpecialName');

//with an instance
container.registerInstance(fooInstance, 'AnotherSpecialName');
const sameInstance = container.resolveSync('AnotherSpecialName');
```

#### Classes
As of v2.0.0, sahara supports classes with or without a `constructor` method.

```javascript
class Foo {
  constructor() {}
}
class Bar {}

container
  .registerType(Foo)
  .registerType(Bar);
```

### Registering a factory
In some cases you'll want to defer the creation of an object until
it's absolutely needed. You can do this by using `container.registerFactory()`.
Your factory function should take in one argument, the container.

This is mostly used as a replacement for `registerInstance()`, but for
the times when you don't want to create the instance immediately.

Note that the `key` option is **required** when using `registerFactory()`.

```javascript
function Foo() {}

container.registerFactory(container => new Foo(), 'MyKey');

container.resolveSync('MyKey');
```

### Determining if something is registered
Use the `container.isRegistered()` function.

```javascript
function foo() {}

container.registerType(foo);

console.log(container.isRegistered(foo));   //true
console.log(container.isRegistered('foo')); //true
console.log(container.isRegistered('bar')); //false
```

### Asynchronous resolution
**Note: as of v5.0.0 sahara now uses `Promise`s instead of callbacks**

All examples given are synchronous. However, if you need to resolve something
asynchronously, you can use the `resolve(key)` function. Note that
*everything* (from resolution, to injection, to object building) will be
asynchronous, so bear that in mind.

This is most relevant for `registerFactory()`, because you either have to be
very careful, or make sure your factory function can handle both async
and synchronous code paths.

Here is an asynchronous example:
```javascript
function createThingAsync(container) {
	return new Promise(resolve => setTimeout(() => resolve({}), 1000));
}

const container = new Container()
	.registerFactory(createThingAsync, 'Thing');

container.resolve('Thing')
	.then((thing) => { /* ... */ })
	.catch((err) => console.error(err));
```

Note that if you try to resolve `Thing` synchronously, a promise is still returned.
This behavior was changed in v5.0.0; previously it would return `undefined` unless
explicitly handled.

### Cyclic dependencies
...are bad.

```javascript
function Foo(/** Bar */bar) {}
function Bar(/** Foo */foo) {}

new Container().registerType(Foo); //throws "Cyclic dependency from Foo to Bar"
```

### Lifetime management
But wait, there's more configuration! To give you more fine-grained control
over the objects that Sahara creates, you can specify a **Lifetime**. This
basically tells Sahara how to store the object, in effect governing the
lifetime of the object.

The default lifetime is the `TransientLifetime`, which means that every time
you call `resolve()` Sahara will pretend like it's never seen this type
before and run the object building sequence each time.

The `MemoryLifetime` will store the
object instance in memory, and reuse that instance every time the container
attempts to resolve that type. This is useful when you have an object
with an expensive construction time (e.g. a database connection) that
you would want to reuse for the duration of your script.

```javascript
const lifetime = require('sahara').lifetime;

function DbConnection() {
	this.client = db.connect({...});
}

container.registerType(DbConnection, { lifetime: lifetime.memory() });
```

### Injection
By default, Sahara performs *constructor injection*. That is, it resolves
dependencies that are specified in the constructor. What if you have
dependencies that are not in the constructor? Well, there are a few ways
to alleviate that problem as well.

**NOTE:** cyclic dependencies are not detected when performing property
and method injection, because I haven't figured out a clever way of
doing it yet. So if you see a "maximum stack size exceeded" error,
you probably created a cyclic dependency.

#### Property injection
Property injection simply sets the value of a property on an object
when it is `resolve()`'d.

There are two ways to do it. You can simply give the value of the
property:

```javascript
const inject = sahara.inject;

function Foo() {
	this.value = 'foo';
}

container.registerType(Foo, { injections: [ inject.propertyValue('value', 'bar') ] });
console.log(container.resolveSync(Foo).value); //"bar"
```

Or you can have the container resolve the type. In this case, you
must specify the property's type:

```javascript
function Foo() {
	this.value = 'foo';
}
function Bar() {
	this.toString = function() { return 'I am Bar'; };
}

container
	.registerType(Foo, { injections: [ inject.property('value', 'Bar') ] })
	.registerType(Bar);
console.log(container.resolveSync(Foo).value); //"I am Bar"
```

#### Method injection
Method injection invokes the specified method with optional arguments
during resolution. Again, you can specify the arguments explicitly:

```javascript
function Foo() {
	this.value = 'foo';
	this.setValue = function(newValue) {
		this.value = newValue;
	};
}

container.registerType(Foo, { injections: [ inject.method('setValue', [ 'bar' ]) ] });
console.log(container.resolveSync(Foo).value); //"bar"
```

Or you can let the container resolve the method's arguments.  To
accomplish this, simply omit the optional array of arguments to 
`inject.method()`. Note that this uses the same procedure as
`container.registerType()`, so you'll need to specify the
types of each parameter with a comment.

```javascript
class Foo {
	constructor() {
		this.value = 'foo';
		this.setValue = (/** TheNewValue */newValue) => {
			this.value = newValue;
		};
	}
}
container
	.registerType(Foo, { injections: [ inject.method('setValue') ] })
	.registerInstance('This is the new value', 'TheNewValue');
console.log(container.resolveSync(Foo).value); //"This is the new value"
```

#### Manual injection
The container also provides a method for performing injection on an
already existing object. This can be useful if an object was created
without using the container.

```javascript
class Foo {
	constructor() {
		this.value = 'foo';
	}
}

container.registerType(Foo, { injections: [ inject.propertyValue('value', 'bar') ] });

const instance = new Foo();
console.log(instance.value); //"foo"
container.injectSync(instance);
console.log(instance.value); //"bar"

//specify the key explicitly
container.injectSync(instance, 'Foo');
```

The async way:
```javascript
container.inject(instance, 'Foo')
	.then(() => {
		//injection completed successfully
	})
	.catch((err) => {
		console.error(err);
	});
```

### Interception
Interception was removed as of v5.0.0. View one of the older releases' README
for documentation.

### Creating child containers
Occasionally the need arises to create a new container that inherits all of the
configurations from another container. This can be accomplished with the
`createChildContainer()` function.

```javascript
class Foo {}

const parent = new Container().registerType(Foo);
const child = parent.createChildContainer();
const fooInstance = child.resolveSync(Foo); // instance of Foo
```

Anything you do on the parent container will **not** affect the state of the
child container, and vice versa. They are completely independent.

If you want the child container to inherit the events as well, pass `true`
to `createChildContainer()`.

```javascript
child = parent.createChildContainer(true);
```

### Events
Events emitted by a `Container` instance:

- `registering` - when a type/instance/factory is being registered
  1. `arguments[0]`: the registration key
  1. `arguments[1]`: the registration type (`type`, `instance` or `factory`)
- `resolving` - when an object is being resolved
  1. `arguments[0]`: the registration key
- `resolved` - when an object has been resolved
  1. `arguments[0]`: the registration key
  2. `arguments[1]`: the resolved object

Events emitted by an `ObjectBuilder` instance:

- `building` - when an object is being built
  1. `arguments[0]`: metadata for the type: `{ args: [], ctor: Function, name: 'name' }`
- `built` - when an object has been built
  1. `arguments[0]`: metadata for the type (see above)
  2. `arguments[1]`: the object instance

**Example**:

```javascript
const container = new Container();

container
	.on('registering', key => console.log(key + ' is being registered'))
	.on('resolving', key => console.log(key + ' is being resolved'))
	.on('resolved', key => console.log(key + ' has been resolved'));

container.builder
	.on('building', info => console.log('building ' + info.name))
	.on('built', info => console.log('built ' + info.name));
```

## Development
```bash
git clone git@github.com:tmont/sahara.git
cd sahara
npm install
npm test
```
