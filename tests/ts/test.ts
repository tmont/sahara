import {Container, inject, lifetime, Registration, TypeInfo} from '../../';

interface IFoo {
	bar: string
	myMethod: (x: number, y: number) => string[]
}

class Foo {
	/**
	 * The variable "var" is significant to us all.
	 * @type {string}
	 */
	public bar: string = 'lol';

	public myMethod(x: number, y: number): string[] {
		return [];
	}
}

class MultipleArgConstructor {
	constructor(foo: any, bar: any, baz: any) {}

	public yargs: string = 'yello';
}

class NotFoo {
	___yarp: string
}

const container = new Container();

container.on('registering', (name, type) => {
	switch (type) {
		case 'type':
		case 'factory':
		case 'instance':
			break;
		default:
			const x: never = type;
			break;

	}
});
container.on('resolved', (name, instance) => {

});

const resolvingListener = (key: string) => {};
container.on('resolving', resolvingListener);
container.off('resolving', resolvingListener);

container.builder.on('built', (typeInfo, instance) => {
	const f = new typeInfo.ctor();
});
container.builder.on('building', (typeInfo) => {
	const f = new typeInfo.ctor();
});

const typeInfo: TypeInfo<Foo> = {
	ctor: Foo,
	args: [],
	name: 'Foo'
};

container.builder.newInstance(typeInfo)
	.then((instance) => {
		instance.myMethod(1, 2);
	});
container.builder.newInstanceSync(typeInfo);

const methodInjection = inject.method<Foo>('myMethod');
const propVal = inject.propertyValue<Foo>('bar', 12);
const prop = inject.property<Foo>('bar', 'Hello');

const memoryLifetime = lifetime.memory();
memoryLifetime.store('hello');
const value1 = memoryLifetime.fetch<string>();
const value2 = memoryLifetime.fetch();
const transientLifetime = lifetime.transient();
transientLifetime.store(null);
transientLifetime.fetch();

container.registerType(Foo, 'foo');
container.resolve(Foo)
	.then(foo => foo.bar);

container.registerType(MultipleArgConstructor, 'yargs');
console.log(container.resolveSync<MultipleArgConstructor>('yargs').yargs === 'yello');

container.registerInstance(new Foo());
container.resolveSync(Foo).myMethod(1, 2);
container.resolve(Foo).then((foo) => foo.myMethod(1, 2));

// foo might be undefined
container.tryResolve(Foo).then((foo) => {
	foo && foo.myMethod(1, 2);
});
const tryResolveSync = container.tryResolveSync(Foo);
tryResolveSync && tryResolveSync.myMethod(1, 2);

const child = container.createChildContainer();
child.resolveSync(Foo);
container.createChildContainer(true);

container.injectSync(new Foo(), 'foo');
container.inject(new Foo(), 'foo').then(() => {});
container.isRegistered(Foo);
container.isRegistered('foo');

container.emit('registering');
container.emit('resolving');
container.emit('resolved');
container.builder.emit('building');
container.builder.emit('built');

container.registerFactory(container => new Foo(), 'asdf');

// argument aliases
container
	.registerFactory(() => new Foo(), 'foo')
	.registerAlias('foo', 'other-foo')
	.registerArgAlias('foo', 'other-foo');

// custom lifetime
const myLifetime = {
	fetch: () => { return null; },
	store: (value: any) => {}
};

container.registerType(Foo, { lifetime: myLifetime });

// factory requires key param
const myFactory = (container: Container) => 'hello world';
container.registerFactory(myFactory, 'yarp');
container.registerFactory(myFactory, { key: 'yarp' });

// container with mapping
interface ResolutionMap {
	customName: Foo;
	otherName: NotFoo;
}

const mappedContainer = new Container<ResolutionMap>();
const foo = mappedContainer.resolveSync('customName');
foo.myMethod(1, 2);
mappedContainer.resolve('otherName')
	.then((notFoo) => {
		console.log(notFoo.___yarp);
	});

console.log(mappedContainer.tryResolveSync('customName')?.myMethod(1, 2));

