const should = require('should');
const sahara = require('../../');
const Container = sahara.Container;

describe('Classes', function() {
	it('should parse class constructor', function() {
		class Bar {}
		class Foo {
			constructor(/** Bar */bar) {
				this.bar = bar;
			}
		}

		const bar = new Bar();
		const foo = new Container()
			.registerInstance(bar, 'Bar')
			.registerType(Foo)
			.resolveSync('Foo');

		foo.should.be.instanceOf(Foo);
		foo.bar.should.equal(bar);
	});

	it('should parse class constructor with dangling comma and weird whitespace', function() {
		class Bar {}

		class Foo {
			constructor(
				/** Bar */
				bar,
				) {
				this.bar = bar;
			}
		}

		const bar = new Bar();
		const foo = new Container()
			.registerInstance(bar, 'Bar')
			.registerType(Foo)
			.resolveSync('Foo');

		foo.should.be.instanceOf(Foo);
		foo.bar.should.equal(bar);
	});

	it('should parse class without a constructor', function() {
		class Bar {}

		const bar = new Container()
			.registerType(Bar)
			.resolveSync(Bar);

		bar.should.be.instanceOf(Bar);
	});

	it('should inject class method', function() {
		class Foo {
			constructor() {
				this.value = 'lol';
			}

			bar(/** Bar */value) {
				this.value = value;
			}
		}

		const foo = new Container()
			.registerType(Foo, {
				injections: [
					sahara.inject.method('bar')
				]
			})
			.registerInstance('oh hai mark', 'Bar')
			.resolveSync(Foo);

		foo.value.should.equal('oh hai mark');
	});

	it('should inject class method with dangling comma and weird whitespace', function() {
		class Foo {
			constructor() {
				this.value = 'lol';
			}

			bar(/** Bar */value,
				) {
				this.value = value;
			}
		}

		const foo = new Container()
			.registerType(Foo, {
				injections: [
					sahara.inject.method('bar')
				]
			})
			.registerInstance('oh hai mark', 'Bar')
			.resolveSync(Foo);

		foo.value.should.equal('oh hai mark');
	});
});
