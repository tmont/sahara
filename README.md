# Sahara
[![Build Status](https://travis-ci.org/tmont/sahara.png)](https://travis-ci.org/tmont/sahara)

Sahara is a simple little inversion of control container. Specifically, it
handles dependency injection. Even more specifically, it handles
constructor argument injection. It even does some fancy type parsing
of function signatures, if you're into that kind of thing.

## Installation
Install (eventually) using [NPM](https://github.com/isaacs/npm): `npm install sahara`

## Usage
### Registering an instance
Sahara is simply a container for objects and object dependencies. In the simplest
case, you shove an object into it using `registerInstance()` and retrieve it
using `resolve()`:

```javascript
var Container = require('sahara').Container,
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

### Lifetime management
But wait, there's more configuration! To give you more fine-grained control
over the objects that Sahara creates, you can specify a **Lifetime**. This
basically tells Sahara how to store the object, in effect governing the
lifetime of the object.

The default lifetime is the `TransientLifetime`, which means that every time
you call `resolve()` Sahara will pretend like it's never seen this type
before and run the object building sequence every time.

The other bundled lifetime is the `MemoryLifetime`, which will store the
object instance in memory, and reuse that instance every time the container
attempts to resolve that type. This is useful when you have an object
with an expensive construction time (e.g. a database connection) that
you would want to reuse for the duration of your script.

```javascript
var Lifetime = require('sahara').Lifetime;

function DbConnection() {
	this.client = mysql.connect({...});
}

container.registerType(DbConnection, null, new Lifetime.Memory());
```

### Property and method injection
By default, Sahara performs *constructor injection*. That is, it resolves
dependencies that are specified in the constructor. What if you have
dependencies that are not in the constructor? Well, there are a few ways
to alleviate that problem as well.

#### Property injection
Property injection simply sets the value of a property on an object
when it is `resolve()`'d.

There are two ways to do it. You can simply give the value of the
property:

```javascript
var Inject = sahara.Inject;

function Foo() {
	this.name = 'foo';
}

container.registerType(Foo, null, null, [ new Inject.PropertyValue('name', 'bar') ]);
console.log(container.resolve('Foo').name); //"bar"
```

Or you can have the container resolve the type. In this case, you
must specify the property's type:

```javascript
function Foo() {
	this.name = 'foo';
}
function Bar() {
	this.toString = function() { return 'I am Bar'; };
}

container
	.registerType(Foo, null, null, [ new Inject.Property('name', 'Bar') ])
	.registerType(Bar);
console.log(container.resolve('Foo').name); //"I am Bar"
```

#### Method injection
Method injection invokes the specified method with optional arguments
during resolution. Again, you can specify the arguments explicitly:

```javascript
function Foo() {
	this.name = 'foo';
	this.setName = function(newName) {
		this.name = newName;
	};
}

container.registerType(Foo, null, null, [ new Inject.Method('setName', [ 'bar' ]) ]);
console.log(container.resolve('Foo').name); //"bar"
```

Or you can let the container resolve the method's arguments.  To
accomplish this, simply omit the optional array of arguments to the
`Method` constructor.Note that this uses the same procedure as
`Container.prototype.registerType`, so you'll need to specify the
types of each parameter with a comment.

```javascript
function Foo() {
	this.name = 'foo';
	this.setName = function(/** TheNewName */newName) {
		this.name = newName;
	};
}

container
	.registerType(Foo, null, null, [ new Inject.Method('setName') ])
	.registerInstance('TheNewName', 'This is the new name');
console.log(container.resolve('Foo').name); //"This is the new name"
```

#### Manual injection
The container also provides a method for performing injection on an
already existing object. This can be useful if an object was created
without using the container.

```javascript
function Foo() {
	this.name = 'foo';
}

container.registerType(Foo, null, null, [ new Inject.PropertyValue('name', 'bar') ]);

var instance = new Foo();
console.log(instance.name); //"foo"
container.inject('Foo', instance);
console.log(instance.name); //"bar"
```

## In the real world
Inversion of control containers are useful for easing the pain of objects
depending on other objects.

For example, say you had database/repository/whatever object that was
used ubiquitously. In the old days, you would probably make it a singleton,
and do something like `db.getInstance().query(...)`. But everybody knows
that singletons are bad, so you should probably pass around the instance
of your database object that gets used elsewhere. IoC containers help
alleviate the mess that can come from trying to accomplish this.

The setup:

```javascript
var connectionInfo = { host: 'localhost', port: 6379 };
var viewEngine = require('jade');
var viewDirectory = __dirname + '/views';

function DbConnection(/** DbConnectionInfo */info) {
	this.conn = redis.createClient(info.port, info.host);
}

function DbFacade(/** DbConnection */conn) {
	this.conn = conn;
}

DbFacade.prototype = {
	insert: function(key, value, callback) {
		this.conn.set(key, value, callback);
	},

	select: function(key, callback) {
		this.conn.get(key, callback);
	}
};

function ViewRenderer(/** ViewEngine */engine, /** ViewDirectory */dir) {
	this.engine = engine;
	this.dir = dir;
}

ViewRenderer.prototype = {
	render: function(viewName, params) {
		var renderer = this,
			fileName = require('path').join(this.dir, viewName + '.jade');
		fs.readFile(fileName, 'utf8', function(err, contents) {
			if (err) {
				throw err;
			}

			renderer.engine.compile(contents)(params);
		});
	}
};

//elsewhere, like in a controller or something
function BlogController(/** DbFacade */ db, /** ViewRenderer */ renderer) {
	this.db = db;
	this.renderer = renderer;
}

BlogController.prototype = {
	showPost: function(id) {
		this.db.select('blog:post:' + id, function(err, result) {
			if (err) {
				this.renderer.render('error', err);
				return;
			}

			this.renderer.render('post', result);
		});
	}
};

```

Now, configure the container:
```javascript
var jade = require('jade'),
	sahara = require('sahara');

var container = new sahara.Container()
	.registerInstance('ViewDirectory', viewDirectory)
	.registerInstance('ViewEngine', jade)
	.registerInstance('DbConnectionInfo', connectionInfo, new sahara.Lifetime.Memory())
	.registerType(DbConnection, new sahara.Lifetime.Memory())
	.registerType(DbFacade)
	.registerType(ViewRenderer)
	.registerType(BlogController);
```

And now, to instantiate your controller, you simply do this:
```javascript
var controller = container.resolve('BlogController');
controller.showPost(1);
```

So, the trade-off is that there is more up-front configuration, but
much less manual management. Which is usually a very, very good
trade-off.

## Development
```bash
git clone git@github.com:tmont/sahara.git
cd sahara
npm install
npm test
```