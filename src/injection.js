var util = require('./util');

function PropertyValueInjection(name, value) {
	this.name = name;
	this.value = value;
}

PropertyValueInjection.prototype = {
	inject: function(object) {
		object[this.name] = this.value;
	}
};

function PropertyInjection(name, key) {
	this.name = name;
	this.key = key;
}

PropertyInjection.prototype = {
	inject: function(object, container) {
		object[this.name] = container.resolve(this.key);
	}
};

function MethodInjection(name, args) {
	this.name = name;
	this.args = args;
}

MethodInjection.prototype = {
	inject: function(object, container) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			throw new Error(
				'Cannot perform method injection because the object does ' +
					'not have a method "' + this.name + '"'
			);
		}

		var args = this.args;
		if (!args) {
			args = util.getTypeInfo(object[this.name], this.name).args.map(function(argInfo) {
				return container.resolve(argInfo.type);
			});
		}

		object[this.name].apply(object, args);
	}
};

module.exports = {
	Property: PropertyInjection,
	PropertyValue: PropertyValueInjection,
	Method: MethodInjection
};