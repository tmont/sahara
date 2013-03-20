# Sahara
[![Build Status](https://travis-ci.org/tmont/sahara.png)](https://travis-ci.org/tmont/sahara)

Sahara is a simple little inversion of control container. Specifically, it
handles dependency injection. Even more specifically, it handles
constructor argument injection. It even does some fancy type parsing
of function signatures, if you're into that kind of thing.

## Installation
Install using [NPM](https://github.com/isaacs/npm): `npm install sahara`

## Usage
### Registering an instance
Sahara is simply a container for objects and object dependencies. In the simplest
case, you shove an object into it using `registerInstance()` and retrieve it
using `resolve()`:

```javascript
var Container = require('sahara'),
    container = new Container();

var myObject = { oh: 'hai mark' };
container.registerInstance('MyObject', myObject);
var instance = container.resolve('MyObject');
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

var anotherObject = container.resolve('AnotherObject');
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
	.registerInstance('Foo', new Foo('oh hai mark'))
	.registerType(Bar)
	.registerType(Baz)
	.resolve('Baz')
	.bar.foo.message; //"oh hai mark"
```

**NOTE**: When using `registerType`, you *MUST* register a function that is a constructor

#### Registering using an anonymous function
If you don't have a named function, you can also register an anonymous
function, but you *must* provide a name for it:

```javascript
var foo = function() {};
container.registerType(foo, 'MySpecialName');
var fooInstance = container.resolve('MySpecialName');
```

#### Cyclic dependencies
...are bad.

```javascript
function Foo(/** Bar */bar) {}
function Bar(/** Foo */foo) {}

container.registerType(Foo); //throws "Cyclic dependency from Foo to Bar"
```

## Development
```bash
git clone git@github.com:tmont/sahara.git
cd sahara
npm install
npm test
```