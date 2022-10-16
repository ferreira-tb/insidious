class GroupAttack {
    /** Parte da URL da janela de ataques a caminho. */
    static readonly groupCreationScreen = 'screen=overview_villages&mode=groups&type=dynamic';

    static async start() {
        const groupID = await Store.get(Keys.farmGroup) as string | undefined;
        if (groupID) {
            /** 
             * Não haverá emissão de erro caso groupJump não exista.
             * Como nem sempre sua ausência é sinônimo de comportamento indesejado,
             * essa variável é extremamente vulnerável a mudanças no DOM do jogo.
             */
            const groupJumpButton = document.querySelector('span.groupJump a.jump_link img') as HTMLImageElement | null;

            if (Game.group !== groupID) {
                if (location.href.includes('group=')) {
                    location.assign(location.href.replace(`&group=${Game.group}`, `&group=${groupID}`));
                } else {
                    location.assign(location.href + `&group=${groupID}`);
                };
                
            } else if (groupJumpButton && Plunder.navigation.last_group_jump !== Game.village) {
                // A aldeia atual permanece a mesma após a navegação para o grupo correto.
                // Caso essa aldeia não pertença ao grupo, a navegação entre as aldeias do grupo se torna impossível.
                // Isso porquê o botão de navegação se torna um elemento diferente.
                // Para solucionar isso, é feito um redirecionamento para a primeira aldeia do grupo Insidious.
                Plunder.navigation = new PlunderGroupNavigation('jump');
                await Store.set({ [Keys.plunderNavigation]: Plunder.navigation });
                groupJumpButton.click();
            };
            
        } else {
            // Retorna caso o grupo já exista.
            const alreadyExists: boolean = await this.checkIfGroupAlreadyExists();
            if (alreadyExists) return;

            // Caso o grupo não exista, emite uma mensagem solicitando sua criação.
            Utils.createModal('Insidious', false);
            const modalWindow = document.querySelector('#insidious_modal') as HTMLDivElement | null;
            if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

            const warningMessages = [
                'Para atacar com mais de uma aldeia é necessário criar um grupo chamado \"Insidious\", onde deverão estar ' +
                'todas as aldeias das quais se deseja atacar.',
                'Recomenda-se que o grupo seja do tipo dinâmico, pois isso aumenta consideravelmente a velocidade do ' +
                'processo, já que evita navegação desnecessária entre as aldeias.'
            ];

            const warningMessageElements = Manatsu.repeat(2, modalWindow, { class: 'insidious_modalMessage' }, true);
            Manatsu.addTextContent(warningMessageElements, warningMessages);

            const messageModalCtrl = new AbortController();
            const modalButtonArea = new Manatsu(modalWindow, { class: 'insidious_modalButtonArea' }).create();
            
            new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Criar' }, modalButtonArea).create()
                .addEventListener('click', () => {
                    messageModalCtrl.abort();
                    this.navigateToGroupCreationScreen();
                }, { signal: messageModalCtrl.signal });

            new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Desativar' }, modalButtonArea).create()
                .addEventListener('click', () => {
                    messageModalCtrl.abort();
                    Plunder.options.group_attack = false;

                    Store.set({ [Keys.plunderOptions]: Plunder.options })
                        .then(() => setTimeout(() => window.location.reload(), Utils.responseTime))
                        .catch((err: unknown) => InsidiousError.handle(err));
                        
                }, { signal: messageModalCtrl.signal });

            new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Fechar' }, modalButtonArea).create()
                .addEventListener('click', () => {
                    messageModalCtrl.abort();
                    Utils.closeModal();
                }, { signal: messageModalCtrl.signal });
        };
    };

    /** Verifica se o grupo Insidious já existe. */
    private static async checkIfGroupAlreadyExists(): Promise<boolean> {
        if (!document.querySelector('div.popup_helper #group_popup')) {
            // Caso a janela de grupos não esteja aberta (mesmo que oculta), abre e a oculta logo em seguida.
            await new Promise<void>((resolve) => {
                const openGroupsButton = document.querySelector('tr#menu_row2 td a#open_groups') as HTMLAnchorElement | null;
                if (!openGroupsButton) throw new InsidiousError('DOM: tr#menu_row2 td a#open_groups');
        
                const observerTimeout = setTimeout(handleTimeout, 5000);
                const observeHelper = new MutationObserver((mutationList) => {
                    for (const mutation of mutationList) {
                        for (const node of Array.from(mutation.addedNodes)) {
                            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('class')?.includes('popup_helper')) {
                                clearTimeout(observerTimeout);
                                observeHelper.disconnect();

                                const closeGroupPopupButton = document.querySelector('a#closelink_group_popup') as HTMLAnchorElement | null;
                                if (!closeGroupPopupButton) throw new InsidiousError('DOM: a#closelink_group_popup');
                                closeGroupPopupButton.click();

                                resolve();
                                return;
                            };
                        };
                    };
                });
        
                // Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro.
                function handleTimeout() {
                    observeHelper.disconnect();
                    InsidiousError.handle(new InsidiousError('TIMEOUT: O servidor demorou demais para responder (checkIfGroupAlreadyExists).'));
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

                await Store.set({ [Keys.farmGroup]: groupID });
                return true;
            };
        };

        return false;
    };

    private static async navigateToGroupCreationScreen() {
        const currentVillageLocation = `${location.origin}\/game.php\?village=${Game.village}\&`;
        const targetLocation = currentVillageLocation + this.groupCreationScreen;

        try {
            await Store.set({ [Keys.farmGroupCreation]: true });
            location.assign(targetLocation);

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    static async createDynamicGroup() {
        await Store.remove(Keys.farmGroupCreation);

        const groupNameInput = document.querySelector('form input#group_name') as HTMLInputElement | null;
        if (!groupNameInput) throw new InsidiousError('DOM: form input#group_name');
        groupNameInput.value = 'Insidious';

        const groupCreationButton = document.querySelector('form input#btn_filters_create') as HTMLInputElement | null;
        if (!groupCreationButton) throw new InsidiousError('form input#btn_filters_create');
        groupCreationButton.click();
    };
};