var should = require('should'),
	Container = require('../').Container;

describe('Container', function() {

	it('should resolve from constructor instead of key', function() {
		function Foo() {}

		var instance = new Foo(),
			resolved = new Container()
				.registerInstance(instance)
				.resolve(Foo);

		resolved.should.equal(instance);
	});

	it('should resolve from key', function() {
		function Foo() {}

		var instance = new Foo(),
			resolved = new Container()
				.registerInstance(instance)
				.resolve('Foo');

		resolved.should.equal(instance);
	});

	it('should throw if type is not registered', function() {
		(function() { new Container().resolve('Foo'); })
			.should
			.throwError('Nothing with key "Foo" is registered in the container');
	});

	describe('registration from instance', function() {
		it('should register and resolve instance', function() {
			function Foo() {}
			var instance = new Foo(),
				resolved = new Container()
					.registerInstance(instance)
					.resolve('Foo');

			resolved.should.equal(instance);
		});

		it('should register and resolve instance with specified key', function() {
			function Foo() {}
			var instance = new Foo(),
				resolved = new Container()
					.registerInstance(instance, { key: 'asdf' })
					.resolve('asdf');

			resolved.should.equal(instance);
		});
	});

	describe('registration from function definition', function() {
		it('should require specified key if named function not given', function() {
			(function() { new Container().registerType(function() {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
		});

		it('should use specified key even if named function given', function() {
			function Foo() {}
			var instance = new Container()
				.registerType(Foo, { key: 'Lolz' })
				.resolve('Lolz');

			instance.should.be.instanceOf(Foo);
		});

		it('should use specified key if anonymous function given', function() {
			var foo = function() {};
			var instance = new Container()
				.registerType(foo, { key: 'Lolz' })
				.resolve('Lolz');

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
					.resolve('Foo');

			foo.should.be.instanceOf(Foo);
			foo.bar.should.be.equal(bar);
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
			}).should.throwError('Cyclic dependency from Foo to Bar');
		})
	});

	describe('injection', function() {
		it('should use perform injection without resolution key', function() {
			var injection = {
				inject: function(instance, container) {
					instance.injected = true;
				}
			};

			function Foo() {}

			var container = new Container().registerType(Foo, { injections: [ injection ] }),
				instance = new Foo();

			container.inject(instance);
			instance.should.have.property('injected', true);
		});

		it('should use perform injection with resolution key', function() {
			var injection = {
				inject: function(instance, container) {
					instance.injected = true;
				}
			};

			function Foo() {}

			var container = new Container().registerType(Foo, { key: 'asdf', injections: [ injection ] }),
				instance = new Foo();

			container.inject(instance, 'asdf');
			instance.should.have.property('injected', true);
		});

		it('should throw if key is not registered', function() {
			(function() {
				new Container().inject({}, 'asdf');
			}).should.throwError('Nothing with key "asdf" is registered in the container');
		});
	});
});