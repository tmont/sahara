import {ResolveContext} from './container';

export type RegisteringEventType = 'type' | 'instance' | 'factory';

export type ContainerEventMap = {
	registering: [ string, RegisteringEventType ];
	resolving: [ string ];
	resolved: [ string, unknown ];
};

export type ContainerEvent = keyof ContainerEventMap;

export type BuilderEventMap = {
	building: [ TypeInfo ];
	built: [ TypeInfo, unknown ];
};

export type BuilderEvent = keyof BuilderEventMap;

export interface Resolvable<TResolveMap extends Record<string, unknown> = Record<string, unknown>> {
	resolve<T = never, K extends keyof TResolveMap = never>(
		key: [T] extends [never] ? K : Constructor<T> | string,
		context?: ResolveContext,
	): Promise<[T] extends [never] ? TResolveMap[K] : T>;

	resolveSync<T = never, K extends keyof TResolveMap = never>(
		key: [T] extends [never] ? K : Constructor<T> | string,
		context?: ResolveContext,
	): [T] extends [never] ? TResolveMap[K] : T;
}

export type Constructor<T = unknown> = new (...args: any[]) => T;

export type TypeInfoParseType = 'arg' | 'doc-comment';

export interface TypeInfoArgument {
	position: number;
	type: string;
	name: string;
	parsedAs: TypeInfoParseType;
}

export interface TypeInfo {
	args: TypeInfoArgument[];
	ctor: Function;
	name: string;
	constructable: boolean;
}
