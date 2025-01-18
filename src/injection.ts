import {Container} from './container';
import {Constructor} from './types';
import * as util from './util';

export interface Injection<TType = unknown> {
	inject(object: TType, container: Container): Promise<void>;
	injectSync(object: TType, container: Container): void;
}

export class PropertyValueInjection<TType = unknown, TValue = unknown> implements Injection<TType> {
	public constructor(
		private readonly propertyName: keyof TType & string,
		private readonly value: TValue
	) {}

	public async inject(object: TType, container: Container) {
		this.injectSync(object, container);
	}

	public injectSync(object: TType, container: Container) {
		object[this.propertyName] = this.value as any;
	}
}

export class PropertyInjection<TType = unknown> implements Injection<TType> {
	public constructor(
		private readonly propertyName: keyof TType & string,
		private readonly valueKey: Constructor<TType> | string
	) {}

	public async inject(object: TType, container: Container): Promise<void> {
		object[this.propertyName] = await container.resolve(this.valueKey) as any;
	}

	public injectSync(object: TType, container: Container): void {
		object[this.propertyName] = container.resolveSync(this.valueKey) as any;
	}
}

export class MethodInjection<TType = unknown> implements Injection<TType> {
	public constructor(
		private readonly methodName: keyof TType & string,
		private readonly args?: any[] | null
	) {}

	private createError(): Error {
		return new Error(
			'Cannot perform method injection because the object does ' +
			`not have a method "${this.methodName}"`
		);
	}

	public async inject(object: TType, container: Container): Promise<void> {
		const method = object[this.methodName];
		if (!method || typeof(method) !== 'function') {
			throw this.createError();
		}

		const args = this.args || await Promise.all(
			util.getTypeInfo(method, '$__', 'method')
				.args
				.map(argInfo => container.resolve(argInfo.type))
		);

		method.call(object, ...args);
	}

	public injectSync(object: TType, container: Container): void {
		const method = object[this.methodName];
		if (!method || typeof(method) !== 'function') {
			throw this.createError();
		}

		const args = this.args || util.getTypeInfo(method, '$__', 'method')
			.args
			.map(argInfo => container.resolveSync(argInfo.type)
		);

		method.call(object, ...args);
	}
}
