class Action {
    /** Status atual do Insidious. */
    private static insidiousStatus: boolean | undefined;

    /** Chave para obter o status atual do Insidious (insidiousStatus) */
    static readonly key = 'insidiousStatus';

    static async start() {
        await this.getInsidiousStatus();
        this.updateToggleButtonText();

        document.querySelector('#toggle')?.addEventListener('click', async () => {
            try {
                await this.getInsidiousStatus();
                await this.toggleInsidious();
                this.updateToggleButtonText();

            } catch (err) {
                if (err instanceof Error) InsidiousError.handle(err, 'action');
            };
        });

        document.querySelector('#config')?.addEventListener('click', () => {
            const panelWidth = 800;
            const panelHeight = 600;
            browser.windows.create({
                type: 'detached_panel',
                url: '../config/config.html',
                width: panelWidth,
                height: panelHeight,
                top: screen.availHeight - panelHeight,
                left: screen.availWidth - panelWidth
            }).catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err, 'action');
            });
        });

        document.querySelector('#repository')?.addEventListener('click', () => {
            browser.tabs.create({ url: 'https://github.com/ferreira-tb/insidious', active: true })
                .catch((err: unknown) => {
                    if (err instanceof Error) InsidiousError.handle(err, 'action');
                });
        });
    };

    /** Atualiza o texto do botão que controla o status do Insidious. */
    private static updateToggleButtonText() {
        const toggleInsidiousBtn = document.querySelector('#toggle') as HTMLButtonElement;

        if (this.insidiousStatus === true) {
            toggleInsidiousBtn.textContent = 'Desativar';
        } else if (this.insidiousStatus === false) {
            toggleInsidiousBtn.textContent = 'Ativar';
        };
    };

    /** Altera o status do Insidious. */
    private static async toggleInsidious() {
        if (this.insidiousStatus === true) {
            await Store.set({ [this.key]: false });
            this.insidiousStatus = false;
        } else if (this.insidiousStatus === false) {
            await Store.set({ [this.key]: true });
            this.insidiousStatus = true;
        };
    };

    /** Define o status atual do Insidious. */
    private static async getInsidiousStatus() {
        this.insidiousStatus = await Store.get(this.key) as boolean | undefined;
        if (this.insidiousStatus === undefined) {
            await Store.set({ [this.key]: true });
            this.insidiousStatus = true;
        };
    };
};

Action.start();