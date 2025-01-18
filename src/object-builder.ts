import {ResolveContext} from './container';
import {EventEmitter} from './event-emitter';
import {BuilderEventMap, Resolvable, TypeInfo, TypeInfoArgument} from './types';

function getParams(typeInfo: TypeInfo): TypeInfoArgument[] {
	const params = typeInfo.args;
	params.sort(function(a, b) {
		if (a.position === b.position) {
			return 0;
		}

		return a.position < b.position ? -1 : 1;
	});

	return params;
}

const isConstructable = <T = unknown>(fn: Function, typeInfo: TypeInfo): fn is new(...args: any[]) => T => {
	return typeInfo.constructable;
};

export class ObjectBuilder extends EventEmitter<BuilderEventMap> {
	private readonly resolvable: Resolvable;

	public constructor(resolvable: Resolvable) {
		super();
		this.resolvable = resolvable;
	}

	private buildObject<T, TArgs extends any[] = unknown[]>(typeInfo: TypeInfo, args: TArgs): T {
		const ctor = typeInfo.ctor;
		if (isConstructable<T>(ctor, typeInfo)) {
			return new ctor(...args);
		}

		throw new Error(`Unable to construct class from type ${typeInfo.name}`);
	}

	public newInstanceSync<T>(typeInfo: TypeInfo, context: ResolveContext): T {
		this.emit('building', typeInfo);
		const args = getParams(typeInfo).map((typeData) => {
			return this.resolvable.resolveSync(typeData.type, context);
		});

		const instance = this.buildObject<T>(typeInfo, args);
		this.emit('built', typeInfo, instance);
		return instance;
	}

	public async newInstance<T>(typeInfo: TypeInfo, context: ResolveContext): Promise<T> {
		this.emit('building', typeInfo);

		const args: unknown[] = [];
		const params = getParams(typeInfo);

		// NOTE: these must be resolved in order
		for (const param of params) {
			args.push(await this.resolvable.resolve(param.type, context));
		}

		const instance = this.buildObject<T>(typeInfo, args);
		this.emit('built', typeInfo, instance);
		return instance;
	}
}
