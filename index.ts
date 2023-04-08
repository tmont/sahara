import {MethodInjection, PropertyInjection, PropertyValueInjection} from './src/injection';
import {MemoryLifetime, TransientLifetime} from './src/lifetime';
import {Constructor} from './src/types';

export * from './src/container';
export * from './src/object-builder';
export * from './src/types';
export * from './src/lifetime';
export * from './src/injection';

export const inject = {
	propertyValue: <TType = unknown>(propertyName: keyof TType & string, value: unknown) =>
		new PropertyValueInjection<TType>(propertyName, value),
	property: <T = unknown>(propertyName: keyof T & string, valueKey: Constructor<T> | string) =>
		new PropertyInjection<T>(propertyName, valueKey),
	method: <T = unknown>(methodName: keyof T & string, args?: unknown[] | null) =>
		new MethodInjection<T>(methodName, args),
};

export const lifetime = {
	transient: () => new TransientLifetime(),
	memory: () => new MemoryLifetime()
};
