require('should');
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

	it('should parse anonymous class with "name" property set', function() {
		const Foo = class {
			constructor(hello) {
				this.hello = hello;
			}
		};

		Object.defineProperty(Foo, 'name', {
			value: 'ActualNameOfClass',
		});

		const container = new Container().registerInstanceAndArgAlias('world', 'hello', 'hello');
		container.registerType(Foo);

		container.resolveSync(Foo).should.be.instanceOf(Foo);
		container.resolveSync('ActualNameOfClass').should.be.instanceOf(Foo);
	});

	it('should parse anonymous class without explicit "name"', function() {
		const Foo = class {
			constructor(hello) {
				this.hello = hello;
			}
		};

		const Bar = class {
			constructor(hello) {
				this.hello = hello;
			}
		};

		const container = new Container()
			.registerInstanceAndArgAlias('world', 'hello', 'hello')
			.registerType(Foo)
			.registerType(Bar);

		container.resolveSync(Foo).should.be.instanceOf(Foo);
		container.resolveSync('Foo').should.be.instanceOf(Foo);
		container.resolveSync(Bar).should.be.instanceOf(Bar);
		container.resolveSync('Bar').should.be.instanceOf(Bar);
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
