var should = require('should'),
	sahara = require('../'),
	Container = sahara.Container;

describe('Container', function() {

	it('should throw if type is not registered', function() {
		(function() { new Container().resolveSync('Foo'); })
			.should
			.throwError('Nothing with key "Foo" is registered in the container');
	});

	it('should show pretty message for sync resolution errors', function() {
		function Foo(/** Baz */baz, /** Bar */bar) {}
		function Bar(/** Baz */baz, /** Bat */bat) {}
		function Baz() {}

		var container = new Container()
			.registerType(Foo)
			.registerType(Bar)
			.registerType(Baz);

		(function() { container.resolveSync(Foo); })
			.should
			.throwError('Nothing with key "Bat" is registered in the container; error occurred while resolving "Foo" -> "Bar" -> "Bat"');
	});

	it('should show pretty message for async resolution errors', function(done) {
		function Foo(/** Baz */baz, /** Bar */bar) {}
		function Bar(/** Baz */baz, /** Bat */bat) {}
		function Baz() {}

		var container = new Container()
			.registerType(Foo)
			.registerType(Bar)
			.registerType(Baz);

		container.resolve(Foo, function(err, instance) {
			should.exist(err);
			should.not.exist(instance);
			err.message.should.equal('Nothing with key "Bat" is registered in the container; error occurred while resolving "Foo" -> "Bar" -> "Bat"');
			done();
		});
	});

	it('should not throw if key does not exist for tryResolveSync()', function() {
		(function() {
			var resolved = new Container().tryResolveSync('foo');
			should.strictEqual(resolved, undefined);
		}).should.not.throwError();
	});

	it('should determine if something is registered', function() {
		function foo() {}

		var container = new Container().registerType(foo);

		container.isRegistered('foo').should.equal(true);
		container.isRegistered(foo).should.equal(true);
		container.isRegistered('bar').should.equal(false);
	});

	describe('resolve signature shortcuts', function() {
		it('should resolve from constructor instead of key', function() {
			function Foo() {}

			var instance = new Foo(),
				resolved = new Container()
					.registerInstance(instance)
					.resolveSync(Foo);

			resolved.should.equal(instance);
		});

		it('should allow explicit key instead of options.key', function() {
			function Foo() {}

			var instance = new Foo(),
				resolved = new Container()
					.registerInstance(instance, 'asdf')
					.resolveSync('asdf');

			resolved.should.equal(instance);
		});

		it('should allow explicit lifetime instead of options.lifetime', function() {
			var fetchCalled = false, storeCalled = false;
			var lifetime = {
				store: function(value) {
					value.should.equal('foo');
					storeCalled = true;
				},
				fetch: function() {
					fetchCalled = true;
				}
			};

			var resolved = new Container()
					.registerInstance('foo', 'asdf', lifetime)
					.resolveSync('asdf');

			resolved.should.equal('foo');
			fetchCalled.should.equal(true, 'lifetime.fetch() was not called');
			storeCalled.should.equal(true, 'lifetime.store() was not called');
		});

		it('should allow explicit injections instead of options.injections', function() {
			function Foo() {
				this.foo = null;
				this.bar = null;
			}

			var injection1 = sahara.inject.propertyValue('foo', 'hello'),
				injection2 = sahara.inject.propertyValue('bar', 'world');

			var resolved = new Container()
				.registerType(Foo, null, null, injection1, injection2)
				.resolveSync(Foo);

			resolved.should.be.instanceOf(Foo);
			resolved.should.have.property('foo', 'hello');
			resolved.should.have.property('bar', 'world');
		});
	});

	describe('registration from instance', function() {
		it('should register and resolve instance', function() {
			function Foo() {}
			var instance = new Foo(),
				resolved = new Container()
					.registerInstance(instance)
					.resolveSync('Foo');

			resolved.should.equal(instance);
		});

		it('should register and resolve instance with specified key', function() {
			function Foo() {}
			var instance = new Foo(),
				resolved = new Container()
					.registerInstance(instance, { key: 'asdf' })
					.resolveSync('asdf');

			resolved.should.equal(instance);
		});

		it('should use lifetime', function() {
			var fetchCalled = false, storeCalled = false;
			var lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.equal('foo');
				}
			};

			new Container()
				.registerInstance('foo', { key: 'foo', lifetime: lifetime })
				.resolveSync('foo');

			fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
			storeCalled.should.equal(true, 'lifetime.store() should have been called');
		});
	});

	describe('registration from factory', function() {
		it('should register and resolve factory', function() {
			var instance = {},
				resolved = new Container()
					.registerFactory(function() { return instance; }, { key: 'poopoo' })
					.resolveSync('poopoo');

			resolved.should.equal(instance);
		});

		it('should register and resolve fat-arrow function', function() {
			var instance = {},
				resolved = new Container()
					.registerFactory(() => { return instance; }, { key: 'poopoo' })
					.resolveSync('poopoo');

			resolved.should.equal(instance);
		});

		it('should throw if key is not provided', function() {
			(function() { new Container().registerFactory(function() {}); })
				.should
				.throwError('"options.key" must be passed to registerFactory()');
		});

		it('should pass container into factory function', function() {
			var instance = {},
				resolved = new Container()
					.registerFactory(function(container) {
						should.exist(container);
						container.should.be.instanceOf(Container);
						return instance;
					}, { key: 'poopoo' })
					.resolveSync('poopoo');

			resolved.should.equal(instance);
		});

		it('should use lifetime', function() {
			var fetchCalled = false, storeCalled = false;
			var lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.equal('foo');
				}
			};

			new Container()
				.registerFactory(function() { return 'foo'; }, { key: 'foo', lifetime: lifetime })
				.resolveSync('foo');

			fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
			storeCalled.should.equal(true, 'lifetime.store() should have been called');
		});
	});

	describe('registration from function definition', function() {
		it('should require specified key if named function not given', function() {
			(function() { new Container().registerType(function() {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
		});

		it('should require specified key if fat arrow function without arguments given', function() {
			(function() { new Container().registerType(() => {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
		});

		it('should require specified key if fat arrow function with single argument without parens given', function() {
			(function() { new Container().registerType(foo => {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
		});

		it('should require specified key if fat arrow function with multiple arguments given', function() {
			(function() { new Container().registerType((foo, bar) => {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
		});

		it('should report attempts at registering objects', function() {
			function Foo() {}
			(function() { new Container().registerType(new Foo()) })
				.should
				.throwError('Constructor must be a function, got instance of Foo');
		});

		it('should report attempts at registering null', function() {
			(function() { new Container().registerType(null); }).should.throwError('Constructor must be a function, got null');
			(function() { new Container().registerType(); }).should.throwError('Constructor must be a function, got null');
		});

		it('should use specified key even if named function given', function() {
			function Foo() {}
			var instance = new Container()
				.registerType(Foo, { key: 'Lolz' })
				.resolveSync('Lolz');

			instance.should.be.instanceOf(Foo);
		});

		it('should use specified key if anonymous function given', function() {
			var foo = function() {};
			var instance = new Container()
				.registerType(foo, { key: 'Lolz' })
				.resolveSync('Lolz');

			instance.should.be.instanceOf(foo);
		});

		it('should use doc comments to get parameter types', function() {
			function Bar() {}
			function Foo(/** Bar */bar) {
				this.bar = bar;
			}

			var bar = new Bar(),
				foo = new Container()
					.registerInstance(bar)
					.registerType(Foo)
					.resolveSync('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.be.equal(bar);

			// yarp
			function Foo2(/** Bar **/bar) {
				this.bar = bar;
			}

			var foo2 = new Container()
				.registerInstance(bar)
				.registerType(Foo2)
				.resolveSync('Foo2');

			foo2.should.be.instanceOf(Foo2);
			foo2.bar.should.be.equal(bar);
		});

		it('should allow copious whitespace in function definition', function() {
			function Bar() {}
			function Foo(
				/** Bar */bar,
				/** Bar */bar2
			) {
				this.bar = bar;
				this.bar2 = bar2;
			}

			var bar = new Bar(),
				foo = new Container()
					.registerInstance(bar)
					.registerType(Foo)
					.resolveSync('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.equal(bar);
			foo.bar2.should.equal(bar);
		});

		it('should throw if signature does not contain type info', function() {
			function Foo(bar) {
				this.bar = bar;
			}

			(function() {
				new Container().registerType(Foo);
			}).should.throwError('Unable to determine type of parameter at position 1 for type "Foo"');
		});

		it('should detect cyclic dependencies', function() {
			function Foo(/** Bar */bar) {}
			function Bar(/** Foo */foo) {}

			(function() {
				new Container().registerType(Foo).registerType(Bar);
			}).should.throwError(/^Bar's dependencies create a cycle/);
		});

		it('should use lifetime', function() {
			var fetchCalled = false, storeCalled = false;
			var lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.be.instanceOf(Foo);
				}
			};

			function Foo() {}

			new Container()
				.registerType(Foo, { key: 'foo', lifetime: lifetime })
				.resolveSync('foo');

			fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
			storeCalled.should.equal(true, 'lifetime.store() should have been called');
		});
	});

	describe('registration from class definition', function() {
		it('should parse class constructor', function() {
			class Bar {}
			class Foo {
				constructor(/** Bar */bar) {
					this.bar = bar;
				}
			}

			var bar = new Bar(),
				foo = new Container()
					.registerInstance(bar, 'Bar')
					.registerType(Foo)
					.resolveSync('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.equal(bar);
		});

		it('should parse class without a constructor', function() {
			class Bar {}

			var bar = new Container()
				.registerType(Bar)
				.resolveSync(Bar);

			bar.should.be.instanceOf(Bar);
		});
	});

	describe('injection', function() {
		it('should perform injection without resolution key', function() {
			var injection = {
				injectSync: function(instance, container) {
					instance.injected = true;
				}
			};

			function Foo() {}

			var container = new Container().registerType(Foo, { injections: [ injection ] }),
				instance = new Foo();

			container.injectSync(instance);
			instance.should.have.property('injected', true);
		});

		it('should perform injection with resolution key', function() {
			var injection = {
				injectSync: function(instance, container) {
					instance.injected = true;
				}
			};

			function Foo() {}

			var container = new Container().registerType(Foo, { key: 'asdf', injections: [ injection ] }),
				instance = new Foo();

			container.injectSync(instance, 'asdf');
			instance.should.have.property('injected', true);
		});

		it('should throw if key is not registered', function() {
			(function() {
				new Container().injectSync({}, 'asdf');
			}).should.throwError('Nothing with key "asdf" is registered in the container');
		});
	});

	describe('async', function() {
		it('should raise error if type is not registered', function() {
			new Container().resolve('Foo', function(err) {
				err.should.be.instanceOf(Error);
				err.should.have.property('message', 'Nothing with key "Foo" is registered in the container');
			});
		});

		it('should resolve type with dependencies and emit events', function(done) {
			function Foo(/** Bar */bar) { this.bar = bar; }
			function Bar() {}

			var container = new Container();
			var eResolved = 0,
				resolving = 0,
				registering = 0;

			container.on('resolving', function() {
				resolving++;
			});
			container.on('resolved', function() {
				eResolved++;
			});
			container.on('registering', function() {
				registering++;
			});

			container
				.registerType(Foo)
				.registerType(Bar);

			container.resolve(Foo, function(err, resolved) {
				should.not.exist(err);
				resolved.should.be.instanceOf(Foo);
				resolved.should.have.property('bar');
				resolved.bar.should.be.instanceOf(Bar);
				registering.should.equal(2);
				eResolved.should.equal(2);
				resolving.should.equal(2);
				done();
			});
		});

		it('should use lifetime when resolving type', function(done) {
			var fetchCalled = false, storeCalled = false;
			var lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.be.instanceOf(Foo);
				}
			};

			function Foo() {}

			new Container()
				.registerType(Foo, { key: 'foo', lifetime: lifetime })
				.resolve('foo', function(err) {
					should.not.exist(err);
					fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
					storeCalled.should.equal(true, 'lifetime.store() should have been called');
					done();
				});
		});

		describe('registration from instance', function() {
			it('should register and resolve instance', function(done) {
				function Foo() {}

				var instance = new Foo(),
					container = new Container().registerInstance(instance);

				container.resolve(Foo, function(err, resolved) {
					should.not.exist(err);
					resolved.should.equal(instance);
					done();
				});
			});

			it('should register and resolve instance with specified key', function(done) {
				function Foo() {}

				var instance = new Foo(),
					container = new Container().registerInstance(instance, 'asdf');

				container.resolve('asdf', function(err, resolved) {
					should.not.exist(err);
					resolved.should.equal(instance);
					done();
				});
			});
		});

		it('should use lifetime when resolving instance', function(done) {
			var fetchCalled = false, storeCalled = false;
			var lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.equal('foo');
				}
			};

			new Container()
				.registerInstance('foo', { key: 'foo', lifetime: lifetime })
				.resolve('foo', function(err) {
					should.not.exist(err);
					fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
					storeCalled.should.equal(true, 'lifetime.store() should have been called');
					done();
				});
		});

		describe('registration from factory', function() {
			it('should register and resolve factory', function(done) {
				var instance = {},
					container = new Container()
						.registerFactory(function(container, callback) {
							callback(null, instance);
						}, { key: 'poopoo' });

				container.resolve('poopoo', function(err, resolved) {
					should.not.exist(err);
					resolved.should.equal(instance);
					done();
				});
			});

			it('should raise error during resolution', function(done) {
				var container = new Container()
						.registerFactory(function(container, callback) {
							callback('fail');
						}, { key: 'poopoo' });

				container.resolve('poopoo', function(err, resolved) {
					err.should.equal('fail');
					should.not.exist(resolved);
					done();
				});
			});
		});

		it('should use lifetime when resolving factory', function(done) {
			var fetchCalled = false, storeCalled = false;
			var lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.equal('foo');
				}
			};

			var factory = function(container, callback) {
				callback(null, 'foo');
			};
			new Container()
				.registerFactory(factory, { key: 'foo', lifetime: lifetime })
				.resolve('foo', function(err) {
					should.not.exist(err);
					fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
					storeCalled.should.equal(true, 'lifetime.store() should have been called');
					done();
				});
		});

		describe('injection', function() {
			it('should perform injection', function(done) {
				var injection = {
					inject: function(instance, container, callback) {
						instance.injected = true;
						callback();
					}
				};

				function Foo() { }

				var container = new Container().registerType(Foo, { injections: [ injection ] }),
					instance = new Foo();

				container.inject(instance, 'Foo', function(err) {
					should.not.exist(err);
					instance.should.have.property('injected', true);
					done();
				});
			});

			it('should raise error', function(done) {
				var injection = {
					inject: function(instance, container, callback) {
						callback('fail');
					}
				};

				function Foo() {}

				var container = new Container().registerType(Foo, { injections: [ injection ] }),
					instance = new Foo();

				container.inject(instance, 'Foo', function(err) {
					err.should.equal('fail');
					done();
				});
			});
		});
	});

	describe('child containers', function() {
		it('should inherit registrations from parent', function() {
			function Foo() {}
			var parent = new Container().registerType(Foo),
				child = parent.createChildContainer();

			child.resolveSync(Foo).should.be.instanceOf(Foo);

			parent.registerInstance({}, 'Bar');

			(function() { child.resolveSync('Bar'); })
				.should.throwError('Nothing with key "Bar" is registered in the container');
		});

		it('should not affect parent container\'s registrations', function() {
			function Foo() {}

			var parent = new Container().registerType(Foo),
				child = parent.createChildContainer();

			child.resolveSync(Foo).should.be.instanceOf(Foo);

			child.registerInstance({}, 'Bar');

			(function() { parent.resolveSync('Bar'); })
				.should.throwError('Nothing with key "Bar" is registered in the container');
		});

		it('should inherit dependency graph from parent', function() {
			function Bar(/** Baz */bar) {}
			function Baz(/** Bar */baz) {}

			var parent = new Container().registerType(Bar),
				child = parent.createChildContainer();

			(function() { child.registerType(Baz); })
				.should.throwError(/^Baz's dependencies create a cycle/);
		});

		it('should not affect parent\'s dependency graph', function() {
			function Bar(/** Baz */baz) {}
			function Baz() {}

			var parent = new Container().registerType(Bar),
				child = parent.createChildContainer()
					.registerType(Baz);

			(function() { parent.resolveSync(Bar); })
				.should.throwError(/^Nothing with key "Baz" is registered in the container/);
		});

		it('should set parent', function() {
			var parent = new Container();
			parent.createChildContainer().parent.should.equal(parent);
		});

		it('should inherit interception configurations from parent', function() {
			function Foo() {}
			Foo.prototype.bar = function() {};

			var handlerInvoked = false;
			function handler(context, next) {
				handlerInvoked = true;
				next();
			}

			var parent = new Container()
					.registerType(Foo)
					.intercept([ Foo, 'bar' ], handler).sync(),
				child = parent.createChildContainer();

			child.resolveSync(Foo).bar();
			handlerInvoked.should.equal(true);
		});

		it('should not affect parent\'s interception configurations', function() {
			function Foo() {}

			Foo.prototype.bar = function() {};
			Foo.prototype.baz = function() {};

			var handlerInvoked = false;

			function handler(context, next) {
				handlerInvoked = true;
				next();
			}

			var parent = new Container()
					.registerType(Foo)
					.intercept([ Foo, 'bar' ], function(_, next) { next(); }).sync(),
				child = parent.createChildContainer()
					.intercept([ Foo, 'baz' ], handler).sync();

			parent.resolveSync(Foo).baz();
			handlerInvoked.should.equal(false);
		});

		it('should inherit events from parent', function() {
			function Foo() {}
			var parent = new Container().registerType(Foo);
			var resolving = 0,
				building = 0;

			parent.on('resolving', function() {
				resolving++;
			});
			parent.builder.on('building', function() {
				building++;
			});

			var child = parent.createChildContainer();

			child.resolveSync(Foo);
			resolving.should.equal(0);
			building.should.equal(0);

			child = parent.createChildContainer(true);
			child.resolveSync(Foo);
			resolving.should.equal(1);
			building.should.equal(1);
		});
	});
});
