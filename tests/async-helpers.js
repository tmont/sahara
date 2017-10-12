const asyncTest = (test) => {
	return (done) => {
		test()
			.then(done.bind(null, null))
			.catch(done);
	}
};

const shouldReject = async (promise, message) => {
	try {
		await promise;
	} catch (e) {
		if (message) {
			if (typeof(e) === 'string') {
				e.should.equal(message);
			} else {
				e.should.have.property('message', message);
			}
		}
		return;
	}

	throw new Error('expected promise to be rejected');
};

module.exports = { asyncTest, shouldReject };
