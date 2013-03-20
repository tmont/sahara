var should = require('should'),
	Container = require('../').Container,
	Inject = require('../').Inject;

describe('Injection', function() {
	it('should inject property with value', function() {
		function Foo() {
			this.name = null;
		}

		var container = new Container();
		container.registerType(Foo, { injections: [ new Inject.PropertyValue('name', 'bar') ] });
		var instance = container.resolve('Foo');
		instance.should.be.instanceOf(Foo);
		instance.should.have.property('name', 'bar');
	});

	it('should inject property', function() {
		function Foo() {
			this.bar = null;
		}

		function Bar() {}

		var container = new Container()
			.registerType(Foo, { injections: [ new Inject.Property('bar', 'Bar') ] })
			.registerType(Bar);

		var instance = container.resolve('Foo');
		instance.should.be.instanceOf(Foo);
		instance.should.have.property('bar');
		instance.bar.should.be.instanceOf(Bar);
	});

	it('should inject method with args', function() {
		function Foo() {
			this.foo = this.bar = null;
			this.method = function(foo, bar) {
				this.foo = foo;
				this.bar = bar;
			};
		}

		var container = new Container()
			.registerType(Foo, { injections: [ new Inject.Method('method', [ 'bat', 'baz' ]) ] });

		var instance = container.resolve('Foo');
		instance.should.be.instanceOf(Foo);
		instance.should.have.property('foo', 'bat');
		instance.should.have.property('bar', 'baz');
	});

	it('should inject method', function() {
		function Foo() {
			this.bar = this.baz = null;
			this.method = function(/** Bar */bar, /** Baz */baz) {
				this.bar = bar;
				this.baz = baz;
			};
		}

		function Bar() {}
		function Baz() {}

		var container = new Container()
			.registerType(Foo, { injections: [ new Inject.Method('method') ] })
			.registerType(Bar)
			.registerType(Baz);

		var instance = container.resolve('Foo');
		instance.should.be.instanceOf(Foo);
		instance.bar.should.be.instanceOf(Bar);
		instance.baz.should.be.instanceOf(Baz);
	});

	it('should throw if method does not exist', function() {
		function Foo() {}
		(function() {
			new Container()
				.registerType(Foo, { injections: [ new Inject.Method('asdf') ] })
				.resolve('Foo');
		}).should.throwError('Cannot perform method injection because the object does not have a method "asdf"');
	});
});