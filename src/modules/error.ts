/**
 * Essa classe não pode depender de nada que esteja fora do arquivo no qual se encontra.
 * Isso acontece pois ela é usada por diferentes contextos da extensão.
 **/
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
    static handle(err: Error, global: ErrorContext = 'main') {
        if (global === 'main') {
            browser.runtime.sendMessage({ type: 'error', error: err })
                .catch((err: unknown) => {
                    if (err instanceof Error) console.error(err);
                });

        } else {
            browser.notifications.create({ 
                type: 'basic',
                title: 'Insidious',
                message: err.message
                
            }).catch((err: unknown) => {
                if (err instanceof Error) console.error(err);
            });
        }; 
    };
};