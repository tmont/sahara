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

export interface Resolvable {
	resolve<T>(name: string, context: unknown): Promise<T>;
	resolveSync<T>(name: string, context: unknown): T;
}

export type Constructor<T = unknown> = new (...args: any[]) => T;

export type TypeInfoParseType = 'arg' | 'doc-comment';

export interface TypeInfoArgument {
	position: number;
	type: string;
	name: string;
	parsedAs: TypeInfoParseType;
}

export interface TypeInfo<T = any> {
	args: TypeInfoArgument[];
	ctor: Function;
	name: string;
	constructable: boolean;
}
