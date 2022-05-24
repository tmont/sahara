import Graph from 'tarjan-graph';

type RequiredKeyRegistrationOptions<T> = Partial<RegistrationOptions<T>> & Pick<RegistrationOptions<T>, 'key'>
type Factory<T> = (container: Container) => T | Promise<T>;
type ResolutionKey<T = {}> = string | { new(...args: any[]): T };
type EventListener = (...args: any[]) => void;
type RegistrationType = 'type' | 'factory' | 'instance'
type Resolver<T> = (key: ResolutionKey<T>, context?: ResolutionContext) => Promise<T>;
type ResolverSync<T> = (key: ResolutionKey<T>, context?: ResolutionContext) => T;
type RegisteringEvent = 'registering'
type RegisteringEventListener = (key: string, type: RegistrationType) => void;
type ResolvedEvent = 'resolved'
type ResolvedEventListener = (key: string, instance: any) => void;
type ResolvingEvent = 'resolving'
type ResolvingEventListener = (key: string) => void;
type BuildingEvent = 'building'
type BuildingEventListener = (typeInfo: TypeInfo) => void;
type BuiltEvent = 'built'
type BuiltEventListener = (typeInfo: TypeInfo, instance: any) => void;

export interface RegistrationOptions<T> {
	key: string;
	lifetime: Lifetime;
	injections: Injection<T>[];
	argAlias: string;
}

export interface Registration<T> {
	readonly name: string;
	readonly lifetime: Lifetime;
	readonly injections: Injection<T>[];
}

interface ResolutionContext {
	readonly history: Registration<any>[];
}

declare class EventEmitter {
	listeners(name: string): EventListener[];
	on(name: string, listener: EventListener): void;
	off(name: string, listener: EventListener): void;
	emit(name: string, ...args: any[]): void;
}

declare class Container<TMapping extends Record<string, any> = {}> extends EventEmitter {
	readonly parent: Container | null;
	readonly builder: ObjectBuilder;
	readonly graph: Graph;
	readonly registrations: { [key: string]: Registration<any> };

	constructor(parent?: Container);

	registerType<T>(ctor: new(...args: any[]) => T, key?: string, lifetime?: Lifetime, injections?: Injection<T>[]): Container;
	registerType<T>(ctor: new(...args: any[]) => T, options?: Partial<RegistrationOptions<T>>): Container;
	registerTypeAndArgAlias<T>(ctor: new(...args: any[]) => T, alias: string): Container;
	registerTypeAndArgAlias<T>(ctor: new(...args: any[]) => T, key: string | null, alias: string): Container;

	registerInstance<T>(instance: T, key?: string, lifetime?: Lifetime, injections?: Injection<T>[]): Container;
	registerInstance<T>(instance: T, options?: Partial<RegistrationOptions<T>>): Container;
	registerInstanceAndArgAlias<T>(instance: T, alias: string): Container;
	registerInstanceAndArgAlias<T>(instance: T, key: string | null, alias: string): Container;

	registerFactory<T>(factory: Factory<T>, key: string, lifetime?: Lifetime, injections?: Injection<T>[]): Container;
	registerFactory<T>(factory: Factory<T>, options: RequiredKeyRegistrationOptions<T>): Container;
	registerFactoryAndArgAlias<T>(factory: Factory<T>, key: string, alias: string): Container;

	registerAlias(key: string, alias: string): Container;
	registerArgAlias(key: string, alias: string): Container;

	isRegistered<T>(key: ResolutionKey<T>): boolean;

	resolve<K extends keyof TMapping>(key: K, context?: ResolutionContext): Promise<TMapping[K]>;
	resolveSync<K extends keyof TMapping>(key: K, context?: ResolutionContext): TMapping[K];

	tryResolve<K extends keyof TMapping>(key: K, context?: ResolutionContext): Promise<TMapping[K] | undefined>;
	tryResolveSync<K extends keyof TMapping>(key: K, context?: ResolutionContext): TMapping[K] | undefined;

	resolve<T>(key: ResolutionKey<T>, context?: ResolutionContext): Promise<T>;
	resolveSync<T>(key: ResolutionKey<T>, context?: ResolutionContext): T;

	tryResolve<T>(key: ResolutionKey<T>): Promise<T | undefined>;
	tryResolveSync<T>(key: ResolutionKey<T>): T | undefined;

	inject<T>(instance: T, key: string): Promise<void>;
	injectSync<T>(instance: T, key: string): void;

	createChildContainer(withEvents?: boolean): Container;

	on(name: RegisteringEvent, listener: RegisteringEventListener): void;
	on(name: ResolvingEvent, listener: ResolvingEventListener): void;
	on(name: ResolvedEvent, listener: ResolvedEventListener): void;

	off(name: RegisteringEvent, listener: RegisteringEventListener): void;
	off(name: ResolvingEvent, listener: ResolvingEventListener): void;
	off(name: ResolvedEvent, listener: ResolvedEventListener): void;

	listeners(name: RegisteringEvent | ResolvingEvent | ResolvedEvent): EventListener[];
	emit(name: RegisteringEvent | ResolvingEvent | ResolvedEvent, ...args: any[]): void;
}

declare abstract class Injection<T> {
	inject(object: T, container: Container): Promise<void>;
	injectSync(object: T, container: Container): void;
}

declare class PropertyValueInjection<T> extends Injection<T> {}
declare class PropertyInjection<T> extends Injection<T> {}
declare class MethodInjection<T> extends Injection<T> {}

declare abstract class Lifetime {
	fetch<T>(): T | null;
	store<T>(value: T): void;
}

declare class MemoryLifetime extends Lifetime {}
declare class TransientLifetime extends Lifetime {}

interface TypeInfo<T = {}> {
	args: Array<{ position: number, type: string, name: string }>;
	ctor: new(...args: any[]) => T;
	name: string;
}

declare class ObjectBuilder extends EventEmitter {
	constructor(resolver: Resolver<any>, resolverSync: ResolverSync<any>);
	newInstance<T>(typeInfo: TypeInfo<T>, context?: ResolutionContext): Promise<T>;
	newInstanceSync<T>(typeInfo: TypeInfo<T>, context?: ResolutionContext): T;

	on(name: BuildingEvent, listener: BuildingEventListener): void;
	on(name: BuiltEvent, listener: BuiltEventListener): void;
	off(name: BuildingEvent, listener: BuildingEventListener): void;
	listeners(name: BuildingEvent | BuiltEvent): EventListener[];
	emit(name: BuildingEvent | BuiltEvent, ...args: any[]): void;
}

export namespace inject {
	function propertyValue<T>(propertyName: keyof T, value: any): PropertyValueInjection<T>;
	function property<T>(propertyName: keyof T, key: ResolutionKey<T>): PropertyInjection<T>;
	function method<T>(methodName: keyof T, args?: any[]): MethodInjection<T>;
}

export namespace lifetime {
	function transient(): TransientLifetime;
	function memory(): MemoryLifetime;
}

export {
	Container,
	ObjectBuilder,
	TypeInfo,
}
