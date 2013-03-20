var should = require('should'),
	Container = require('../').Container;

describe('Container', function() {
	it('should register and resolve instance', function() {
		function Foo() {}
		var container = new Container(),
			instance = new Foo();

		var resolved = container
			.registerInstance('Foo', instance)
			.resolve('Foo');

		resolved.should.equal(instance);
	});

	it('should throw if instance not given to registerInstance()', function() {
		(function() { new Container().registerInstance('Foo'); }).should
			.throwError('No instance given');
	});

	it('should throw if type is not registered', function() {
		(function() { new Container().resolve('Foo'); }).should
			.throwError('The type "Foo" is not registered in the container');
	});

	describe('registration from function definition', function() {
		it('should require name if named function not given', function() {
			var foo = function() {},
				message = '"name" must be given if a named function is not';
			(function() { new Container().registerType(foo); }).should.throwError(message);
		});

		it('should use name from named function', function() {
			function Foo() {}
			var container = new Container();
			container.registerType(Foo);

			var instance = container.resolve('Foo');
			instance.should.be.instanceOf(Foo);
		});

		it('should use specified name if anonymous function given', function() {
			var foo = function() {};
			var container = new Container();
			container.registerType(foo, 'Lolz');

			var instance = container.resolve('Lolz');
			instance.should.be.instanceOf(foo);
		});

		it('should not use specified name if named function given', function() {
			function Foo() {}
			var container = new Container();
			container.registerType(Foo, 'Lolz');

			container.resolve('Foo').should.be.instanceOf(Foo);
			(function() { container.resolve('Lolz'); }).should
				.throwError('The type "Lolz" is not registered in the container');
		});

		it('should use doc comments to get parameter types', function() {
			function Bar() {}
			function Foo(/** Bar */bar) {
				this.bar = bar;
			}

			var container = new Container(),
				bar = new Bar();

			container.registerInstance('Bar', bar);
			container.registerType(Foo);

			var foo = container.resolve('Foo');
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
});