class GroupAttack {
    static readonly groupCreationScreen = 'screen=overview_villages&mode=groups&type=dynamic';

    static async #start() {
        const groupKey = `farmGroupID_${Insidious.world}`;
        const groupID = (await browser.storage.local.get(groupKey))[groupKey] as string | undefined;
        
        if (groupID) {
            const currentGroup = Utils.currentGroup();
            if (currentGroup === null) {
                location.href = location.href + `&group=${groupID}`;
            } else if (currentGroup !== groupID) {
                location.href = location.href.replace(`&group=${currentGroup}`, `&group=${groupID}`);
            };
            
        } else {
            // Retorna caso o grupo já exista.
            if (await this.#verify()) return;

            // Caso o grupo não exista, emite uma mensagem solicitando sua criação.
            Utils.modal('Insidious');
            const modalWindow = document.querySelector('#insidious_modal') as HTMLDivElement | null;
            if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

            const firstRequestMessage = 'Para atacar com mais de uma aldeia é necessário criar um grupo chamado \"Insidious\", onde deverão estar ' +
            'todas as aldeias das quais se deseja atacar.';
            new Manatsu({ text: firstRequestMessage, class: 'insidious_farmRequestMessage' }, modalWindow).create();

            const secondRequestMessage = 'Recomenda-se que o grupo seja do tipo dinâmico, pois isso aumenta consideravelmente a velocidade do ' +
            'processo, já que evita navegação desnecessária entre as aldeias.';

            new Manatsu({ text: secondRequestMessage, class: 'insidious_farmRequestMessage' }, modalWindow).create();

            const modalButtonArea = new Manatsu(modalWindow).create();
            const messageModalCtrl = new AbortController();
            new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Criar' }, modalButtonArea).create()
                .addEventListener('click', () => {
                    messageModalCtrl.abort();
                    this.#navigateToGroupCreationScreen();
                }, { signal: messageModalCtrl.signal });

            new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Desativar' }, modalButtonArea).create()
            .addEventListener('click', () => {
                messageModalCtrl.abort();

                Plunder.options.group_attack = false;
                browser.storage.local.set({ [`plunderOptions_${Insidious.world}`]: Plunder.options })
                    .then(() => setTimeout(() => window.location.reload(), Utils.getResponseTime()))
                    .catch((err: unknown) => {
                        if (err instanceof Error) InsidiousError.handle(err);
                    });
            }, { signal: messageModalCtrl.signal });

            new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Fechar' }, modalButtonArea).create()
                .addEventListener('click', () => {
                    messageModalCtrl.abort();
                    document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
                }, { signal: messageModalCtrl.signal });
        };
    };

    // Verifica se o grupo Insidious já existe.
    static async #verify(): Promise<boolean> {
        if (!document.querySelector('div.popup_helper #group_popup')) {
            // Caso a janela de grupos não esteja aberta (mesmo que oculta), abre e a oculta logo em seguida.
            await new Promise<void>((resolve) => {
                const openGroupsButton = document.querySelector('tr#menu_row2 td a#open_groups') as HTMLAnchorElement | null;
                if (!openGroupsButton) throw new InsidiousError('DOM: tr#menu_row2 td a#open_groups');
        
                const observerTimeout = setTimeout(handleTimeout, 5000);
                const observeHelper = new MutationObserver((mutationList) => {
                    for (const mutation of mutationList) {
                        if (mutation.type === 'childList') {
                            for (const node of Array.from(mutation.addedNodes)) {
                                if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('class')?.includes('popup_helper')) {
                                    clearTimeout(observerTimeout);
                                    observeHelper.disconnect();

                                    const closeGroupPopupButton = document.querySelector('a#closelink_group_popup') as HTMLAnchorElement | null;
                                    if (!closeGroupPopupButton) throw new InsidiousError('DOM: a#closelink_group_popup');
                                    closeGroupPopupButton.click();

                                    resolve();
                                    break;
                                };
                            };
                        };
                    };
                });
        
                // Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro.
                function handleTimeout() {
                    observeHelper.disconnect();
                    throw new InsidiousError('TIMEOUT: O servidor demorou demais para responder.');
                };
        
                observeHelper.observe(document.body, { subtree: true, childList: true });
                openGroupsButton.click();
            });
        };

        const groupPopup = document.querySelector('div.popup_helper #group_popup');
        if (!groupPopup) throw new InsidiousError('DOM: div.popup_helper #group_popup');

        const groupIDSelect = groupPopup.querySelector('select#group_id') as HTMLSelectElement | null;
        if (!groupIDSelect) throw new InsidiousError('DOM: select#group_id');

        const optionsList = Array.from(groupIDSelect.querySelectorAll('option'));
        for (const option of optionsList) {
            if (option.textContent?.toLowerCase().trim() === 'insidious') {
                const groupID = option.value.replace(/\D/g, '');
                if (groupID.length === 0) throw new InsidiousError('O grupo Insidious existe, mas não foi possível obter seu id.');

                await browser.storage.local.set({ [`farmGroupID_${Insidious.world}`]: groupID });
                return true;
            };
        };

        return false;
    };

    static async #navigateToGroupCreationScreen() {
        const currentVillageLocation = `${location.origin}\/game.php\?village=${Utils.currentVillage()}\&`;
        const targetLocation = currentVillageLocation + this.groupCreationScreen;

        try {
            await browser.storage.local.set({ [`farmGroupCreation_${Insidious.world}`]: 'pending' });
            location.href = targetLocation;

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static async #createDynamicGroup() {
        await browser.storage.local.remove(`farmGroupCreation_${Insidious.world}`);

        const groupNameInput = document.querySelector('form input#group_name') as HTMLInputElement | null;
        if (!groupNameInput) throw new InsidiousError('DOM: form input#group_name');
        groupNameInput.value = 'Insidious';

        const groupCreationButton = document.querySelector('form input#btn_filters_create') as HTMLInputElement | null;
        if (!groupCreationButton) throw new InsidiousError('form input#btn_filters_create');
        groupCreationButton.click();
    };

    static get start() {return this.#start};
    static get createDynamicGroup() {return this.#createDynamicGroup};
};