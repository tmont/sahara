const should = require('should');
const sahara = require('../../');
const Container = sahara.Container;
const { asyncTest, shouldReject } = require('../async-helpers');

describe('Container', () => {
	it('should throw if type is not registered', () => {
		(function() { new Container().resolveSync('Foo'); })
			.should
			.throwError('Nothing with key "Foo" is registered in the container');
	});

	it('should show pretty message for sync resolution errors', () => {
		function Foo(/** Baz */baz, /** Bar */bar) {}
		function Bar(/** Baz */baz, /** Bat */bat) {}
		function Baz() {}

		const container = new Container()
			.registerType(Foo)
			.registerType(Bar)
			.registerType(Baz);

		(function() { container.resolveSync(Foo); })
			.should
			.throwError('Nothing with key "Bat" is registered in the container; error occurred while resolving "Foo" -> "Bar" -> "Bat"');
	});

	it('should show pretty message for async resolution errors', asyncTest(async () => {
		function Foo(/** Baz */baz, /** Bar */bar) {}
		function Bar(/** Baz */baz, /** Bat */bat) {}
		function Baz() {}

		const container = new Container()
			.registerType(Foo)
			.registerType(Bar)
			.registerType(Baz);

		const expectedMessage = 'Nothing with key "Bat" is registered in the container; ' +
			'error occurred while resolving "Foo" -> "Bar" -> "Bat"';

		await shouldReject(container.resolve(Foo), expectedMessage);
	}));

	it('should not throw if key does not exist for tryResolveSync()', function() {
		(function() {
			const resolved = new Container().tryResolveSync('foo');
			should.strictEqual(resolved, undefined);
		}).should.not.throwError();
	});

	it('should register itself', function() {
		const container = new Container();
		container.resolveSync('Container').should.equal(container);
	});

	it('should determine if something is registered', function() {
		function foo() {}

		const container = new Container().registerType(foo);

		container.isRegistered('foo').should.equal(true);
		container.isRegistered(foo).should.equal(true);
		container.isRegistered('bar').should.equal(false);
	});

	describe('resolve signature shortcuts', function() {
		it('should resolve from constructor instead of key', function() {
			function Foo() {}

			const instance = new Foo();
			const resolved = new Container()
				.registerInstance(instance)
				.resolveSync(Foo);

			resolved.should.equal(instance);
		});

		it('should allow explicit key instead of options.key', function() {
			function Foo() {}

			const instance = new Foo();
			const resolved = new Container()
				.registerInstance(instance, 'asdf')
				.resolveSync('asdf');

			resolved.should.equal(instance);
		});

		it('should allow explicit lifetime instead of options.lifetime', function() {
			let fetchCalled = false, storeCalled = false;
			const lifetime = {
				store: function(value) {
					value.should.equal('foo');
					storeCalled = true;
				},
				fetch: function() {
					fetchCalled = true;
				}
			};

			const resolved = new Container()
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

			const injection1 = sahara.inject.propertyValue('foo', 'hello');
			const injection2 = sahara.inject.propertyValue('bar', 'world');

			const resolved = new Container()
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
			const instance = new Foo();
			const resolved = new Container()
				.registerInstance(instance)
				.resolveSync('Foo');

			resolved.should.equal(instance);
		});

		it('should register and resolve instance with specified key', function() {
			function Foo() {}
			const instance = new Foo();
			const resolved = new Container()
				.registerInstance(instance, { key: 'asdf' })
				.resolveSync('asdf');

			resolved.should.equal(instance);
		});

		it('should use lifetime', function() {
			let fetchCalled = false, storeCalled = false;
			const lifetime = {
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
			const instance = {};
			const resolved = new Container()
				.registerFactory(() => instance, { key: 'poopoo' })
				.resolveSync('poopoo');

			resolved.should.equal(instance);
		});

		it('should throw if key is not provided', function() {
			(function() { new Container().registerFactory(() => {}); })
				.should
				.throwError('"options.key" must be passed to registerFactory()');
		});

		it('should pass container into factory function', function() {
			const instance = {};
			const resolved = new Container()
				.registerFactory((container) => {
					should.exist(container);
					container.should.be.instanceOf(Container);
					return instance;
				}, { key: 'poopoo' })
				.resolveSync('poopoo');

			resolved.should.equal(instance);
		});

		it('should use lifetime', function() {
			let fetchCalled = false, storeCalled = false;
			const lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.equal('foo');
				}
			};

			new Container()
				.registerFactory(() => 'foo', { key: 'foo', lifetime: lifetime })
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
			const instance = new Container()
				.registerType(Foo, { key: 'Lolz' })
				.resolveSync('Lolz');

			instance.should.be.instanceOf(Foo);
		});

		it('should use specified key if anonymous function given', function() {
			const foo = function() {};
			const instance = new Container()
				.registerType(foo, { key: 'Lolz' })
				.resolveSync('Lolz');

			instance.should.be.instanceOf(foo);
		});

		it('should use doc comments to get parameter types', function() {
			function Bar() {}
			function Foo(/** Bar */bar) {
				this.bar = bar;
			}

			const bar = new Bar();
			const foo = new Container()
				.registerInstance(bar)
				.registerType(Foo)
				.resolveSync('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.be.equal(bar);

			// yarp
			function Foo2(/** Bar **/bar) {
				this.bar = bar;
			}

			const foo2 = new Container()
				.registerInstance(bar)
				.registerType(Foo2)
				.resolveSync('Foo2');

			foo2.should.be.instanceOf(Foo2);
			foo2.bar.should.be.equal(bar);
		});

		it('should handle non-alphanumeric characters in type definitions', function() {
			function Bar() {}

			function Foo(/** razzle-dazzle! */bar) {
				this.bar = bar;
			}

			const bar = new Bar();
			const foo = new Container()
				.registerInstance(bar, 'razzle-dazzle!')
				.registerType(Foo)
				.resolveSync('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.be.equal(bar);
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

			const bar = new Bar();
			const foo = new Container()
				.registerInstance(bar)
				.registerType(Foo)
				.resolveSync('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.equal(bar);
			foo.bar2.should.equal(bar);
		});

		it('should handle dangling commas', function() {
			function Bar() {}

			function Foo(/** Bar */bar, /** Bar */bar2,) {
				this.bar = bar;
				this.bar2 = bar2;
			}

			const bar = new Bar();
			const foo = new Container()
				.registerInstance(bar)
				.registerType(Foo)
				.resolveSync('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.equal(bar);
			foo.bar2.should.equal(bar);
		});

		it('should detect cyclic dependencies', function() {
			function Foo(/** Bar */bar) {}
			function Bar(/** Foo */foo) {}

			(function() { new Container().registerType(Foo).registerType(Bar); })
				.should.throwError(/^Bar's dependencies create a cycle/);
		});

		it('should use lifetime', function() {
			let fetchCalled = false, storeCalled = false;
			const lifetime = {
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

		describe('without doc comments', () => {
			it('should fail to resolve if doc comment is missing and no arg is registered', async function() {
				function Foo(bar) {
					this.bar = bar;
				}

				await new Container().registerType(Foo).resolve(Foo)
					.should.rejectedWith('Nothing with key "$arg:bar" is registered in the container; ' +
						'error occurred while resolving "Foo" -> "$arg:bar"; you may be missing a doc comment ' +
						'or a call to registerAliasAsArg');
			});

			it('should fail to resolveSync if doc comment is missing and no arg is registered', async function() {
				function Foo(bar) {
					this.bar = bar;
				}

				(function() { new Container().registerType(Foo).resolveSync(Foo); })
					.should.throwError('Nothing with key "$arg:bar" is registered in the container; ' +
						'error occurred while resolving "Foo" -> "$arg:bar"; you may be missing a doc comment ' +
						'or a call to registerAliasAsArg');
			});

			it('should resolveSync via named argument type without doc comment', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const container = new Container()
					.registerType(Foo)
					.registerType(Bar)
					.registerArgAlias('Bar', 'someNamedArg');

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.bar.hello.should.equal('world');
			});

			it('should resolve via named argument type without doc comment', async function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const container = new Container()
					.registerType(Foo)
					.registerType(Bar)
					.registerArgAlias('Bar', 'someNamedArg');

				const resolved = await container.resolve(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.bar.hello.should.equal('world');
			});

			it('should resolveSync via named argument instance without doc comment', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const barInstance = new Bar();

				const container = new Container()
					.registerType(Foo)
					.registerInstance(barInstance, 'bar')
					.registerArgAlias('bar', 'someNamedArg');

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.equal(barInstance);
			});

			it('should register instance and arg alias at same time', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const barInstance = new Bar();

				const container = new Container()
					.registerType(Foo)
					.registerInstanceAndArgAlias(barInstance, 'bar', 'someNamedArg');

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.equal(barInstance);
			});

			it('should resolveSync via named argument factory without doc comment', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const container = new Container()
					.registerType(Foo)
					.registerFactory(() => new Bar(), 'bar')
					.registerArgAlias('bar', 'someNamedArg');

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.bar.hello.should.equal('world');
			});

			it('should register factory and arg alias at the same time', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const container = new Container()
					.registerType(Foo)
					.registerFactoryAndArgAlias(() => new Bar(), 'bar', 'someNamedArg');

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.bar.hello.should.equal('world');
			});

			it('should register type and arg alias at the same time without explicit key', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const container = new Container()
					.registerType(Foo)
					.registerTypeAndArgAlias(Bar, 'someNamedArg');

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.bar.hello.should.equal('world');

				container.resolveSync(Bar).should.be.instanceOf(Bar);
			});

			it('should register type and arg alias with explicit key', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const container = new Container()
					.registerType(Foo)
					.registerTypeAndArgAlias(Bar, 'Barbie', 'someNamedArg');

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.bar.hello.should.equal('world');

				container.resolveSync('Barbie').should.be.instanceOf(Bar);
				container.isRegistered(Bar).should.equal(false);
			});

			it('should register type and arg alias via options param', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				function Bar() {
					this.hello = 'world';
				}

				const container = new Container()
					.registerType(Foo)
					.registerType(Bar, {
						argAlias: 'someNamedArg',
					});

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.bar.hello.should.equal('world');

				container.isRegistered(Bar).should.equal(true);
				container.resolveSync(Bar).should.be.instanceOf(Bar);
			});

			it('should register instance and arg alias via options param', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				const instance = {};
				const container = new Container()
					.registerType(Foo)
					.registerInstance(instance, {
						key: 'meh',
						argAlias: 'someNamedArg',
					});

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.equal(instance);

				container.resolveSync('meh').should.equal(instance);
			});

			it('should register factory and arg alias via options param', function() {
				function Foo(someNamedArg) {
					this.bar = someNamedArg;
				}

				const instance = {};
				const factory = () => instance;
				const container = new Container()
					.registerType(Foo)
					.registerFactory(factory, {
						key: 'meh',
						argAlias: 'someNamedArg',
					});

				const resolved = container.resolveSync(Foo);
				resolved.bar.should.equal(instance);

				container.resolveSync('meh').should.equal(instance);
			});
		});
	});

	describe('injection', function() {
		it('should perform injection without resolution key', function() {
			const injection = {
				injectSync: function(instance, container) {
					instance.injected = true;
				}
			};

			function Foo() {}

			const container = new Container().registerType(Foo, { injections: [ injection ] });
			const instance = new Foo();

			container.injectSync(instance);
			instance.should.have.property('injected', true);
		});

		it('should perform injection with resolution key', function() {
			const injection = {
				injectSync: function(instance, container) {
					instance.injected = true;
				}
			};

			function Foo() {}

			const container = new Container().registerType(Foo, { key: 'asdf', injections: [ injection ] });
			const instance = new Foo();

			container.injectSync(instance, 'asdf');
			instance.should.have.property('injected', true);
		});

		it('should throw if key is not registered', function() {
			(function() { new Container().injectSync({}, 'asdf');})
				.should.throwError('Nothing with key "asdf" is registered in the container');
		});
	});

	describe('async', function() {
		it('should raise error if type is not registered', asyncTest(async () => {
			await shouldReject(
				new Container().resolve('Foo'),
				'Nothing with key "Foo" is registered in the container'
			);
		}));

		it('should resolve type with dependencies and emit events', asyncTest(async () => {
			function Foo(/** Bar */bar) { this.bar = bar; }
			function Bar() {}

			const container = new Container();
			let eResolved = 0,
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

			const resolved = await container.resolve(Foo);
			resolved.should.be.instanceOf(Foo);
			resolved.should.have.property('bar');
			resolved.bar.should.be.instanceOf(Bar);
			registering.should.equal(2);
			eResolved.should.equal(2);
			resolving.should.equal(2);
		}));

		it('should use lifetime when resolving type', asyncTest(async () => {
			let fetchCalled = false, storeCalled = false;
			const lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.be.instanceOf(Foo);
				}
			};

			function Foo() {}

			await new Container().registerType(Foo, { key: 'foo', lifetime: lifetime }).resolve('foo');
			fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
			storeCalled.should.equal(true, 'lifetime.store() should have been called');
		}));

		it('should not throw if key does not exist for tryResolveSync()', asyncTest(async () => {
			const resolved = await new Container().tryResolve('foo');
			should.strictEqual(resolved, undefined);
		}));

		describe('registration from instance', function() {
			it('should register and resolve instance', asyncTest(async () => {
				function Foo() {}

				const instance = new Foo();
				const container = new Container().registerInstance(instance);

				const resolved = await container.resolve(Foo);
				resolved.should.equal(instance);
			}));

			it('should register and resolve instance with specified key', asyncTest(async () => {
				function Foo() {}

				const instance = new Foo();
				const container = new Container().registerInstance(instance, 'asdf');

				const resolved = await container.resolve('asdf');
				resolved.should.equal(instance);
			}));
		});

		it('should use lifetime when resolving instance', asyncTest(async () => {
			let fetchCalled = false, storeCalled = false;
			const lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.equal('foo');
				}
			};

			await new Container()
				.registerInstance('foo', { key: 'foo', lifetime: lifetime })
				.resolve('foo');

			fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
			storeCalled.should.equal(true, 'lifetime.store() should have been called');
		}));

		describe('registration from factory', function() {
			it('should register and resolve factory', asyncTest(async () => {
				const instance = {};
				const container = new Container()
					.registerFactory(() => Promise.resolve(instance), { key: 'poopoo' });

				const resolved = await container.resolve('poopoo');
				resolved.should.equal(instance);
			}));

			it('should raise error during resolution', asyncTest(async () => {
				const container = new Container()
					.registerFactory(() => Promise.reject(new Error('fail')), { key: 'poopoo' });

				await shouldReject(container.resolve('poopoo'), 'fail');
			}));
		});

		it('should use lifetime when resolving factory', asyncTest(async () => {
			let fetchCalled = false, storeCalled = false;
			const lifetime = {
				fetch: function() {
					fetchCalled = true;
				},
				store: function(value) {
					storeCalled = true;
					value.should.equal('foo');
				}
			};

			const factory = () => Promise.resolve('foo');

			await new Container()
				.registerFactory(factory, { key: 'foo', lifetime: lifetime })
				.resolve('foo');

			fetchCalled.should.equal(true, 'lifetime.fetch() should have been called');
			storeCalled.should.equal(true, 'lifetime.store() should have been called');
		}));

		describe('injection', function() {
			it('should perform injection', asyncTest(async () => {
				const injection = {
					inject: (instance) => {
						instance.injected = true;
					}
				};

				function Foo() { }

				const container = new Container().registerType(Foo, { injections: [ injection ] });
				const instance = new Foo();

				await container.inject(instance, 'Foo');
				instance.should.have.property('injected', true);
			}));

			it('should raise error', asyncTest(async () => {
				const injection = {
					inject: () => Promise.reject('fail')
				};

				function Foo() {}

				const container = new Container().registerType(Foo, { injections: [ injection ] });
				const instance = new Foo();

				await shouldReject(container.inject(instance, 'Foo'), 'fail');
			}));
		});
	});

	describe('child containers', function() {
		it('should inherit registrations from parent', function() {
			function Foo() {}
			const parent = new Container().registerType(Foo);
			const child = parent.createChildContainer();

			child.resolveSync(Foo).should.be.instanceOf(Foo);

			parent.registerInstance({}, 'Bar');

			(function() { child.resolveSync('Bar'); })
				.should.throwError('Nothing with key "Bar" is registered in the container');
		});

		it('should not affect parent container\'s registrations', function() {
			function Foo() {}

			const parent = new Container().registerType(Foo);
			const child = parent.createChildContainer();

			child.resolveSync(Foo).should.be.instanceOf(Foo);

			child.registerInstance({}, 'Bar');

			(function() { parent.resolveSync('Bar'); })
				.should.throwError('Nothing with key "Bar" is registered in the container');
		});

		it('should inherit dependency graph from parent', function() {
			function Bar(/** Baz */bar) {}
			function Baz(/** Bar */baz) {}

			const parent = new Container().registerType(Bar);
			const child = parent.createChildContainer();

			(function() { child.registerType(Baz); })
				.should.throwError(/^Baz's dependencies create a cycle/);
		});

		it('should not affect parent\'s dependency graph', function() {
			function Bar(/** Baz */baz) {}
			function Baz() {}

			const parent = new Container().registerType(Bar);
			parent.createChildContainer().registerType(Baz);

			(function() { parent.resolveSync(Bar); })
				.should.throwError(/^Nothing with key "Baz" is registered in the container/);
		});

		it('should set parent', function() {
			const parent = new Container();
			parent.createChildContainer().parent.should.equal(parent);
		});

		it('should set "Container" registration to child container', function() {
			const parent = new Container();
			const child = parent.createChildContainer();
			child.resolveSync('Container').should.equal(child);
		});

		it('should inherit events from parent', function() {
			function Foo() {}
			const parent = new Container().registerType(Foo);
			let resolving = 0,
				building = 0;

			parent.on('resolving', function() {
				resolving++;
			});
			parent.builder.on('building', function() {
				building++;
			});

			let child = parent.createChildContainer();

			child.resolveSync(Foo);
			resolving.should.equal(0);
			building.should.equal(0);

			child = parent.createChildContainer(true);
			child.resolveSync(Foo);
			resolving.should.equal(1);
			building.should.equal(1);
		});
	});

	describe('aliases', function() {
		it('should register and resolve alias', () => {
			const instance = {};
			const container = new Container()
				.registerInstance(instance, 'foo')
				.registerAlias('foo', 'alias');

			container.resolveSync('foo').should.equal(instance);
			container.resolveSync('alias').should.equal(instance);
		});

		it('should change the delegate for alias and retroactively resolve it correctly', () => {
			const instance = {};
			const instance2 = {};

			const container = new Container()
				.registerInstance(instance, 'foo')
				.registerAlias('foo', 'alias')
				.registerInstance(instance2, 'foo'); // re-register under same key

			instance.should.not.equal(instance2);

			container.resolveSync('alias').should.equal(instance2);
		});

		it('should propagate aliases to child containers', () => {
			const instance = {};
			const instance2 = {};

			instance.should.not.equal(instance2);

			const container = new Container()
				.registerInstance(instance, 'foo')
				.registerAlias('foo', 'alias');

			container.resolveSync('alias').should.equal(instance);

			const child = container.createChildContainer();

			child.resolveSync('alias').should.equal(instance);

			container.registerInstance(instance2, 'foo');
			container.resolveSync('alias').should.equal(instance2);
			child.resolveSync('alias').should.equal(instance);

			child.registerInstance(instance2, 'foo');
			child.resolveSync('alias').should.equal(instance2);
		});

		it('should require key to be a string', () => {
			class Foo {}
			(function() { new Container().registerAlias(Foo, 'bar'); })
				.should.throwError('key must be a string');
		});

		it('should require alias to be a string', () => {
			class Foo {}

			(function() { new Container().registerAlias('foo', Foo); })
				.should.throwError('alias must be a string');
		});

		it('should detect cycles resulting from aliases', () => {
			class Foo {
				constructor(/** alias1 */arg) {}
			}

			(function() { new Container()
				.registerInstance({}, 'foo')
				.registerAlias('foo', 'alias1')
				.registerType(Foo, 'foo');
			}).should.throwError('foo\'s dependencies create a cycle: Detected 1 cycle:\n  alias1 -> foo -> alias1');
		});
	});
});
