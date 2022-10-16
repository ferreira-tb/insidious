class InsidiousError extends Error {
    constructor(message: string) {
        super();

        this.name = 'InsidiousError';
        this.message = message;
    };

    /**
     * @param err - Erro emitido.
     * @param global - Contexto global no qual o erro foi emitido.
     */
    static handle(err: unknown, global: ErrorContext = 'main') {
        if (!(err instanceof Error)) return;
        
        if (global === 'main') {
            browser.runtime.sendMessage({ type: 'error', error: err })
                .catch((err: unknown) => InsidiousError.handle(err));

        } else {
            browser.notifications.create({ 
                type: 'basic',
                title: 'Insidious',
                message: err.message         
            }).catch((err: unknown) => InsidiousError.handle(err));
        }; 
    };
};