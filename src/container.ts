import Graph from 'tarjan-graph';
import {EventEmitter} from './event-emitter';
import {Injection} from './injection';
import {Lifetime, TransientLifetime} from './lifetime';
import {ObjectBuilder} from './object-builder';
import {BuilderEvent, Constructor, ContainerEvent, ContainerEventMap, Resolvable, TypeInfo} from './types';
import * as utils from './util';

export interface ResolveHistoryItem {
	name: string;
}

export interface ResolveContext {
	history: ResolveHistoryItem[];
}

type RegistrationArgs = PartialOrNull<RegistrationOptions> | RegistrationOptions['key'];

const getHistoryString = (context: ResolveContext, current: string): string => {
	const history = context.history.concat([]);
	if (current) {
		history.push({ name: current });
	}

	return history.map(registration => `"${registration.name}"`).join(' -> ');
}

function getUnregisteredErrorMessage(key: string, context?: ResolveContext): string {
	let message = `Nothing with key "${key}" is registered in the container`;
	if (context && context.history.length) {
		message += '; error occurred while resolving ' + getHistoryString(context, key);
	}

	if (key.startsWith(utils.argPrefix)) {
		message += `; you may be missing a ` +
			`doc comment or a call to registerAliasAsArg`;
	}

	return message;
}

function createResolverContext(): ResolveContext {
	return {
		history: []
	};
}

export interface RegistrationOptions {
	key: string;
	lifetime: Lifetime;
	injections: Injection[];
	argAlias: string;
}

function resolveSignatureToOptions(keyOrOptions?: RegistrationArgs): Partial<RegistrationOptions> {
	const options: Partial<RegistrationOptions> = {};

	if (typeof(keyOrOptions) === 'string') {
		options.key = keyOrOptions;
	} else {
		options.key = keyOrOptions?.key || undefined;
		options.injections = keyOrOptions?.injections || [];
		options.lifetime = keyOrOptions?.lifetime || undefined;
		options.argAlias = keyOrOptions?.argAlias || undefined;
	}

	return options;
}

function getKeyFromCtor(ctor: Function):string {
	return ctor.name;
}
function getKeyFromInstance(instance: unknown): string | null {
	if (instance && typeof(instance) === 'object') {
		return getKeyFromCtor(instance.constructor);
	}
	return null;
}

type Optional<T> = T | undefined | null;

type PartialOrNull<T> = {
	[P in keyof T]?: T[P] | null;
};

export class Registration {
	public readonly name: string;
	public readonly lifetime: Lifetime;
	public readonly injections: Injection[];

	public constructor(name: string, lifetime: Optional<Lifetime>, injections: Optional<Injection[]>) {
		this.name = name;
		this.lifetime = lifetime || new TransientLifetime();
		this.injections = injections || [];
	}
}

export class TypeRegistration extends Registration {
	public readonly typeInfo: TypeInfo;

	public constructor(name: string, lifetime: Optional<Lifetime>, injections: Optional<Injection[]>, typeInfo: TypeInfo) {
		super(name, lifetime, injections);
		this.typeInfo = typeInfo;
	}
}

export class InstanceRegistration<T = unknown> extends Registration {
	public readonly instance: T;

	public constructor(name: string, lifetime: Optional<Lifetime>, injections: Optional<Injection[]>, instance: T) {
		super(name, lifetime, injections);
		this.instance = instance;
	}
}

export class FactoryRegistration<T = unknown> extends Registration {
	public readonly factory: (container: Container) => T;

	public constructor(name: string, lifetime: Optional<Lifetime>, injections: Optional<Injection[]>, factory: (container: Container) => T) {
		super(name, lifetime, injections);
		this.factory = factory;
	}
}

export class DelegateRegistration extends Registration {
	public readonly delegateKey: string;

	public constructor(alias: string, delegateKey: string) {
		super(alias, null, null);
		this.delegateKey = delegateKey;
	}
}

