const util = require('./util');
const async = require('./async');

class PropertyValueInjection {
	constructor(name, value) {
		this.name = name;
		this.value = value;
	}

	injectSync(object, container) {
		object[this.name] = this.value;
	}

	inject(object, container, callback) {
		this.injectSync(object, container);
		callback && callback();
	}
}

class PropertyInjection {
	constructor(name, key) {
		this.name = name;
		this.key = key;
	}

	injectSync(object, container) {
		object[this.name] = container.resolveSync(this.key);
	}

	inject(object, container, callback) {
		const name = this.name;
		container.resolve(this.key, (err, instance) => {
			if (err) {
				callback(err);
				return;
			}

			object[name] = instance;
			callback();
		});
	}
}

class MethodInjection {
	constructor(name, args) {
		this.name = name;
		this.args = args;
	}

	createError() {
		return new Error(
			'Cannot perform method injection because the object does ' +
				`not have a method "${this.name}"`
		);
	}

	injectSync(object, container) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			throw this.createError();
		}

		let args = this.args;
		const name = this.name;
		if (!args) {
			args = util.getTypeInfo(object[name], name).args
				.map(argInfo => container.resolveSync(argInfo.type));
		}

		object[name].apply(object, args);
	}

	inject(object, container, callback) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			callback(this.createError());
			return;
		}

		const applyArgs = (err, args) => {
			if (err) {
				callback(err);
				return;
			}

			object[name].apply(object, args);
			callback();
		};

		let args = this.args;
		const name = this.name;
		if (args) {
			applyArgs(null, args);
			return;
		}

		args = util.getTypeInfo(object[name], name).args;
		async.map(args, (argInfo, next) => {
			container.resolve(argInfo.type, next);
		}, applyArgs);
	}
}

module.exports = {
	Property: PropertyInjection,
	PropertyValue: PropertyValueInjection,
	Method: MethodInjection
};
