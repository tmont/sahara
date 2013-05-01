var should = require('should'),
	Container = require('../').Container,
	async = require('async');

describe('Interception', function() {

	function always() {
		return true;
	}

	describe('synchronously', function() {
		it('should return value', function() {
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
				.intercept(Foo, always, false, callHandler)
				.resolveSync(Foo);

			resolved.bar().should.equal('foo');
			handlerInvoked.should.equal(true);
		});

		it('should throw error', function() {
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
				.intercept(Foo, always, false, callHandler)
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
				.intercept(Foo, always, false, callHandler)
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
				.intercept(Foo, always, false, callHandler)
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
				.intercept(Foo, always, false, callHandler)
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
				.intercept(Foo, always, false, callHandler)
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
				.intercept(Foo, always, false, callHandler)
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

			var invocation1 = false,
				invocation2 = false;

			function callHandler1(context, next) {
				invocation1 = true;
				next();
			}

			function callHandler2(context, next) {
				invocation2 = true;
				next();
			}

			new Container()
				.registerType(Foo)
				.intercept(Foo, always, false, callHandler1, callHandler2)
				.resolveSync(Foo)
				.bar();

			invocation1.should.equal(true);
			invocation2.should.equal(true);
		});

		it('should filter out calls by method name', function() {
			function Foo() {
				this.bar = function() {};
				this.foo = function() {};
			}

			var invocations = 0;

			function callHandler1(context, next) {
				invocations++;
				next();
			}

			function matcher(instance, methodName) {
				instance.should.be.instanceOf(Foo);
				return methodName === 'bar';
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, matcher, false, callHandler1)
				.resolveSync(Foo);

			resolved.bar();
			resolved.foo();

			invocations.should.equal(1);
		});
	});

	describe('asynchronously', function() {
		it('should set return value', function(done) {
			function Foo() {
				this.bar = function(callback) {
					callback(null, 'foo');
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				handlerInvoked = true;
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler)
				.resolveSync(Foo);

			resolved.bar(function(err, result) {
				should.not.exist(err);
				result.should.equal('foo');
				handlerInvoked.should.equal(true);
				done();
			});
		});

		it('should raise error', function(done) {
			function Foo() {
				this.bar = function(callback) {
					callback('hello world', 'foo');
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				handlerInvoked = true;
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler)
				.resolveSync(Foo);

			resolved.bar(function(err, result) {
				err.should.equal('hello world');
				result.should.equal('foo');
				handlerInvoked.should.equal(true);
				done();
			});
		});

		it('should allow call handler to nullify error', function(done) {
			var error = new Error('oh no!');

			function Foo() {
				this.bar = function(callback) {
					callback(error);
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				handlerInvoked = true;
				next(function() {
					context.should.have.property('error', error);
					context.error = null;
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler)
				.resolveSync(Foo);

			resolved.bar(function(err) {
				handlerInvoked.should.equal(true);
				should.not.exist(err);
				done();
			});
		});

		it('should allow call handler to set error', function(done) {
			var error = new Error('oh no!');

			function Foo() {
				this.bar = function(callback) {
					callback();
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				next(function() {
					handlerInvoked = true;
					context.should.have.property('error', null);
					context.error = error;
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler)
				.resolveSync(Foo);

			resolved.bar(function(err) {
				err.should.equal(error);
				handlerInvoked.should.equal(true);
				done();
			});
		});

		it('should allow call handler to modify return value', function(done) {
			function Foo() {
				this.bar = function(callback) {
					callback(null, 'foo');
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				next(function() {
					handlerInvoked = true;
					context.should.have.property('returnValue', 'foo');
					context.returnValue = 'bar';
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler)
				.resolveSync(Foo);

			resolved.bar(function(err, result) {
				handlerInvoked.should.equal(true);
				should.not.exist(err);
				result.should.equal('bar');
				done();
			});
		});

		it('should allow call handler to modify arguments', function(done) {
			function Foo() {
				this.bar = function(arg1, callback) {
					callback(null, arg1);
				};
			}

			var handlerInvoked = false;

			function callHandler(context, next) {
				next(function() {
					handlerInvoked = true;
					context.arguments.should.have.length(2);
					context.arguments[0].should.equal('foo');
					context.returnValue = 'bar';
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler)
				.resolveSync(Foo);

			resolved.bar('foo', function(err, result) {
				handlerInvoked.should.equal(true);
				should.not.exist(err);
				result.should.equal('bar');
				done();
			});
		});

		it('should handle variable arity', function(done) {
			function Foo() {
				this.bar = function() {
					var callback = arguments[arguments.length - 1];
					callback();
				};
			}

			var noArgsInvoked = false,
				someArgsInvoked = false;

			function callHandler1(context, next) {
				if (context.arguments.length > 1) {
					someArgsInvoked = true;
				} else {
					noArgsInvoked = true;
				}

				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler1)
				.resolveSync(Foo);

			function noArgs(callback) {
				resolved.bar(function() {
					noArgsInvoked.should.equal(true);
					callback();
				});
			}

			function someArgs(callback) {
				resolved.bar(1, null, {}, ['asdf'], function() {
					someArgsInvoked.should.equal(true);
					callback();
				});
			}

			async.series([ noArgs, someArgs ], done);
		});

		it('should handle call when too few arguments passed', function(done) {
			function Foo() {
				this.bar = function(foo, callback) {
					if (typeof(foo) === 'function') {
						callback = foo;
					}

					callback();
				};
			}

			var notEnoughArgsInvoked = false,
				enoughArgsInvoked = false;

			function callHandler1(context, next) {
				if (context.arguments.length > 1) {
					enoughArgsInvoked = true;
				} else {
					notEnoughArgsInvoked = true;
				}
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler1)
				.resolveSync(Foo);

			function notEnoughArgs(callback) {
				resolved.bar(function() {
					notEnoughArgsInvoked.should.equal(true);
					callback();
				});
			}

			function enoughArgs(callback) {
				resolved.bar('foo', function() {
					enoughArgsInvoked.should.equal(true);
					callback();
				});
			}

			async.series([ notEnoughArgs, enoughArgs ], done);
		});

		it('should execute multiple call handlers', function(done) {
			function Foo() {
				this.bar = function(callback) {
					callback();
				};
			}

			var invocation1 = false,
				invocation1Next = false,
				invocation2 = false,
				invocation2Next = false,
				invocation3 = false,
				invocation3Next = false;

			function callHandler1(context, next) {
				invocation1 = true;
				next(function() {
					invocation1Next = true;
				});
			}

			function callHandler2(context, next) {
				invocation2 = true;
				next(function() {
					invocation2Next = true;
				});
			}

			function callHandler3(context, next) {
				invocation3 = true;
				next(function() {
					invocation3Next = true;
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(Foo, always, true, callHandler1, callHandler2, callHandler3)
				.resolveSync(Foo);

			resolved.bar(function() {
				invocation1.should.equal(true);
				invocation1Next.should.equal(true, 'next() callback in first call handler not executed');
				invocation2.should.equal(true);
				invocation2Next.should.equal(true, 'next() callback in second call handler not executed');
				invocation3.should.equal(true);
				invocation3Next.should.equal(true, 'next() callback in third call handler not executed');
				done();
			});
		});
	});
});