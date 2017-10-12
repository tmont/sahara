const should = require('should');
const sahara = require('../../');
const Container = sahara.Container;
const inject = sahara.inject;
const { asyncTest, shouldReject } = require('../async-helpers');

describe('Injection', function() {
	it('should inject property with value', function() {
		function Foo() {
			this.name = null;
		}

		const container = new Container();
		container.registerType(Foo, { injections: [ inject.propertyValue('name', 'bar') ] });
		const instance = container.resolveSync('Foo');
		instance.should.be.instanceOf(Foo);
		instance.should.have.property('name', 'bar');
	});

	it('should inject property', function() {
		function Foo() {
			this.bar = null;
		}

		function Bar() {}

		const container = new Container()
			.registerType(Foo, { injections: [ inject.property('bar', 'Bar') ] })
			.registerType(Bar);

		const instance = container.resolveSync('Foo');
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

		const container = new Container()
			.registerType(Foo, { injections: [ inject.method('method', [ 'bat', 'baz' ]) ] });

		const instance = container.resolveSync('Foo');
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

		const container = new Container()
			.registerType(Foo, { injections: [ inject.method('method') ] })
			.registerType(Bar)
			.registerType(Baz);

		const instance = container.resolveSync('Foo');
		instance.should.be.instanceOf(Foo);
		instance.bar.should.be.instanceOf(Bar);
		instance.baz.should.be.instanceOf(Baz);
	});

	it('should throw if method does not exist', function() {
		function Foo() {}
		(function() {
			new Container()
				.registerType(Foo, { injections: [ inject.method('asdf') ] })
				.resolveSync('Foo');
		}).should.throwError('Cannot perform method injection because the object does not have a method "asdf"');
	});

	describe('async', function() {
		it('should inject property with value', asyncTest(async () => {
			function Foo() {
				this.name = null;
			}

			const container = new Container();
			container.registerType(Foo, { injections: [ inject.propertyValue('name', 'bar') ] });
			const resolved = await container.resolve('Foo');
			resolved.should.be.instanceOf(Foo);
			resolved.should.have.property('name', 'bar');
		}));

		it('should inject property', asyncTest(async () => {
			function Foo() {
				this.bar = null;
			}

			function Bar() {}

			const container = new Container()
				.registerType(Foo, { injections: [ inject.property('bar', 'Bar') ] })
				.registerType(Bar);

			const resolved = await container.resolve('Foo');
			resolved.should.have.property('bar');
			resolved.bar.should.be.instanceOf(Bar);
		}));

		it('should inject method with args', asyncTest(async () => {
			function Foo() {
				this.foo = this.bar = null;
				this.method = function(foo, bar) {
					this.foo = foo;
					this.bar = bar;
				};
			}

			const container = new Container()
				.registerType(Foo, { injections: [ inject.method('method', [ 'bat', 'baz' ]) ] });

			const resolved = await container.resolve('Foo');
			resolved.should.be.instanceOf(Foo);
			resolved.should.have.property('foo', 'bat');
			resolved.should.have.property('bar', 'baz');
		}));

		it('should inject method', asyncTest(async () => {
			function Foo() {
				this.bar = this.baz = null;
				this.method = function(/** Bar */bar, /** Baz */baz) {
					this.bar = bar;
					this.baz = baz;
				};
			}

			function Bar() {}
			function Baz() {}

			const container = new Container()
				.registerType(Foo, { injections: [ inject.method('method') ] })
				.registerType(Bar)
				.registerType(Baz);

			const resolved = await container.resolve(Foo);
			resolved.should.be.instanceOf(Foo);
			resolved.bar.should.be.instanceOf(Bar);
			resolved.baz.should.be.instanceOf(Baz);
		}));

		it('should raise error if method does not exist', asyncTest(async () => {
			function Foo() {}
			const message = 'Cannot perform method injection because the object does not have a method "asdf"';
			const container = new Container()
				.registerType(Foo, { injections: [ inject.method('asdf') ] });

			await shouldReject(container.resolve(Foo), message);
		}));
	});
});
