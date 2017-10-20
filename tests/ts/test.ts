import {Container, inject, lifetime, TypeInfo} from '../../';

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

class NotFoo {
	___yarp: string
}

const container = new Container();

container.on('registering', (name, type) => {
	switch (type) {
		case 'type':
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

container.registerInstance(new Foo());
container.resolveSync(Foo).myMethod(1, 2);
container.resolve(Foo).then((foo) => foo.myMethod(1, 2));

// foo might be undefined
container.tryResolve(Foo).then((foo) => foo && foo.myMethod(1, 2));
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

