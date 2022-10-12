class TWShield {
    static async start() {
        try {
            const incomingsAmount = document.querySelector('td a span#incomings_amount') as HTMLSpanElement | null;
            if (!incomingsAmount || !incomingsAmount.textContent) throw new InsidiousError('DOM: td a span#incomings_amount');

            const observeIncomings = new MutationObserver(this.watchIncomings());
            observeIncomings.observe(incomingsAmount, { subtree: true, childList: true });


            let shieldStatus = await this.getShieldStatus();
            // Reseta o registro caso ele seja antigo o suficiente.
            const now = new Date().getTime();
            if (now - shieldStatus.time > 60000 * 3) shieldStatus = await this.resetShieldStatus();

            if (this.isOverviewIncomingsScreen(location.search)) {
                if (shieldStatus.next === null) return;

                if (shieldStatus.next === 'group') {
                    await this.switchToDefaultGroup();

                } else if (shieldStatus.next === 'rename') {
                    // #wereAllRenamed() só pode ser chamado dentro da janela de ataques a caminho.
                    // Do contrário, a ausência da tabela de ataques causará a emissão de um erro.
                    // Se o grupo atual não for "todos", também há a possibilidade de a tabela estar ausente.
                    // Isso porquê as aldeias sob ataque podem não pertencer ao grupo atual.
                    switch (this.wereAllRenamed()) {
                        case true: await this.resetShieldStatus();
                            break;
                        case false: await this.renameAttacks();
                            break;
                    };

                } else if (shieldStatus.next === 'go_back') {
                    // Após renomear os ataques, verifica se deve voltar para a página anterior.
                    const navigationHistory = await Store.get(Keys.shieldNavigation) as NavigationHistory | undefined;
                    if (navigationHistory?.go_back === true) await this.goBackToPreviousScreen(navigationHistory);
                };
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static watchIncomings() {
        const incomingsAmount = document.querySelector('td a span#incomings_amount') as HTMLSpanElement | null;
        if (!incomingsAmount || !incomingsAmount.textContent) throw new InsidiousError('DOM: td a span#incomings_amount');

        /** Guarda informações sobre as alterações na quantidade de ataques a caminho. */
        const incomingsRecord: Map<number, number> = new Map();

        /** Hora da última atualização no registro de ataques. */
        let lastUpdate: number = new Date().getTime();
        /** Quantidade de ataques a caminho. */
        const currentIncomingsAmount = Number.parseInt(incomingsAmount.textContent, 10);
        if (Number.isNaN(currentIncomingsAmount)) throw new InsidiousError('A quantidade de ataques obtida é inválida.');
        incomingsRecord.set(lastUpdate, currentIncomingsAmount);

        return async function(mutationList: MutationRecord[], observer: MutationObserver) {
            try {
                // Interrompe a função caso o Shield esteja desativado.
                if (await Store.get(Keys.shield) === false) {
                    await TWShield.resetShieldStatus();
                    observer.disconnect();
                    return;
                };

                for (const mutation of mutationList) {
                    if (mutation.addedNodes.length > 0) {
                        const addedNodeContent = mutation.addedNodes[0].textContent;
                        if (addedNodeContent === null) return;
                        const amountNow = Number.parseInt(addedNodeContent, 10);
                        if (Number.isNaN(amountNow) || amountNow === 0) return;

                        // Se a quantidade de ataques agora for maior que a última registrada, verifica a janela atual.
                        // Caso já estiver na janela de ataques a caminho, tenta renomear os ataques.
                        // Do contrário, redireciona para a janela de ataques.
                        if (amountNow > (incomingsRecord.get(lastUpdate) as number)) {
                            const incomingsScreenAnchor = incomingsAmount.parentElement as HTMLAnchorElement | null;
                            if (!incomingsScreenAnchor) throw new InsidiousError('O elemento-pai de #incomings_amount não foi encontrado.');

                            /** Link para a janela de ataques a caminho. */
                            const incomingsScreenLink = incomingsScreenAnchor.getAttribute('href');
                            if (!incomingsScreenLink) throw new InsidiousError('O elemento-pai de #incomings_amount não possui atributo HREF.');

                            await Store.set({ [Keys.shieldStatus]: { step: null, next: 'redirect', time: new Date().getTime() } as ShieldStatus });
                            TWShield.shouldItRedirect(incomingsScreenLink);
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

            } catch (err) {
                if (err instanceof Error) InsidiousError.handle(err);
            };
        };
    };

    /** Etiqueta os ataques a caminho. */
    private static async renameAttacks() {
        const incomingsTable = document.querySelector('#incomings_table');
        if (!incomingsTable) throw new InsidiousError('DOM: #incomings_table');

        let shieldStatus = await this.getShieldStatus();
        if (shieldStatus.next !== 'rename') return;

        /** Registra os IDs dos ataques a caminho para que seja possível verificar quais já foram renomeados. */
        let renamedIncomingsList: Set<string> = new Set();
        const incomingsIDList = await Store.get(Keys.shieldIncomings) as Set<string> | undefined;
        if (incomingsIDList instanceof Set) renamedIncomingsList = incomingsIDList;

        /** 
         * IDs dos ataques a caminho no momento em que essa função é executada.
         * É usado para comparação com os IDs previamente registrados em renamedIncomingsList.
         * Isso permite que registros obsoletos sejam removidos.
         */
        const currentIncomingsList: Set<string> = new Set();

        /** Indica se algum ataque foi marcado para ser renomeado. */
        let isSomethingChecked: boolean = false;

        // Não é preciso verificar a integridade dessa array, pois isso já foi feito quando #wereAllRenamed() foi chamado.
        const incomingAttacksLabels = Array.from(incomingsTable.querySelectorAll('.quickedit-label')) as HTMLSpanElement[];
        for (const label of incomingAttacksLabels) {
            if (label.textContent === null) continue;

            const parentTD = label.closest('td');
            if (!parentTD) throw new InsidiousError('Não foi possível encontrar a célula onde se encontra a etiqueta do ataque.');

            const attackCheckbox = parentTD.querySelector('td input[name^="id_" i][type="checkbox" i]') as HTMLInputElement | null;
            if (!attackCheckbox) throw new InsidiousError('DOM: td input[name^="id_" i][type="checkbox" i]');

            const incomingAttackID = attackCheckbox.getAttribute('name')?.replace(/\D/g, '');
            if (!incomingAttackID) throw new InsidiousError('Não foi possível obter o ID do ataque.');
            currentIncomingsList.add(incomingAttackID);

            if (!(label.textContent.includes('Ataque'))) {
                renamedIncomingsList.add(incomingAttackID);

            } else {
                // O ataque é ignorado se já estiver registrado.
                if (renamedIncomingsList.has(incomingAttackID)) continue;

                if (attackCheckbox.checked === false) attackCheckbox.click();
                // Não se deve usar ELSE IF, pois a verificação precisa ser feita novamente.
                if (attackCheckbox.checked === true) {
                    renamedIncomingsList.add(incomingAttackID);
                    if (isSomethingChecked === false) isSomethingChecked = true;
                };
            };
        };

        // Remove registros obsoletos.
        // Entende-se como obsoleto um registro que esteja salvo no banco de dados mas não exista na lista de ataques a caminho.
        // Isso comumente indica que o ataque já chegou ou foi cancelado.
        const obsoleteRecords: string[] = [];
        renamedIncomingsList.forEach((attack) => {
            if (!currentIncomingsList.has(attack)) obsoleteRecords.push(attack);
        });
        obsoleteRecords.forEach((record) => renamedIncomingsList.delete(record));

        // Salva no banco de dados os IDs dos ataques renomeados.
        await Store.set({ [Keys.shieldIncomings]: renamedIncomingsList });
        // Instrui o Shield a voltar para a página onde o usuário estava anteriormente.
        await Store.set({ [Keys.shieldStatus]: { step: 'rename', next: 'go_back', time: new Date().getTime() } as ShieldStatus });

        // Renomeia os ataques marcados, caso exista algum.
        if (isSomethingChecked === true) {
            await Utils.wait();

            const renameAttacksButton = incomingsTable.querySelector('input.btn[type="submit" i][value*="Etiqueta" i]') as HTMLInputElement | null;
            if (!renameAttacksButton) throw new InsidiousError('DOM: input.btn[type="submit" i][value*="Etiqueta" i]');
            renameAttacksButton.click();
        };
    };

    /**
     * Informa que há ataques a caminho e questiona se o usuário deseja redirecionar para a janela de ataques.
     * Se não houver resposta dentro de 5 segundos, redireciona automaticamente.
     * @param link - Endereço para o qual o usuário será redirecionado.
     */
    static async shouldItRedirect(link: string) {
        try {
            let shieldStatus = await this.getShieldStatus();
            if (shieldStatus.next !== 'redirect') return;

            if (this.modalAlreadyExists()) {
                await this.resetShieldStatus();
                return;
            };

            Utils.modal('Ataque a caminho!', 'tw_shield');
            const modalWindow = document.querySelector('#insidious_modal') as HTMLDivElement | null;
            if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

            const warningMessages = [
                'Há ataques a caminho, deseja redirecionar para a janela de ataques?',
                'Caso não responda dentro de 5 segundos, o redirecionamento ocorrerá automaticamente.',
                'Haverão outros avisos caso mais ataques cheguem, mas você pode desativar o Insidious Shield ' +
                'caso não queira recebê-los.'
            ];

            const warningMessageElements = Manatsu.repeat(3, modalWindow, { class: 'insidious_shieldWarningMessage' }, true);
            Manatsu.addTextContent(warningMessageElements, warningMessages);

            const messageModalCtrl = new AbortController();
            const modalButtonArea = new Manatsu(modalWindow, { class: 'insidious_modalButtonArea' }).create();

            const warningTimeout = setTimeout(() => redirectToIncomingsScreen(), 5000);

            new Manatsu('button', { class: 'insidious_modalButton', text: 'Sim' }, modalButtonArea).create()
                .addEventListener('click', () => {
                    clearTimeout(warningTimeout);
                    redirectToIncomingsScreen();
                }, { signal: messageModalCtrl.signal });
            
            new Manatsu('button', { class: 'insidious_modalButton', text: 'Não' }, modalButtonArea).create()
                .addEventListener('click', async () => {
                    clearTimeout(warningTimeout);
                    messageModalCtrl.abort();
                    await TWShield.resetShieldStatus();
                    document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
                }, { signal: messageModalCtrl.signal });

            new Manatsu('button', { class: 'insidious_modalButton', text: 'Desativar' }, modalButtonArea).create()
                .addEventListener('click', async () => {
                    clearTimeout(warningTimeout);
                    messageModalCtrl.abort();
                    try {
                        await Store.set({ [Keys.shield]: false });
                        await TWShield.resetShieldStatus();
                    } catch (err) {
                        if (err instanceof Error) InsidiousError.handle(err);
                    } finally {
                        document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
                    };

                }, { signal: messageModalCtrl.signal });

            /**
             * Redireciona para a janela de ataques a caminho.
             * Se a página atual for a do AS e o plunder estiver ativo, retorna para ela após renomear os ataques.
             */
            async function redirectToIncomingsScreen() {
                messageModalCtrl.abort();

                const navigationHistory: NavigationHistory = {
                    previous: location.search,
                    target: link,
                    date: new Date().getTime(),
                    go_back: true
                };

                // Salva o histórico de navegação do Shield.
                await Store.set({ [Keys.shieldNavigation]: navigationHistory });

                // Registra a etapa atual da operação.
                shieldStatus = { step: 'redirect', next: 'group', time: new Date().getTime() };
                await Store.set({ [Keys.shieldStatus]: shieldStatus });

                location.assign(link);
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /**
     * Impede que mais de um modal seja criado quando muitos ataques estão chegando simultaneamente.
     * No entanto, caso exista um modal e ele não seja relacionado ao Shield, fecha-o.
     * A função entende que ataques a caminho possuem prioridade superior a qualquer outra ocorrência.
     */
     private static modalAlreadyExists(): boolean {
        const modalWindow = document.querySelector('#insidious_modal');
        if (!modalWindow) return false;

        const modalCaller = modalWindow.getAttribute('insidious-modal-caller');
        if (modalCaller === 'tw_shield') {
            return true;

        } else {
            document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
            return false;
        };
    };

    /** Verifica se todos os ataques a caminho foram renomeados. */
    private static wereAllRenamed(): boolean {
        const incomingsAmount = document.querySelector('td a span#incomings_amount') as HTMLSpanElement | null;
        if (!incomingsAmount || !incomingsAmount.textContent) throw new InsidiousError('DOM: td a span#incomings_amount');

        /** Quantidade de ataques a caminho. */
        const currentIncomingsAmount = Number.parseInt(incomingsAmount.textContent, 10);
        if (Number.isNaN(currentIncomingsAmount)) throw new InsidiousError('A quantidade de ataques obtida é inválida.');

        /** Tabela com a lista de ataques a caminho. */
        const incomingsTable = document.querySelector('#incomings_table');
        if (!incomingsTable) throw new InsidiousError('DOM: #incomings_table');

        /** Etiquetas com os nomes dos ataques. */
        const incomingAttacksLabels = Array.from(incomingsTable.querySelectorAll('.quickedit-label'));
        if (incomingAttacksLabels.length === 0 && currentIncomingsAmount > 0) throw new InsidiousError('DOM: .quickedit-label');

        return !(incomingAttacksLabels.some((label) => label.textContent?.includes('Ataque')));
    };

    /** Verifica se o usuário está na janela de ataques a caminho. */
    private static isOverviewIncomingsScreen(url: string): boolean {
        if (!url.includes('overview_villages')) return false;
        if (Utils.currentMode(url) !== 'incomings') return false;
        if (Utils.currentSubType(url) !== 'attacks') return false;
        return true;
    };

    /**
     * Volta para a página na qual o usuário estava antes do Shield o redirecionar.
     * Não faz nada caso a página anterior também seja a janela de ataques a caminho.
     */
     private static async goBackToPreviousScreen(navigationHistory: NavigationHistory) {
        if (!navigationHistory.go_back) return;
        if (!navigationHistory.previous) return;
        if (this.isOverviewIncomingsScreen(navigationHistory.previous)) return;

        // Se a data do registro de navegação for de mais de três minutos atrás, remove-o e cancela a operação.
        const now = new Date().getTime();
        if (now - navigationHistory.date > 60000 * 3) {
            await Store.remove(Keys.shieldNavigation);
            return;
        };

        Utils.modal('Insidious');
        const modalWindow = document.querySelector('#insidious_modal') as HTMLDivElement | null;
        if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

        const warningMessages = [
            'Os ataques foram renomeados com sucesso.',
            'Você será redirecionado de volta para a página na qual estava.'
        ];

        const warningMessageElements = Manatsu.repeat(2, modalWindow, { class: 'insidious_shieldWarningMessage' }, true);
        Manatsu.addTextContent(warningMessageElements, warningMessages);

        const messageModalCtrl = new AbortController();
        const modalButtonArea = new Manatsu(modalWindow, { class: 'insidious_modalButtonArea' }).create();

        const warningTimeout = setTimeout(() => goBack(), 5000);

        new Manatsu('button', { class: 'insidious_modalButton', text: 'Ir agora' }, modalButtonArea).create()
            .addEventListener('click', () => {
                clearTimeout(warningTimeout);
                goBack();
            }, { signal: messageModalCtrl.signal });

        new Manatsu('button', { class: 'insidious_modalButton', text: 'Cancelar' }, modalButtonArea).create()
            .addEventListener('click', () => {
                clearTimeout(warningTimeout);
                messageModalCtrl.abort();
                document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
            }, { signal: messageModalCtrl.signal });

        async function goBack() {
            messageModalCtrl.abort();
            await Store.remove(Keys.shieldNavigation);
            location.assign(navigationHistory.previous);
        };

        await TWShield.resetShieldStatus();
    };

    /** Altera o grupo atual para "todos" caso já não seja. */
    private static async switchToDefaultGroup() {
        const currentGroup = Utils.currentGroup();
        await Store.set({ [Keys.shieldStatus]: { step: 'group', next: 'rename', time: new Date().getTime() } as ShieldStatus });

        if (currentGroup === null) {
            location.assign(`${location.href}&group=0`);
        } else if (currentGroup !== '0') {
            location.assign(location.href.replace(`&group=${currentGroup}`, `&group=0`));
        };
    };

    /** Retorna um objeto representando o status atual do Shield. */
    static async getShieldStatus(): Promise<ShieldStatus> {
        let shieldStatus = await Store.get(Keys.shieldStatus) as ShieldStatus | undefined;
        if (shieldStatus === undefined) {
            shieldStatus = { step: null, next: null, time: 0 };
            await Store.set({ [Keys.shieldStatus]: shieldStatus });
        };

        return shieldStatus;
    };

    /** Reseta o status do Shield para null. */
    static async resetShieldStatus(): Promise<ShieldStatus> {
        const shieldStatus: ShieldStatus = { step: null, next: null, time: 0 };
        await Store.set({ [Keys.shieldStatus]: shieldStatus });
        return shieldStatus;
    };
};