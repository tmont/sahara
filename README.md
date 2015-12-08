# Sahara
[![Build Status](https://travis-ci.org/tmont/sahara.png)](https://travis-ci.org/tmont/sahara)
[![NPM version](https://badge.fury.io/js/sahara.png)](http://badge.fury.io/js/sahara)

Sahara is an inversion of control container. It supports constructor,
property and method injection, parsing the method signature automatically
to determine dependencies. It also supports interception for function
calls.

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
Install using [NPM](https://github.com/isaacs/npm): `npm install sahara`

You will need to run node with the `--harmony` flag enabled.

**NOTE**: sahara uses several ES6 features, most notably the 
[spread operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator)
to dynamically construct [classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes).
This means sahara >=2.0.0 requires node v4 and up. If this is unacceptable, you 
should install `sahara@1.3.0`.

## Usage
### API
All of these are explained in mind-numbing detail below.

```javascript
sahara.Container = function() {};
Container.prototype = {
	registerType: function(ctor[, options]) {},
	registerType: function(ctor[, key, lifetime, injection, injection...]) {},

	registerInstance: function(instance[, options]) {},
	registerInstance: function(instance[, key, lifetime, injection, injection...]) {},

	registerFactory: (factory[, options]) {},
	registerFactory: (factory[, key, lifetime, injection, injection...]) {},

	isRegistered: function(key) {},

	resolve: function(key, callback) {}
	resolveSync: function(key) {},
	tryResolveSync: function(key) {},

	inject: function(instance, key, callback) {}
	injectSync: function(instance[, key]) {},

	intercept: function(matcher, callHandler[, callHandler...]) {},

	createChildContainer: function() {}
};

sahara.inject = {
	property: function(name, key) {},
	propertyValue: function(name, value) {},
	method: function(name, args) {}
};

sahara.lifetime = {
	transient: function() {},
	memory: function() {},
	external: function(manager) {}
};
```

Of note: there are two ways to register something in the container. You can
pass an `options` object, or you can specify everything explicitly in the
arguments. So these are equivalent:

```javascript
var options = {
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
using `resolveSync()` (or, asynchronously, `resolve()`):

```javascript
var Container = require('sahara').Container,
	container = new Container();

var myObject = { oh: 'hi mark' };
container.registerInstance(myObject, 'MyObject');
var instance = container.resolveSync('MyObject');
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

var anotherObject = container.resolveSync(AnotherObject);
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

**NOTE**: When using `registerType`, you *MUST* register a function that
is a constructor.

#### Named functions
By default, Sahara will use the name of the constructor as the resolution key.
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

var instance = new Foo();

//the following registrations are equivalent
container.registerInstance(instance)
container.registerInstance(instance, { key: 'Foo' });
container.registerInstance(instance, 'Foo');
```

#### Anonymous functions
If you don't have a named function, you can also register an anonymous
function, but you *must* provide a resolution key for it:

```javascript
var foo = function() {};
container.registerType(foo, 'MySpecialName');
var fooInstance = container.resolveSync('MySpecialName');

//with an instance
container.registerInstance(fooInstance, 'AnotherSpecialName');
var sameInstance = container.resolveSync('AnotherSpecialName');
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

container.registerFactory(function(container) {
	return new Foo();
}, 'MyKey');

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
All examples given are synchronous. However, if you need to resolve something
asynchronously, you can use the `resolve(key, callback)` function. Note that
*everything* (from resolution, to injection, to object building) will be
asynchronous, so bear that in mind.

This is most relevant for `registerFactory()`, because you either have to be
very careful, or make sure your factory function can handle both async
and synchronous code paths.

Here is an asynchronous example:
```javascript
function createThingAsync(container, callback) {
	setTimeout(function() {
		callback(null, {});
	}, 1000);
}

new Container()
	.registerFactory(createThingAsync, 'Thing')
	.resolve('Thing', function(err, thing) {
		if (err) {
			console.error(err);
			return;
		}

		//do something with thing
	});
```

But if you try to resolve `Thing` synchronously, nothing will be returned.
If you need that flexibility, you'll have to account for both cases in
your factory function:

```javascript
function createThingMaybeAsync(container, callback) {
	var theThing = { oh: 'hi mark' };
	if (callback) {
		//asynchronous code path
		callback(null, theThing);
		return;
	}

	//synchronous code path
	return theThing;
}
```

It's best to not mix the idioms, though, since some things just can't be
done synchronously.

### Cyclic dependencies
...are bad.

```javascript
function Foo(/** Bar */bar) {}
function Bar(/** Foo */foo) {}

container.registerType(Foo); //throws "Cyclic dependency from Foo to Bar"
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
var lifetime = require('sahara').lifetime;

function DbConnection() {
	this.client = mysql.connect({...});
}

container.registerType(DbConnection, { lifetime: lifetime.memory() });
```

The `ExternallyManagedLifetime` puts the onus of object management on the
client (i.e. you). This is useful for managing something that should exist
temporarily.

```javascript
var manager = new sahara.ObjectManager(),
	container = new sahara.Container();

container.registerInstance({ foo: 'bar' }, 'Foo', sahara.lifetime.external(manager));
container.registerInstance({ foo: 'baz' }, 'Bar', sahara.lifetime.external(manager));
```

You can also provide a collection to the `ObjectManager`, and all of the managed instances
will be stored in that object.

```javascript
var items = {
		foo: 'bar';
	},
	manager = new sahara.ObjectManager(items);

container.registerInstance('hello world', 'Foo', sahara.lifetime.external(manager));

var instance = container.resolveSync('Foo');
console.log(items);
/*
{ foo: 'bar',
  '95ae7c41-b413-48a9-9712-5d1756d6cf92': 'hello world' }
*/
```

To purge the `ObjectManager`'s stored values, call `purge()`:

```javascript
manager.purge();
```

The `ObjectManager` is an `EventEmitter` and emits `add` when a new object is
added, and `purge` when the manager is purged.

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
var inject = sahara.inject;

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
function Foo() {
	this.value = 'foo';
	this.setValue = function(/** TheNewValue */newValue) {
		this.value = newValue;
	};
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
function Foo() {
	this.value = 'foo';
}

container.registerType(Foo, { injections: [ inject.propertyValue('value', 'bar') ] });

var instance = new Foo();
console.log(instance.value); //"foo"
container.injectSync(instance);
console.log(instance.value); //"bar"

//specify the key explicitly
container.injectSync(instance, 'Foo');
```

The async way:
```javascript
container.inject(instance, 'Foo', function(err) {
	if (err) {
		console.error(err);
	}

	//injection completed successfully
});
```

### Interception
Interception is a means of intercepting a function call and doing something
before or after. For example, you could modify the return value, nullify
an error, perform extra logging, etc.

### Limitations
Interception in JavaScript is accomplished by defining a non-writable property
that wraps a function call. So, if your method is
[not configurable](https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor#Description)
then it will *not* be intercepted.

Note that currently only [types](#registering-a-type) can be intercepted. This
may be expanded to other registrations in the future.

### Usage
There are three components to configuring registration:

1. Define a matcher predicate, which will determine when a function
   call should be intercepted
1. Define a call handler, which will be executed when the function
   is called
1. Call `container.intercept()`
	* `container.intercept().sync()` for synchronous interception
	* `container.intercept().async()` for asynchronous interception

**NOTE**: interception is configured internally during object construction,
which occurs when you call `resolve()` or `resolveSync()`. So make sure
interception has been configured *prior* to resolving the type.

You should also make use of the [memory lifetime](#lifetime-management) where
appropriate, as determining when a function should be intercepted can add a bit
of time to the creation of the object. If the memory lifetime is used, that
performance hit will only occur once.

#### Matchers
The matcher predicate is a function that takes in two arguments:

1. `instance` - the object instance
1. `methodName` - the name of the method that is being invoked

If the matcher returns `true`, then the method will be intercepted.

```javascript
//intercept every possible function
function always() {
	return true;
}

//only intercept the validate() method
function onlyValidate(instance, methodName) {
	return methodName === 'validate';
}

//only intercept validate() on the UserRepository
function conditionalValidate(instance, methodName) {
	return instance instanceof UserRepository && methodName === 'validate';
}
```

#### Call handlers
The call handler is invoked when the intercepted function is called.
It is a function that takes two arguments:

1. `context` - An object representing the current state of the invocation
	* `context.instance` - the object instance
	* `context.methodName` - the name of the method being invoked
	* `context.arguments` - an array of arguments passed to the method
	* `context.error` - the error that was raised during invocation
	* `context.returnValue` - the value to be returned by the method
1. `next` - Invoke the next handler in the chain

You **MUST** call `next()` *once and only once* somewhere in your call handler,
to make sure the handler chain completes. If you have multiple call handlers
defined, it will invoke the next one. Otherwise, it will invoke the original
method. However, if `context.error` is set, then the original method will *not*
be invoked.

```javascript
//log the signature of the method and return value
function logMethodCalls(context, next) {
	var message = context.instance.constructor.name + '.' + context.methodName + '(' +
		context.arguments.map(function(arg) { return arg.toString(); }).join(',') + ')';

	console.log(message);
	next();
	console.log(message + ': ' + (context.error || context.returnValue));
}

//modify the return value
function ohHiMark(context, next) {
	next();
	context.returnValue = 'oh hi mark';
}

//force an error
function alwaysErrors(context, next) {
	next();
	context.error = new Error('NOPE.');
}

//nullify an error
function noErrors(context, next) {
	next();
	context.error = null;
}

//modify function arguments
function addFoo(context, next) {
	context.arguments[0] = 'foo';
	next();
}
```

### Putting it all together
```javascript
function Foo() {
	this.bar = function(message) {
		console.log(message);
	};
}

function matchBar(instance, methodName) {
	return methodName === 'bar';
}

var container = new Container()
	.registerType(Foo)
	.intercept(matchBar, logMethodCalls, addFoo).sync();

var foo = container.resolveSync(Foo);
foo.bar();
```

### Signature shortcuts
The `matcher` argument accepts other things besides a function.

* If you give it a string, it will only intercept methods with that name
* If you give it an array, the `matcher[0]` is the type, and `matcher[1]` is
  the method name (`matcher[1]` is optional)
* If you give it something that's not a function, array or string, it will
  convert it to a boolean, and either match everything or nothing.
	* truthy values (`!!value === true`) match everything
	* falsey values (`!!value === false`) match nothing

So the example above could be configured more easily:
```javascript
container = new Container()
	.registerType(Foo)
	.intercept('bar', logMethodCalls, addFoo).sync();
```

Or even better:
```javascript
container = new Container()
	.registerType(Foo)
	.intercept([ Foo, 'bar' ], logMethodCalls, addFoo).sync();
```

### Asynchronous interception
All you've seen so far is synchronous interception. Asynchronous interception
is a little tricky. Since Sahara simply wraps the original function call,
it needs to assume some things for async functions:

1. The last argument is the callback
1. The callback uses the standard node convention: `callback(err, returnValue)`

Sahara will try to gracefully handle situations where the callback is not
given, or optional arguments are omitted. If you're not doing anything too
weird, you should be perfectly fine. So even if you have a function
defined like this that has a variable arity, Sahara will still do the right thing:

```javascript
function(options, callback) {
	if (typeof(options) === 'function') {
		callback = options;
		options = {};
	}
	if (!callback) {
		callback = arguments[arguments.length - 1];
	}

	//do stuff
	callback(err, result);
}
```

Your call handler may also change slightly. If you want to do something
after calling `next()`, you can pass an optional callback to `next()`. So our
logging call handler from above becomes:

```javascript
function logMethodCallsAsync(context, next) {
	var message = context.instance.constructor.name + '.' + context.methodName + '(' +
        context.arguments.map(function(arg) { return arg.toString(); }).join(',') + ')';

    console.log(message);
    next(function(done) {
        console.log(message + ': ' + (context.error || context.returnValue));
        done(); // <-- this is important!
    });
}
```

If you don't need to do anything after the function is executed, simply call
`next()` with no arguments.

```javascript
var count = 0;
function incrementCounter(context, next) {
	count++;
	next();
}
```

And finally, when configuring interception, use the `.async()` chain:

```javascript
function Foo() {
	this.bar = function(message, callback) {
		console.log(message);
		callback();
	};
}

var container = new Container()
	.registerType(Foo)
	.intercept(Foo, matchBar, logMethodCallsAsync).async();

//note that aysnc interception is only for asynchronous methods.
//so you can still resolve synchronously and intercept asynchronously.

container.resolveSync(Foo).bar('hello world', function(err, result) {
	//...
});
```

It's important to note that matchers are applied to all registrations, so
keep that in mind when mixing async and sync registrations. Sahara will ensure
that only async call handlers or only sync call handlers will be used per
function call, but since it doesn't know if the function itself is async,
it'll simply assume that the first match determines whether it's asynchronous
or not.

For example, don't do this:

```javascript
function Foo() {
	this.bar = function() {};
}

function asyncHandler(context, next) {
	next(function() {
		console.log('yay!');
	});
}

var container = new Container()
	.registerType(Foo)
	.intercept('bar', asyncCallHandler).async();

//synchronous call is going to use an async handler
container.resolve(Foo).bar();
```

### Creating child containers
Occasionally the need arises to create a new container that inherits all of the
configurations from another container. This can be accomplished with the
`createChildContainer()` function.

```javascript
function Foo() {}

var parent = new Container().registerType(Foo),
	child = parent.createChildContainer();

var fooInstance = child.resolveSync(Foo); // instance of Foo
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
- `intercepting` - when a method is being intercepted
  1. `arguments[0]`: the object instance
  2. `arguments[1]`: the name of the method being intercepted

**Example**:

```javascript
var container = new Container();

container
	.on('registering', function(key) { console.log(key + ' is being registered'); })
	.on('resolving', function(key) { console.log(key + ' is being resolved'); })
	.on('resolved', function(key) { console.log(key + ' has been resolved'); });

container.builder
	.on('building', function(info) { console.log('building ' + info.name); })
	.on('built', function(info) { console.log('built ' + info.name); })
	.on('intercepting', function(instance, methodName) {
		console.log('intercepting ' + instance.constructor.name + '.' + methodName);
	});
```

## Development
```bash
git clone git@github.com:tmont/sahara.git
cd sahara
npm install
npm test
```
