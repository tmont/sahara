var util = require('./util'),
	async = require('async');

function PropertyValueInjection(name, value) {
	this.name = name;
	this.value = value;
}

PropertyValueInjection.prototype = {
	inject: function(object, container, callback) {
		object[this.name] = this.value;
		callback && callback();
	}
};

function PropertyInjection(name, key) {
	this.name = name;
	this.key = key;
}

PropertyInjection.prototype = {
	inject: function(object, container, callback) {
		if (callback) {
			var name = this.name;
			container.resolve(this.key, function(err, instance) {
				if (err) {
					callback(err);
					return;
				}

				object[name] = instance;
				callback();
			});
		} else {
			object[this.name] = container.resolve(this.key);
		}
	}
};

function MethodInjection(name, args) {
	this.name = name;
	this.args = args;
}

MethodInjection.prototype = {
	inject: function(object, container, callback) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			var err = new Error(
				'Cannot perform method injection because the object does ' +
					'not have a method "' + this.name + '"'
			);

			if (callback) {
				callback(err);
				return;
			}

			throw err;
		}

		var args = this.args, name = this.name;
		if (!args) {
			args = util.getTypeInfo(object[name], name).args;
			if (callback) {
				async.map(args, function(argInfo, next) {
					container.resolve(argInfo.type, function(err, instance) {
						process.nextTick(function() {
							next(err, instance);
						});
					});
				}, function(err, args) {
					if (err) {
						callback(err);
						return;
					}

					object[name].apply(object, args);
					callback();
				});
			} else {
				args = args.map(function(argInfo) {
					return container.resolve(argInfo.type);
				});

				object[name].apply(object, args);
			}
		} else {
			object[name].apply(object, args);
			callback && callback();
		}
	}
};

module.exports = {
	Property: PropertyInjection,
	PropertyValue: PropertyValueInjection,
	Method: MethodInjection
};