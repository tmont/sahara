'use strict';
var should = require('should'),
	sahara = require('../../'),
	Container = sahara.Container;

describe('Classes', function() {
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
