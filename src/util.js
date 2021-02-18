exports.argPrefix = '$arg:';

exports.getTypeInfo = (ctor, key) => {
	if (typeof(ctor) !== 'function') {
		const message = ctor && ctor.constructor
			? 'instance of ' + ctor.constructor.name
			: (!ctor ? 'null' : typeof(ctor));
		throw new Error('Constructor must be a function, got ' + message);
	}

	const docCommentRegex = [
		//normal function
		/^function\s+(?:(\w+))?\s*\(([^)]*)\)\s*{/,
		//es6 class method
		/^(\w+)s*\(([^)]*)\)\s*{/,
		//class with constructor
		/^class(?:[\s+](\w+))?[\s\S]+?constructor\s*\(([^)]*)\)\s*{/,
		//class without constructor
		/^class(?:[\s+](\w+))?/,
		//fat arrow functions (always anonymous, so first group capture must be empty)
		/^()\(?([^)]*)\)?\s*=>\s*{/
	];

	let data;

	for (let i = 0; i < docCommentRegex.length; i++) {
		data = docCommentRegex[i].exec(ctor.toString());
		if (data) {
			break;
		}
	}

	if (!data) {
		throw new Error(
			`Unable to parse function definition: ${ctor.toString()}. If ` +
			'this is a valid constructor, please open an issue with the developers.'
		);
	}

	const typeName = key || data[1];
	const signature = (data[2] || '').trim();
	if (!typeName || typeName === 'function') {
		throw new Error('A resolution key must be given if a named function is not');
	}

	const typeInfo = {
		args: [],
		ctor: ctor,
		name: typeName
	};

	if (signature) {
		signature.split(',').forEach((param, i) => {
			const paramTrimmed = param.trim();
			if (!paramTrimmed) {
				//dangling comma
				return;
			}
			//ferret out the type of each argument based on inline jsdoc:
			//https://code.google.com/p/jsdoc-toolkit/wiki/InlineDocs
			const data = /^\/\*\*\s*([^*\s]+?)\s*\*+\/\s*(\w+)\s*$/.exec(paramTrimmed);

			if (!data) {
				// assume it will be resolved via implicit arg:* syntax
				typeInfo.args.push({
					position: i,
					type: `${exports.argPrefix}${paramTrimmed}`,
					name: paramTrimmed,
					parsedAs: 'arg'
				});
			} else {
				typeInfo.args.push({
					position: i,
					type: data[1],
					name: data[2],
					parsedAs: 'doc-comment'
				});
			}
		});
	}

	return typeInfo;
};
