class TWPlayer {
    /** Opções da página do jogador. */
    static options: PlayerOptions;
    /** Mapa com os elementos que constituem o menu de opções. */
    private static readonly config: Map<string, Manatsu[]> = new Map();

    private static readonly eventTarget = new EventTarget();

    static async open() {
        const villagesList = document.querySelector('td table#villages_list');
        if (!villagesList) throw new InsidiousError('DOM: td table#villages_list');

        // Elementos da extensão.
        const buttonArea = new Manatsu({ class: 'ins_button_area' }).createBefore(villagesList);
        const optionsButton = new Manatsu('button', buttonArea, { class: 'ins_button', text: 'Opções' }).create();
        Manatsu.removeSiblings(buttonArea, 'br');

        optionsButton.addEventListener('click', () => {
            this.toggleOptions()
                .catch((err: unknown) => InsidiousError.handle(err));
        });

        // Opções da página.
        this.options = await Store.get(Keys.playerOptions) as PlayerOptions ?? {};

        // Prepara a nova coluna da tabela.
        const radioOption = this.options.radio_option;
        if (radioOption && radioOption !== 'hide_all') {
            this.appendTableColumn();
            this.applyRadioOption();
        };
    };

    /** Adiciona o cabeçalho da coluna que será usada pelo Insidious. */
    static appendTableColumn() {
        const thead = document.querySelector('table#villages_list > thead > tr') as HTMLTableElement | null;
        if (!thead) throw new InsidiousError('DOM: table#villages_list > thead > tr');
        
        let newColumn = document.querySelector('#ins_info_player_th');
        if (!newColumn) {
            newColumn = thead.appendManatsu('th', { id: 'ins_info_player_th' });
        };

        if (this.options.radio_option === 'hide_all') {
            newColumn.setAttribute('style', 'display: none;');
        } else {
            newColumn.removeAttribute('style');
        };

        const setTextContent = () => {
            switch (this.options.radio_option) {
                case 'show_distance': return 'Distância';
                case 'show_time': return 'Tempo';
                default: return null;
            };
        };

        newColumn.textContent = setTextContent();
    };

    /** Abre a janela modal com as opções disponíveis. */
    private static async toggleOptions() {
        Utils.createModal('Opções', true, { caller: 'player_options' });
        const modalWindow = document.querySelector('#ins_modal');
        if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

        // Adiciona as opções.
        if (this.config.size === 0) this.createOptions();
        const styleList = { style: 'text-align: left;' };
        this.config.forEach((option) => Manatsu.createAllInside(option, 2, [modalWindow, styleList]));

        const optionsCtrl = new AbortController();

        Options.player.radio.forEach((option) => {
            const radio = modalWindow.querySelector(`#ins_${option}`) as HTMLInputElement;
            if (TWPlayer.options.radio_option === option) radio.checked = true;
                radio.addEventListener('change', (e) => {
                    this.saveOptions(e.target, 'radio', option)
                        .then(() => this.applyRadioOption())
                        .catch((err: unknown) => InsidiousError.handle(err))
                        .finally(() => Utils.closeModal());
                }, { signal: optionsCtrl.signal });
        }, this);

        // Fecha a janela modal.
        new Manatsu('button', modalWindow, { class: 'ins_modal_btn', text: 'Fechar' }).createInside('div')
            .addEventListener('click', () => {
                optionsCtrl.abort();
                Utils.closeModal();
            }, { signal: optionsCtrl.signal });
    };

    /** Aplica a opção selecionada. */
    private static applyRadioOption() {
        const actionArea = document.querySelector('.ins_action_area');
        if (actionArea) Manatsu.remove(actionArea);

        switch (this.options.radio_option) {
            case 'hide_all': return this.hideOptions();
            case 'show_distance': return this.showVillageDistance();
            case 'show_time': return this.showTravelTime();
        };
    };

    /** Oculta as informações extras da tabela. */
    private static hideOptions() {
        const column = document.querySelector('#ins_info_player_th');
        if (column) column.setAttribute('style', 'display: none;');

        const tbody = document.querySelector('table#villages_list > tbody');
        if (!tbody) throw new InsidiousError('DOM: table#villages_list > tbody');

        Manatsu.removeChildren(tbody, 'td.ins_custom_cell');
    };

    /** Mostra a distância entre a aldeia atual e a da tabela. */
    private static showVillageDistance() {
        if (TWPlayer.options.radio_option !== 'show_distance') return;

        const villages = new PlayerProfileInfo().villages;
        for (const village of villages) {
            // Caso a distância seja zero, entende que se trata da aldeia atual.
            const text = village.distance !== 0 ? village.distance.toFixed(1) : 'atual';
            this.updateCustomTableCell(village.row, text);
        };
    };

