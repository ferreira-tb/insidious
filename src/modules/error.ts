class InsidiousError extends Error {
    constructor(message: string) {
        super();

        this.name = 'InsidiousError';
        this.message = message;
    };

    static #handle(err: Error) {
        console.error(err);
    };

    static get handle() {return this.#handle};
};