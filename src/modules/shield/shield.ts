class TWShield {
    static #start() {
        const incomingsAmount = document.querySelector('td a span#incomings_amount') as HTMLSpanElement | null;
        if (!incomingsAmount || !incomingsAmount.textContent) throw new InsidiousError('DOM: td a span#incomings_amount');

        const observeIncomings = new MutationObserver(this.#watchIncomings());
        observeIncomings.observe(incomingsAmount, { subtree: true, childList: true });
    };

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures
    static #watchIncomings() {
        const incomingsAmount = document.querySelector('td a span#incomings_amount') as HTMLSpanElement | null;
        if (!incomingsAmount || !incomingsAmount.textContent) throw new InsidiousError('DOM: td a span#incomings_amount');

        // Cria um mapa para registrar as alterações na quantidade de ataques vindo.
        const incomingsRecord: Map<number, number> = new Map();

        // Registra a quantidade de ataques no momento da criação do mapa.
        let lastUpdate: number = new Date().getTime();
        const currentIncomingsAmount = Number.parseInt(incomingsAmount.textContent, 10);
        if (Number.isNaN(currentIncomingsAmount)) throw new InsidiousError('A quantidade de ataques obtida é inválida.');
        incomingsRecord.set(lastUpdate, currentIncomingsAmount);

        return function(mutationList: MutationRecord[], observer: MutationObserver) {
            if (Insidious.world === 'WATCH INCOMINGS ESTIVER DESATIVADO') observer.disconnect();

            for (const mutation of mutationList) {
                if (mutation.addedNodes.length > 0) {
                    const addedNodeContent = mutation.addedNodes[0].textContent;
                    if (addedNodeContent === null) return;
                    const amountNow = Number.parseInt(addedNodeContent, 10);
                    if (amountNow === 0) return;

                    // Se a quantidade de ataques agora for maior que a última registrada...
                    if (amountNow > (incomingsRecord.get(lastUpdate) as number)) {
                        console.log(`novo ataque a caminho ${amountNow}`);
                        if (TWShield.isOverviewIncomingsScreen()) {
                            console.log('é a janela de ataques');
                        };
                    };

                } else if (mutation.removedNodes.length > 0) {
                    const now = new Date().getTime();
                    const removedNodeContent = mutation.removedNodes[0].textContent;
                    if (removedNodeContent === null) return;
                    const lastIncomingsAmount = Number.parseInt(removedNodeContent, 10);

                    incomingsRecord.set(now, lastIncomingsAmount);
                    lastUpdate = now;
                };
            };
        };
    };

    static #isOverviewIncomingsScreen(): boolean {
        const currentScreenModeSubType = Utils.currentScreenModeSubType();
        if (currentScreenModeSubType.includes(null)) return false;

        return !(currentScreenModeSubType.some((field) => !(location.href.includes(field as string))));
    };

    static get start() {return this.#start};
    static get isOverviewIncomingsScreen() {return this.#isOverviewIncomingsScreen};
};