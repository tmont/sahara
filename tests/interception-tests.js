var should = require('should'),
	Container = require('../').Container,
	async = require('async');

describe('Interception', function() {

	function always() {
		return true;
	}

	it('should not override non-configurable functions', function() {
		function Foo() {
			Object.defineProperty(this, 'bar', {
				value: function() {
					return 'baz';
				}
			});
		}

		var handlerInvoked = false;
		function callHandler(context, next) {
			handlerInvoked = true;
			next();
		}

		var resolved = new Container()
			.registerType(Foo)
			.intercept(always, callHandler).sync()
			.resolveSync(Foo);

		resolved.bar().should.equal('baz');
		handlerInvoked.should.equal(false, 'call handler should not have been invoked');
	});

	it('should intercept methods on the prototype', function() {
		function Foo() {}

		Foo.prototype = {
			bar: function() {}
		};

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var resolved = new Container()
			.registerType(Foo)
			.intercept(always, callHandler).sync()
			.resolveSync(Foo);

		resolved.bar();
		invocations.should.equal(1);
	});

	it('should emit events', function() {
		function Foo() {
			this.bar = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var container = new Container();

		var eResolved = 0,
			resolving = 0,
			building = 0,
			built = 0,
			intercepting = 0,
			registering = 0;

		container.on('resolving', function(key) {
			key.should.equal('Foo');
			resolving++;
		});
		container.on('resolved', function(key) {
			key.should.equal('Foo');
			eResolved++;
		});
		container.on('registering', function(key) {
			key.should.equal('Foo');
			registering++;
		});
		container.builder.on('building', function(info) {
			info.name.should.equal('Foo');
			building++;
		});
		container.builder.on('built', function(info) {
			info.name.should.equal('Foo');
			built++;
		});
		container.builder.on('intercepting', function(instance, methodName) {
			methodName.should.equal('bar');
			intercepting++;
		});

		var resolved = container
			.registerType(Foo)
			.intercept(always, callHandler).sync()
			.resolveSync(Foo);

		resolved.bar();
		invocations.should.equal(1);
		resolving.should.equal(1);
		eResolved.should.equal(1);
		registering.should.equal(1);
		building.should.equal(1);
		built.should.equal(1);
		intercepting.should.equal(1);
	});

	it('should allow explicit method name as matcher', function() {
		function Foo() {
			this.bar = function() {};
			this.foo = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var resolved = new Container()
			.registerType(Foo)
			.intercept('bar', callHandler).sync()
			.resolveSync(Foo);

		resolved.bar();
		resolved.foo();
		invocations.should.equal(1);
	});

	it('should match everything if matcher === true', function() {
		function Foo() {
			this.bar = function() {};
			this.foo = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var resolved = new Container()
			.registerType(Foo)
			.intercept(true, callHandler).sync()
			.resolveSync(Foo);

		resolved.bar();
		resolved.foo();
		invocations.should.equal(2);
	});

	it('should match everything if matcher is truthy and not a string', function() {
		function Foo() {
			this.bar = function() {};
			this.foo = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var resolved = new Container()
			.registerType(Foo)
			.intercept(3, callHandler).sync()
			.resolveSync(Foo);

		resolved.bar();
		resolved.foo();
		invocations.should.equal(2);
	});

	it('should match nothing if matcher === false', function() {
		function Foo() {
			this.bar = function() {};
			this.foo = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var resolved = new Container()
			.registerType(Foo)
			.intercept(false, callHandler).sync()
			.resolveSync(Foo);

		resolved.bar();
		resolved.foo();
		invocations.should.equal(0);
	});

	it('should match everything if matcher is falsey and not a string', function() {
		function Foo() {
			this.bar = function() {};
			this.foo = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var resolved = new Container()
			.registerType(Foo)
			.intercept(null, callHandler).sync()
			.resolveSync(Foo);

		resolved.bar();
		resolved.foo();
		invocations.should.equal(0);
	});

	it('should match type if matcher is an array', function() {
		function Foo() {
			this.bar = function() {};
		}
		function Bar() {
			this.baz = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var container = new Container()
			.registerType(Foo)
			.registerType(Bar)
			.intercept([ Foo ], callHandler).sync();

		container.resolveSync(Foo).bar();
		invocations.should.equal(1);
		container.resolveSync(Bar).baz();
		invocations.should.equal(1);
	});

	it('should match type and method name if matcher is an array', function() {
		function Foo() {
			this.foo = function() {};
			this.bar = function() {};
		}
		function Bar() {
			this.bar = function() {};
		}

		var invocations = 0;

		function callHandler(context, next) {
			invocations++;
			next();
		}

		var container = new Container()
			.registerType(Foo)
			.registerType(Bar)
			.intercept([ Foo, 'bar' ], callHandler).sync();

		var foo = container.resolveSync(Foo),
			bar = container.resolveSync(Bar);
		foo.bar();
		invocations.should.equal(1);
		foo.foo();
		invocations.should.equal(1);
		bar.bar();
		invocations.should.equal(1);
	});

	it('should apply matcher globally', function() {
		function Foo() {
			this.bar = function() {};
		}

		function Bar() {
			this.foo = function() {};
		}

		var callHandler1Invocations = 0,
			callHandler2Invocations = 0;

		function callHandler1(context, next) {
			callHandler1Invocations++;
			next();
		}

		function callHandler2(context, next) {
			callHandler2Invocations++;
			next();
		}

		var container = new Container()
				.registerType(Foo)
				.registerType(Bar)
				.intercept(true, callHandler1).sync()
				.intercept(true, callHandler2).sync(),
			foo = container.resolveSync(Foo),
			bar = container.resolveSync(Bar);

		foo.bar();
		bar.foo();
		callHandler1Invocations.should.equal(2);
		callHandler2Invocations.should.equal(2);
	});

	it('should not mix async and sync handlers when sync was registered first', function() {
		function Foo() {
			this.bar = function() {};
		}

		var callHandler1Invocations = 0,
			callHandler2Invocations = 0;

		function callHandler1(context, next) {
			callHandler1Invocations++;
			next();
		}

		function callHandler2(context, next) {
			callHandler2Invocations++;
			next();
		}

		var container = new Container()
				.registerType(Foo)
				.intercept(true, callHandler1).sync()
				.intercept(true, callHandler2).async(),
			foo = container.resolveSync(Foo);

		foo.bar();
		callHandler1Invocations.should.equal(1);
		callHandler2Invocations.should.equal(0);
	});

	it('should not mix async and sync handlers when async was registered first', function(done) {
		function Foo() {
			this.bar = function(callback) {
				callback();
			};
		}

		var callHandler1Invocations = 0,
			callHandler2Invocations = 0;

		function callHandler1(context, next) {
			callHandler1Invocations++;
			next();
		}

		function callHandler2(context, next) {
			callHandler2Invocations++;
			next();
		}

		var container = new Container()
				.registerType(Foo)
				.intercept(true, callHandler1).async()
				.intercept(true, callHandler2).sync(),
			foo = container.resolveSync(Foo);

		foo.bar(function() {
			callHandler1Invocations.should.equal(1);
			callHandler2Invocations.should.equal(0);
			done();
		});
	});

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
				.intercept(always, callHandler).sync()
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
				.intercept(always, callHandler).sync()
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
				.intercept(always, callHandler).sync()
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
				.intercept(always, callHandler).sync()
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
				.intercept(always, callHandler).sync()
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
				.intercept(always, callHandler).sync()
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
				.intercept(always, callHandler).sync()
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
				.intercept(always, callHandler1, callHandler2).sync()
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
				.intercept(matcher, callHandler1).sync()
				.resolveSync(Foo);

			resolved.bar();
			resolved.foo();

			invocations.should.equal(1);
		});

		it('should not execute method if error is set', function() {
			var barCalled = false;

			function Foo() {
				this.bar = function() {
					barCalled = true;
				};
			}

			function callHandler(context, next) {
				context.error = new Error('NOPE.');
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler).sync()
				.resolveSync(Foo);

			(function() { resolved.bar(); }).should.throwError('NOPE.');
			barCalled.should.equal(false);
		});
	});

	describe('asynchronously', function() {
		it('should emit events', function(done) {
			function Foo() {
				this.bar = function(callback) {
					callback();
				};
			}

			var invocations = 0;

			function callHandler(context, next) {
				invocations++;
				next();
			}

			var container = new Container();

			var eResolved = 0,
				resolving = 0,
				building = 0,
				built = 0,
				intercepting = 0,
				registering = 0;

			container.on('resolving', function(key) {
				key.should.equal('Foo');
				resolving++;
			});
			container.on('resolved', function(key) {
				key.should.equal('Foo');
				eResolved++;
			});
			container.on('registering', function(key) {
				key.should.equal('Foo');
				registering++;
			});
			container.builder.on('building', function(info) {
				info.name.should.equal('Foo');
				building++;
			});
			container.builder.on('built', function(info) {
				info.name.should.equal('Foo');
				built++;
			});
			container.builder.on('intercepting', function(instance, methodName) {
				methodName.should.equal('bar');
				intercepting++;
			});

			container
				.registerType(Foo)
				.intercept(always, callHandler).async();

			container.resolve(Foo, function(err, resolved) {
				should.not.exist(err);
				resolved.bar();
				invocations.should.equal(1);
				resolving.should.equal(1);
				eResolved.should.equal(1);
				registering.should.equal(1);
				building.should.equal(1);
				built.should.equal(1);
				intercepting.should.equal(1);
				done();
			});
		});

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
				.intercept(always, callHandler).async()
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
				.intercept(always, callHandler).async()
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
				next(function(done) {
					context.should.have.property('error', error);
					context.error = null;
					done();
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler).async()
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
				next(function(done) {
					handlerInvoked = true;
					context.should.have.property('error', null);
					context.error = error;
					done();
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler).async()
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
				next(function(done) {
					handlerInvoked = true;
					context.should.have.property('returnValue', 'foo');
					context.returnValue = 'bar';
					done();
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler).async()
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
				next(function(done) {
					handlerInvoked = true;
					context.arguments.should.have.length(2);
					context.arguments[0].should.equal('foo');
					context.returnValue = 'bar';
					done();
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler).async()
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
				.intercept(always, callHandler1).async()
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
				next(function(done) {
					if (context.arguments.length > 1) {
						enoughArgsInvoked = true;
					} else {
						notEnoughArgsInvoked = true;
					}
					done();
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler1).async()
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

			var invocation1 = 0,
				invocation1Next = 0,
				invocation2 = 0,
				invocation2Next = 0,
				invocation3 = 0,
				invocation3Next = 0;

			function callHandler1(context, next) {
				invocation1++;
				next(function(done) {
					invocation1Next++;
					done();
				});
			}

			function callHandler2(context, next) {
				invocation2++;
				next(function(done) {
					invocation2Next++;
					done();
				});
			}

			function callHandler3(context, next) {
				invocation3++;
				next(function(done) {
					invocation3Next++;
					done();
				});
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler1, callHandler2).async()
				.intercept(always, callHandler3).async()
				.resolveSync(Foo);

			resolved.bar(function() {
				invocation1.should.equal(1);
				invocation1Next.should.equal(1, 'next() callback in first call handler not executed');
				invocation2.should.equal(1);
				invocation2Next.should.equal(1, 'next() callback in second call handler not executed');
				invocation3.should.equal(1);
				invocation3Next.should.equal(1, 'next() callback in third call handler not executed');
				done();
			});
		});

		it('should not execute method if error is set', function(done) {
			var barCalled = false;

			function Foo() {
				this.bar = function(callback) {
					barCalled = true;
					callback();
				};
			}

			function callHandler(context, next) {
				context.error = new Error('NOPE.');
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler).async()
				.resolveSync(Foo);

			resolved.bar(function(err) {
				err.should.be.instanceOf(Error);
				err.should.have.property('message', 'NOPE.');
				barCalled.should.equal(false);
				done();
			});
		});

		it('should pass extra arguments back to callback', function(done) {
			function Foo() {
				this.bar = function(callback) {
					callback(null, 'foo', 'bar', 'baz');
				};
			}

			function callHandler(context, next) {
				next();
			}

			var resolved = new Container()
				.registerType(Foo)
				.intercept(always, callHandler).async()
				.resolveSync(Foo);

			resolved.bar(function(err, foo, bar, baz) {
				should.not.exist(err);
				foo.should.equal('foo');
				bar.should.equal('bar');
				baz.should.equal('baz');
				done();
			});
		});
	});
});