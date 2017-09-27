class MemoryLifetime {
	constructor() {
		this.value = null;
	}

	fetch() {
		return this.value;
	}

	store(value) {
		this.value = value;
	}
}

class TransientLifetime {
	fetch() {
		return null;
	}

	store(value) {}
}

module.exports = {
	Memory: MemoryLifetime,
	Transient: TransientLifetime
};
