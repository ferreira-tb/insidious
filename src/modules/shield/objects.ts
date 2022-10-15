class ShieldNavigation implements NavigationHistory {
    readonly previous = location.search;
    readonly date = Date.now();
    readonly go_back = true;
    target: string;

    /**
     * Cria um objeto com informações sobre qualquer navegação iniciada pelo Shield.
     * @param target URL de destino.
     */
    constructor(target: string) {
        this.target = target;
    };
};

class ShieldStatus {
    /** Etapa sendo executada no momento. */
    step: ShieldOperations = null;
    /** Próxima etapa a ser executada. */
    next: ShieldOperations = null;
    /** Hora da última atualização. */
    date = 0;

    /**
     * Cria um objeto descrevendo as etapas de operações executadas pelo Shield.
     * @param step Etapa atual.
     * @param next Próxima etapa.
     */
    constructor(step?: ShieldOperations, next?: ShieldOperations) {
        if (step || next) this.date = Date.now();
        if (step) this.step = step;
        if (next) this.next = next;   
    };
};