    /** Mostra o tempo de viagem até a aldeia da tabela. */
    private static showTravelTime() {
        if (TWPlayer.options.radio_option !== 'show_time') return;
        this.eventTarget.dispatchEvent(new Event('unitimage'));

        const buttonArea = document.querySelector('.ins_button_area');
        if (!buttonArea) throw new InsidiousError('DOM: ins_button_area');

        const actionArea = new Manatsu({ class: 'ins_action_area' }).createAfter(buttonArea);
        const units = Game.worldInfo.game.archer === 0 ?
            Assets.list.all_units : Assets.list.all_units_archer;

        const villages = new PlayerProfileInfo().villages;
        const calcTravelTime = (unit?: UnitListWithArchers) => {
            if (TWPlayer.options.radio_option !== 'show_time') return;
            if (!unit) unit = 'snob';

            for (const village of villages) {
                const unitSpeed = Game.unitInfo[unit].speed;
                const worldUnitSpeed = Game.worldInfo.unit_speed;

                const millisecondsPerField = 60000 * (unitSpeed * worldUnitSpeed);
                const travelTime = Utils.getFullHours(millisecondsPerField * village.distance);

                // Caso a distância seja zero, entende que se trata da aldeia atual.
                const text = village.distance !== 0 ? travelTime : 'atual';
                TWPlayer.updateCustomTableCell(village.row, text);
            };

            Store.set({ [Keys.playerTravelTime]: unit })
                .catch((err: unknown) => InsidiousError.handle(err));
        };

        for (const unit of units) {
            const imageURL = browser.runtime.getURL(`assets/${unit}-18.png`);
            const image = new Manatsu('img', { src: imageURL, class: 'ins_icon' });
            image.style.cursor = 'pointer';

            const imageCtrl = new AbortController();
            const unitImage = actionArea.appendManatsu(image);
            unitImage.addEventListener('click', () => {
                calcTravelTime(unit);
            }, { signal: imageCtrl.signal });

            this.eventTarget.addEventListener('unitimage', () => {
                imageCtrl.abort();
            }, { signal: imageCtrl.signal });
        };

        Store.get(Keys.playerTravelTime)
            .then((unit: UnitListWithArchers | undefined) => calcTravelTime(unit))
            .catch((err: unknown) => InsidiousError.handle(err));
    };

    /**
     * Atualiza o texto das células da tabela usadas pelo Insidious.
     * @param row Linha que contém a célula.
     * @param text Texto que será utilizado na célula.
     */
    static updateCustomTableCell(row: HTMLElement, text: string) {
        let customCell = row.querySelector('.ins_custom_cell');
        if (!customCell) {
            customCell = row.appendManatsu('td', { text: text });
        } else {
            customCell.textContent = text;
        };

        customCell.setAttribute('class', `ins_custom_cell ins_${TWPlayer.options.radio_option}`);
    };

    /**
     * Prepara um MutationObserver para lidar com aldeias ocultas devido à quantidade em excesso.
     * @param village Linha da tabela de aldeias.
     */
    static handleExcessVillages(village: HTMLElement) {
        return new Promise<void>((resolve, reject) => {
            // Botão para exibir mais aldeias.
            const showMore = village.querySelector('td > a[onclick]');
            if (showMore) {
                const tbody = document.querySelector('table#villages_list > tbody');
                if (!tbody) throw new InsidiousError('DOM: table#villages_list > tbody');

                const tableObserver = new MutationObserver((mutationList) => {
                    for (const mutation of mutationList) {
                        for (const node of Array.from(mutation.addedNodes)) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                const className = (node as Element).getAttribute('class');
                                if (className?.includes('ins_custom_cell')) return;
                                
                                tableObserver.disconnect();
                                TWPlayer.applyRadioOption();
                                return resolve();
                            };
                        };
                    };
                });

                tableObserver.observe(tbody, { subtree: true, childList: true });
                
            } else {
                reject(new InsidiousError('Não foi possível obter as coordenadas das aldeias.'));
            };
        });
    };

    /** Cria as opções que serão apresentadas na janela modal. */
    private static createOptions() {
        Options.player.radio.forEach((option) => {
            const attributes = new InsidiousInputAttributes(option, 'radio');
            this.config.set(option, Manatsu.createLabeledInputElement('radio', attributes, false) as Manatsu[]);
        }, this);
    };

    /**
     * Salva o status atual da opção no banco de dados.
     * @param target Elemento correspondente à opção.
     * @param type Tipo da opção.
     * @param name Nome da opção.
     */
     private static async saveOptions(target: EventTarget | null, type: 'radio', name: PlayerOptions['radio_option']) {
        if (target instanceof HTMLInputElement && target.checked === true) {
            switch (type) {
                case 'radio':
                    TWPlayer.options.radio_option = name;
                    await Store.set({ [Keys.playerOptions]: TWPlayer.options });
            };
        };
    };
};