export class Container<TResolveMap extends Record<string, any> = Record<string, unknown>>
	extends EventEmitter<ContainerEventMap>
	implements Resolvable<TResolveMap> {
	public readonly parent: Container | null;
	private readonly registrations: { [key: string]: Registration };
	private graph: Graph;
	private readonly builder: ObjectBuilder;

	public constructor(parent?: Container) {
		super();
		this.parent = parent || null;
		this.registrations = {};
		this.graph = new Graph();
		this.builder = new ObjectBuilder(this);
		this.registerInstance(this);
	}

	private addDependencyToGraph(key: string, dependencies: string[]): void {
		try {
			this.graph.addAndVerify(key, dependencies);
		} catch (e) {
			throw new Error(`${key}'s dependencies create a cycle: ${e.message}`);
		}
	}

	public registerType<T>(ctor: Constructor<T>, options?: RegistrationArgs): this {
		const resolvedOptions = resolveSignatureToOptions(options);
		const typeInfo = utils.getTypeInfo(ctor, resolvedOptions.key);
		const key = typeInfo.name;

		this.emit('registering', key, 'type');

		this.registrations[key] = new TypeRegistration(key, resolvedOptions.lifetime, resolvedOptions.injections, typeInfo);
		if (resolvedOptions.argAlias) {
			this.registerArgAlias(key, resolvedOptions.argAlias);
		}

		this.addDependencyToGraph(key, typeInfo.args.map(info => info.type));

		return this;
	}

	public registerTypeAndArgAlias<T>(ctor: Constructor<T>, key?: string | null, alias?: string | null): this {
		if (typeof(alias) === 'undefined') {
			alias = key;
			key = null;
		}

		this.registerType(ctor, {
			key,
			argAlias: alias,
		});

		return this;
	}

	public registerAlias(key: string, alias: string): this {
		if (typeof(key) !== 'string') {
			throw new Error('key must be a string');
		}
		if (typeof(alias) !== 'string') {
			throw new Error('alias must be a string');
		}
		// this alias has a dependency on the thing it's aliasing
		this.graph.addAndVerify(alias, [ key ]);

		this.registrations[alias] = new DelegateRegistration(alias, key);
		return this;
	}

	public registerArgAlias(key: string, alias: string): this {
		return this.registerAlias(key, utils.argPrefix + alias);
	}

	/**
	 * Registers a specific object instance
	 */
	public registerInstance<T = unknown>(instance: T, options?: RegistrationArgs): this {
		const resolvedOptions = resolveSignatureToOptions(options);
		const key = resolvedOptions.key || getKeyFromInstance(instance);
		if (!key) {
			throw new Error('Key not provided while registering instance');
		}

		resolvedOptions.key = key;

		this.emit('registering', resolvedOptions.key, 'instance');

		this.registrations[resolvedOptions.key] = new InstanceRegistration(
			resolvedOptions.key,
			resolvedOptions.lifetime,
			resolvedOptions.injections,
			instance,
		);

		if (resolvedOptions.argAlias) {
			this.registerArgAlias(resolvedOptions.key, resolvedOptions.argAlias);
		}

		return this;
	}

	public registerInstanceAndArgAlias<T = unknown>(instance: T, key?: string | null, alias?: string | null): this {
		if (typeof(alias) === 'undefined') {
			alias = key;
			key = null;
		}

		this.registerInstance(instance, {
			key,
			argAlias: alias,
		});

		return this;
	}

	/**
	 * Registers a factory function for a type that will create
	 * the object
	 */
	public registerFactory<T = unknown>(factory: (container: Container) => T, options?: RegistrationArgs): this {
		const resolvedOptions = resolveSignatureToOptions(options);
		if (!resolvedOptions.key) {
			throw new Error('"options.key" must be passed to registerFactory()');
		}

		this.emit('registering', resolvedOptions.key, 'factory');

		this.registrations[resolvedOptions.key] = new FactoryRegistration(
			resolvedOptions.key,
			resolvedOptions.lifetime,
			resolvedOptions.injections,
			factory,
		);

		if (resolvedOptions.argAlias) {
			this.registerArgAlias(resolvedOptions.key, resolvedOptions.argAlias);
		}

		return this;
	}

	public registerFactoryAndArgAlias<T = unknown>(
		factory: (container: Container) => T,
		key: string,
		alias: string,
	): this {
		this.registerFactory(factory, {
			key,
			argAlias: alias,
		});

		return this;
	}

	/**
	 * Determines if something is registered with the given key
	 */
	public isRegistered(key: Constructor | string): boolean {
		const keyStr = typeof(key) === 'function' ? getKeyFromCtor(key) : key;
		return !!this.registrations[keyStr];
	}

	private resolveExisting(
		key: Constructor | symbol | number | string,
		context: ResolveContext,
	): [ unknown, string, Registration ] {
		const keyStr = typeof (key) === 'function' ? getKeyFromCtor(key) : String(key);


		const registration = this.registrations[keyStr];
		this.emit('resolving', keyStr);
		if (!registration) {
			throw new Error(getUnregisteredErrorMessage(keyStr, context));
		}

		const existing = registration.lifetime.fetch<any>();
		if (existing) {
			this.emit('resolved', keyStr, existing);
			return [ existing, keyStr, registration ];
		}

		context.history.push(registration);

		return [ undefined, keyStr, registration ];
	}

	/**
	 * Resolve a type to an instance synchronously
	 */
	public resolveSync<T = never, K extends keyof TResolveMap = never>(
		key: [T] extends [never] ? K : Constructor<T> | string,
		context?: ResolveContext,
	): [T] extends [never] ? TResolveMap[K] : T {
		context = context || createResolverContext();
		let [ existing, keyStr, registration ] = this.resolveExisting(key, context);

		if (existing) {
			return existing as any;
		}

		let instance: any;
		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
		} else if (registration instanceof TypeRegistration) {
			instance = this.builder.newInstanceSync(registration.typeInfo, context);
		} else if (registration instanceof FactoryRegistration) {
			instance = registration.factory(this);
		} else if (registration instanceof DelegateRegistration) {
			instance = this.resolveSync(registration.delegateKey, context);
		} else {
			throw new Error('Unknown registration: ' + registration.constructor.name);
		}

		context.history.pop();

		this.injectSync(instance, keyStr);
		registration.lifetime.store(instance);
		this.emit('resolved', keyStr, instance);
		return instance;
	}

	/**
	 * Resolve a type to an instance asynchronously
	 */
	public async resolve<T = never, K extends keyof TResolveMap = never>(
		key: [T] extends [never] ? K : Constructor<T> | string,
		context?: ResolveContext,
	): Promise<[T] extends [never] ? TResolveMap[K] : T> {
		context = context || createResolverContext();
		let [ existing, keyStr, registration ] = this.resolveExisting(key, context);

		if (existing) {
			return existing as any;
		}

		let instance;

		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
		} else if (registration instanceof TypeRegistration) {
			instance = await this.builder.newInstance(registration.typeInfo, context);
		} else if (registration instanceof FactoryRegistration) {
			instance = await registration.factory(this);
		} else if (registration instanceof DelegateRegistration) {
			instance = await this.resolve(registration.delegateKey, context);
		}

		context.history.pop();

		await this.inject(instance, keyStr);
		registration.lifetime.store(instance);
		this.emit('resolved', keyStr, instance);
		return instance;
	}

	/**
	 * Same as resolve(), but won't ever reject
	 */
	public async tryResolve<T = never, K extends keyof TResolveMap = never>(
		key: [T] extends [never] ? K : Constructor<T> | string,
	): Promise<([T] extends [never] ? TResolveMap[K] : T) | undefined> {
		try {
			return await this.resolve(key);
		} catch (e) {
			return;
		}
	}

	/**
	 * Same as resolveSync(), but won't ever throw
	 */
	public tryResolveSync<T = never, K extends keyof TResolveMap = never>(
		key: [T] extends [never] ? K : Constructor<T> | string,
	): ([T] extends [never] ? TResolveMap[K] : T) | undefined {
		try {
			return this.resolveSync(key);
		} catch (e) {
			return;
		}
	}

	/**
	 * Performs injection on an object asynchronously
	 */
	public async inject<T = unknown>(instance: T, key?: string): Promise<void> {
		const keyStr = key || getKeyFromInstance(instance);
		if (!keyStr) {
			throw new Error('Invalid registration key');
		}

		const registration = this.registrations[keyStr];
		if (!registration) {
			return Promise.reject(new Error(getUnregisteredErrorMessage(keyStr)));
		}

		await Promise.all(registration.injections.map(injection => injection.inject(instance, this)));
	}

	/**
	 * Performs injection on an object synchronously
	 */
	public injectSync<T = unknown>(instance: T, key?: string): void {
		const keyStr = key || getKeyFromInstance(instance);
		if (!keyStr) {
			throw new Error('Invalid registration key');
		}

		const registration = this.registrations[keyStr];
		if (!registration) {
			throw new Error(getUnregisteredErrorMessage(keyStr));
		}

		registration.injections.forEach(injection => injection.injectSync(instance, this));
	}

	/**
	 * Creates a clone of the container in its current state
	 */
	public createChildContainer(withEvents = false): Container<TResolveMap> {
		const childContainer = new Container<TResolveMap>(this);

		Object.keys(this.registrations).forEach((key) => {
			childContainer.registrations[key] = this.registrations[key];
		});
		childContainer.registerInstance(childContainer);

		childContainer.graph = this.graph.clone();

		if (withEvents) {
			const containerEvents: Record<ContainerEvent, 1> = {
				registering: 1,
				resolving: 1,
				resolved: 1,
			};

			Object.keys(containerEvents).forEach((event: ContainerEvent) => {
				this.listeners(event).forEach((listener) => {
					childContainer.on(event, listener);
				});
			});

			const builderEvents: Record<BuilderEvent, 1> = {
				building: 1,
				built: 1,
			};

			Object.keys(builderEvents).forEach((event: BuilderEvent) => {
				this.builder.listeners(event).forEach((listener) => {
					childContainer.builder.on(event, listener);
				});
			});
		}

		return childContainer;
	}
}
