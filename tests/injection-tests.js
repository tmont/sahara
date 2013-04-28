var should = require('should'),
	Container = require('../').Container,
	inject = require('../').inject;

describe('Injection', function() {
	it('should inject property with value', function() {
		function Foo() {
			this.name = null;
		}

		var container = new Container();
		container.registerType(Foo, { injections: [ inject.propertyValue('name', 'bar') ] });
		var instance = container.resolveSync('Foo');
		instance.should.be.instanceOf(Foo);
		instance.should.have.property('name', 'bar');
	});

	it('should inject property', function() {
		function Foo() {
			this.bar = null;
		}

		function Bar() {}

		var container = new Container()
			.registerType(Foo, { injections: [ inject.property('bar', 'Bar') ] })
			.registerType(Bar);

		var instance = container.resolveSync('Foo');
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
			.registerType(Foo, { injections: [ inject.method('method', [ 'bat', 'baz' ]) ] });

		var instance = container.resolveSync('Foo');
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
			.registerType(Foo, { injections: [ inject.method('method') ] })
			.registerType(Bar)
			.registerType(Baz);

		var instance = container.resolveSync('Foo');
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
		it('should inject property with value', function(done) {
			function Foo() {
				this.name = null;
			}

			var container = new Container();
			container.registerType(Foo, { injections: [ inject.propertyValue('name', 'bar') ] });
			container.resolve('Foo', function(err, resolved) {
				should.not.exist(err);
				resolved.should.be.instanceOf(Foo);
				resolved.should.have.property('name', 'bar');
				done();
			});
		});

		it('should inject property', function(done) {
			function Foo() {
				this.bar = null;
			}

			function Bar() {}

			var container = new Container()
				.registerType(Foo, { injections: [ inject.property('bar', 'Bar') ] })
				.registerType(Bar);

			container.resolve('Foo', function(err, resolved) {
				resolved.should.be.instanceOf(Foo);
				resolved.should.have.property('bar');
				resolved.bar.should.be.instanceOf(Bar);
				done();
			});
		});

		it('should inject method with args', function(done) {
			function Foo() {
				this.foo = this.bar = null;
				this.method = function(foo, bar) {
					this.foo = foo;
					this.bar = bar;
				};
			}

			var container = new Container()
				.registerType(Foo, { injections: [ inject.method('method', [ 'bat', 'baz' ]) ] });

			container.resolve('Foo', function(err, resolved) {
				resolved.should.be.instanceOf(Foo);
				resolved.should.have.property('foo', 'bat');
				resolved.should.have.property('bar', 'baz');
				done();
			});
		});

		it('should inject method', function(done) {
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
				.registerType(Foo, { injections: [ inject.method('method') ] })
				.registerType(Bar)
				.registerType(Baz);

			container.resolve(Foo, function(err, resolved) {
				resolved.should.be.instanceOf(Foo);
				resolved.bar.should.be.instanceOf(Bar);
				resolved.baz.should.be.instanceOf(Baz);
				done();
			});
		});

		it('should raise error if method does not exist', function(done) {
			function Foo() {}
			var message = 'Cannot perform method injection because the object does not have a method "asdf"';
			var container = new Container()
				.registerType(Foo, { injections: [ inject.method('asdf') ] });

			container.resolve(Foo, function(err) {
				err.should.be.instanceOf(Error);
				err.should.have.property('message', message);
				done();
			});
		});
	});
});