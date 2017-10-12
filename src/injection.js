const util = require('./util');

class Injection {
	constructor(name, value) {
		this.name = name;
		this.value = value;
	}

	async inject(object, container) {
		this.injectSync(object, container);
	}

	injectSync(object, container) {
		throw new Error('Not implemented');
	}
}

class PropertyValueInjection extends Injection {
	injectSync(object, container) {
		object[this.name] = this.value;
	}
}

class PropertyInjection extends Injection {
	async inject(object, container) {
		object[this.name] = await container.resolve(this.value);
	}

	injectSync(object, container) {
		object[this.name] = container.resolveSync(this.value);
	}
}

class MethodInjection extends Injection {
	createError() {
		return new Error(
			'Cannot perform method injection because the object does ' +
			`not have a method "${this.name}"`
		);
	}

	async inject(object, container) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			return Promise.reject(this.createError());
		}

		const args = this.value || await Promise.all(
			util.getTypeInfo(object[this.name], this.name)
				.args
				.map(argInfo => container.resolve(argInfo.type))
		);

		object[this.name](...args);
	}

	injectSync(object, container) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			throw this.createError();
		}

		const args = this.value || util.getTypeInfo(object[this.name], this.name)
			.args
			.map(argInfo => container.resolveSync(argInfo.type)
		);

		object[this.name](...args);
	}
}

module.exports = {
	Property: PropertyInjection,
	PropertyValue: PropertyValueInjection,
	Method: MethodInjection
};
