var should = require('should'),
	Container = require('../').Container;

describe('Interception', function() {

	describe('synchronously', function() {
		it('should execute method with return value', function() {
			function Foo() {
				this.bar = function() {
					return 'foo';
				};
			}

			var handlerInvoked = false;
			function callHandler(context, next) {
				handlerInvoked = true;
				context.should.have.property('instance', resolved);
				context.should.have.property('methodName', 'bar');
				context.should.have.property('error', null);
				context.should.have.property('arguments');
				context.arguments.should.be.empty;
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler)
				.resolveSync(Foo);

			resolved.bar().should.equal('foo');
			handlerInvoked.should.equal(true);
		});

		it('should execute method that throws', function() {
			function Foo() {
				this.bar = function() {
					throw new Error('hello world');
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				handlerInvoked = true;
				context.should.have.property('instance', resolved);
				context.should.have.property('methodName', 'bar');
				context.should.have.property('error', null);
				context.should.have.property('arguments');
				context.arguments.should.be.empty;
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler)
				.resolveSync(Foo);

			(function() { resolved.bar() }).should.throwError('hello world');
			handlerInvoked.should.equal(true);
		});

		it('should execute method with arguments', function() {
			function Foo() {
				this.bar = function(arg1, arg2) {
					return { arg1: arg1, arg2: arg2 };
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				handlerInvoked = true;
				context.should.have.property('instance', resolved);
				context.should.have.property('methodName', 'bar');
				context.should.have.property('error', null);
				context.should.have.property('arguments');
				context.arguments.should.have.length(2);
				context.arguments.should.have.length(2);
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler)
				.resolveSync(Foo);

			var arg1 = { foo: 'bar' }, arg2 = 'asdf';
			var result = resolved.bar(arg1, arg2);
			should.exist(result);
			result.should.have.property('arg1', arg1);
			result.should.have.property('arg2', arg2);
			handlerInvoked.should.equal(true);
		});

		it('should allow call handler to nullify error', function() {
			var error = new Error('oh no!');
			function Foo() {
				this.bar = function() {
					throw error;
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				next();
				handlerInvoked = true;
				context.should.have.property('error', error);
				context.error = null;
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler)
				.resolveSync(Foo);

			(function() { resolved.bar(); }).should.not.throwError();
			handlerInvoked.should.equal(true);
		});

		it('should allow call handler to set error', function() {
			var error = new Error('oh no!');

			function Foo() {
				this.bar = function() {
					return 'foo';
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				next();
				handlerInvoked = true;
				context.should.have.property('error', null);
				context.should.have.property('returnValue', 'foo');
				context.error = error;
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler)
				.resolveSync(Foo);

			(function() { resolved.bar(); }).should.throwError(error);
			handlerInvoked.should.equal(true);
		});

		it('should allow call handler to modify return value', function() {
			function Foo() {
				this.bar = function() {
					return 'foo';
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				next();
				handlerInvoked = true;
				context.should.have.property('returnValue', 'foo');
				context.returnValue = 'bar';
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler)
				.resolveSync(Foo);

			resolved.bar().should.equal('bar');
			handlerInvoked.should.equal(true);
		});

		it('should allow call handler to modify arguments', function() {
			function Foo() {
				this.bar = function(arg1) {
					return arg1;
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				next();
				handlerInvoked = true;
				context.arguments.should.have.length(1);
				context.arguments[0].should.equal('foo');
				context.returnValue = 'bar';
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler)
				.resolveSync(Foo);

			resolved.bar('foo').should.equal('bar');
			handlerInvoked.should.equal(true);
		});

		it('should execute multiple call handlers', function() {
			function Foo() {
				this.bar = function() {
					return 'foo';
				};
			}

			var invocations = 0;

			function callHandler1(context, next) {
				invocations++;
				next();
			}

			function callHandler2(context, next) {
				invocations++;
				next();
			}

			new Container()
				.registerType(Foo)
				.intercept(Foo, function() { return true; }, callHandler1, callHandler2)
				.resolveSync(Foo)
				.bar();

			invocations.should.equal(2);
		});

		it('should filter out calls by method name', function() {
			function Foo() {
				this.bar = function() {};
				this.foo = function() {};
			}

			var invocations = 0;

			function callHandler(context, next) {
				invocations++;
				next();
			}

			function matcher(instance, methodName) {
				instance.should.be.instanceOf(Foo);
				return methodName === 'bar';
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, matcher, callHandler)
				.intercept(Foo, function() { return false; }, callHandler)
				.resolveSync(Foo);

			resolved.bar();
			resolved.foo();

			invocations.should.equal(1);
		});
	});
});