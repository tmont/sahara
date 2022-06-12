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
		{ type: 'function', regex: /^function\s+(\w+)?\s*\(([^)]*)\)\s*{/ },
		//es6 class method
		{ type: 'method', regex: /^(\w+)\s*\(([^)]*)\)\s*{/ },
		//class with constructor
		{ type: 'class-with-ctor', regex: /^class(?:\s+(\w+))?[\s\S]+?constructor\s*\(([^)]*)\)\s*{/ },
		//class without constructor
		{ type: 'class-without-ctor', regex: /^class(?:\s+(\w+))?/ },
		//fat arrow functions (always anonymous, so first group capture must be empty)
		{ type: 'fat-arrow', regex: /^()\(?([^)]*)\)?\s*=>/ },
	];

	let data;
	let matched;

	for (let i = 0; i < docCommentRegex.length; i++) {
		data = docCommentRegex[i].regex.exec(ctor.toString());
		if (data) {
			matched = docCommentRegex[i];
			break;
		}
	}

	if (!data) {
		throw new Error(
			`Unable to parse function definition: ${ctor.toString()}. If ` +
			'this is a valid constructor, please open an issue with the developers.'
		);
	}

	const typeName = key || data[1] ||
		(matched.type === 'class-with-ctor' || matched.type === 'class-without-ctor' || matched.type === 'function' ?
			ctor.name :
			null
		);
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
