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
    static handle(err: Error, global?: ErrorContext) {
        if (typeof global === 'string') {
            console.error(err);
        } else {
            console.error(err);
        }; 
    };
};