var util = require('./util'),
	async = require('async');

function PropertyValueInjection(name, value) {
	this.name = name;
	this.value = value;
}

PropertyValueInjection.prototype = {
	injectSync: function(object, container) {
		object[this.name] = this.value;
	},

	inject: function(object, container, callback) {
		this.injectSync(object, container);
		callback && callback();
	}
};

function PropertyInjection(name, key) {
	this.name = name;
	this.key = key;
}

PropertyInjection.prototype = {
	injectSync: function(object, container) {
		object[this.name] = container.resolveSync(this.key);
	},

	inject: function(object, container, callback) {
		var name = this.name;
		container.resolve(this.key, function(err, instance) {
			if (err) {
				callback(err);
				return;
			}

			object[name] = instance;
			callback();
		});
	}
};

function MethodInjection(name, args) {
	this.name = name;
	this.args = args;
}

MethodInjection.prototype = {
	createError: function() {
		return new Error(
			'Cannot perform method injection because the object does ' +
				'not have a method "' + this.name + '"'
		);
	},

	injectSync: function(object, container) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			throw this.createError();
		}

		var args = this.args, name = this.name;
		if (!args) {
			args = util.getTypeInfo(object[name], name).args;
			args = args.map(function(argInfo) {
				return container.resolveSync(argInfo.type);
			});
		}

		object[name].apply(object, args);
	},

	inject: function(object, container, callback) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			callback(this.createError());
			return;
		}

		function applyArgs(err, args) {
			if (err) {
				callback(err);
				return;
			}

			object[name].apply(object, args);
			callback();
		}

		var args = this.args, name = this.name;
		if (args) {
			applyArgs(null, args);
			return;
		}

		args = util.getTypeInfo(object[name], name).args;
		async.map(args, function(argInfo, next) {
			container.resolve(argInfo.type, next);
		}, applyArgs);
	}
};

module.exports = {
	Property: PropertyInjection,
	PropertyValue: PropertyValueInjection,
	Method: MethodInjection
};