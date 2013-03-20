exports.getTypeInfo = function(ctor, name) {
	var data = /^function(?:[\s+](\w+))?\s*\((.*?)\)\s*\{/.exec(ctor.toString());
	if (!data) {
		throw new Error('Unable to parse function definition: ' + ctor.toString());
	}

	var typeName = data[1] || name,
		signature = data[2].trim();
	if (!typeName) {
		throw new Error('"name" must be given if a named function is not');
	}

	var typeInfo = {
		args: [],
		ctor: ctor,
		name: typeName
	};

	if (signature) {
		signature.split(',').forEach(function(param, i) {
			//ferret out the type of each argument based on inline jsdoc:
			//https://code.google.com/p/jsdoc-toolkit/wiki/InlineDocs
			var data = /^\/\*\*\s*(\w+)\s*\*\/\s*(\w+)\s*$/.exec(param.trim());
			if (!data) {
				throw new Error(
					'Unable to determine type of parameter at position ' + (i + 1) +
						' for type "' + typeName + '"'
				);
			}

			typeInfo.args.push({
				position: i,
				type: data[1],
				name: data[2]
			});
		});
	}

	return typeInfo;
};