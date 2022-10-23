class TWPlayer {
    /** Opções da página do jogador. */
    private static options: PlayerOptions;
    /** Mapa com os elementos que constituem o menu de opções. */
    private static readonly config: Map<string, Manatsu[]> = new Map();

    static async open() {
        const villagesList = document.querySelector('td table#villages_list');
        if (!villagesList) throw new InsidiousError('DOM: td table#villages_list');

        // Elementos da extensão.
        const buttonArea = new Manatsu({ class: 'ins_button_area' }).createBefore(villagesList);
        new Manatsu('button', buttonArea, { class: 'ins_button', text: 'Opções' }).create()
            .addEventListener('click', () => this.toggleOptions());
        Manatsu.removeSiblings(buttonArea, 'br');

        // Opções da página.
        this.options = await Store.get(Keys.playerOptions) as PlayerOptions ?? {};
    };

    private static async toggleOptions() {
        try {
            // Abre a janela modal.
            Utils.createModal('Opções', true, { caller: 'player_options' });
            const modalWindow = document.querySelector('#ins_modal');
            if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

            // Adiciona as opções disponíveis.
            if (this.config.size === 0) this.createOptions();
            const styleList = { style: 'text-align: left;' };
            this.config.forEach((option) => Manatsu.createAllInside(option, 2, [modalWindow, styleList]));

            const optionsCtrl = new AbortController();

            Assets.options.player_radio.forEach((option) => {
                const radio = modalWindow.querySelector(`#ins_${option}`) as HTMLInputElement;
                if (TWPlayer.options.radio_options === option) radio.checked = true;
                    radio.addEventListener('change', (e) => {
                        this.saveOptions(e.target, 'radio', option);
                    }, { signal: optionsCtrl.signal });
            }, this);

            // Fecha a janela modal.
            new Manatsu('button', modalWindow, { class: 'ins_modal_btn', text: 'Fechar' }).createInside('div')
                .addEventListener('click', () => {
                    optionsCtrl.abort();
                    Utils.closeModal();
                }, { signal: optionsCtrl.signal });

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static createOptions() {
        Assets.options.player_radio.forEach((option) => {
            let label: string;
            switch (option) {
                case 'show_distance': label = 'Mostrar distância';
                    break;
                case 'hide_all': label = 'Não adicionar informações à lista';
                    break;
            };

            const attributes = { id: `ins_${option}`, name: 'ins_player_option', label: label };
            this.config.set(option, Manatsu.createRadio(attributes, false) as Manatsu[]);
        });
    };

    /**
     * Salva o status atual da opção no banco de dados.
     * @param target Elemento correspondente à opção.
     * @param type Tipo da opção.
     * @param name Nome da opção.
     */
     private static async saveOptions(target: EventTarget | null, type: 'radio', name: PlayerOptions['radio_options']) {
        try {
            if (target instanceof HTMLInputElement && target.checked === true) {
                switch (type) {
                    case 'radio':
                        TWPlayer.options.radio_options = name;
                        await Store.set({ [Keys.playerOptions]: TWPlayer.options });
                };
            };

        } catch (err) {
            InsidiousError.handle(err);
        };
    };
};