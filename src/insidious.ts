class Insidious {
    /** Inicia a extensão. */
    static async start() {
        try {
            // Inicia os scripts de apoio.
            await browser.runtime.sendMessage({ type: 'start' });
            Game.verifyIntegrity();
            // Faz download dos dados necessários para executar a extensão.
            await this.fetchWorldConfig();
            // Armazena as informações obtidas em propriedades da classe Game.
            await Game.setWorldInfo();

            // Aciona as ferramentas da extensão de acordo com a janela na qual o usuário está.
            switch (Game.screen) {
                case 'am_farm': await TWFarm.open();
                    break;
                case 'overview': await this.setAsActiveWorld();
                    break;
                case 'overview_villages': await TWOverview.open();
                    break;
            };

            // Executa operações que estejam pendentes.
            await Defer.promises();

            // Verifica o status do Shield e o inicia se estiver ativado.
            const shieldStatus = await Store.get(Keys.shield) as boolean | undefined;
            if (shieldStatus === true) {
                TWShield.start();
            } else if (shieldStatus === undefined) {
                await Store.set({ [Keys.shield]: true });
                TWShield.start();
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /** Atualiza os dados sobre o jogo. */
    static updateGameData() {
        return new Promise<void>((resolve, reject) => {
            const startCtrl = new AbortController();
            window.addEventListener('message', async (e) => {
                if (e?.data?.direction === 'from-tribalwars') {
                    startCtrl.abort();
                    if (!e.data.game_data) throw new InsidiousError('Não foi possível iniciar o Insidious.');

                    if (e.data.premium === false) {
                        // Caso o jogador não possua conta premium, o Insidious é desativado.
                        await Store.set({ insidiousStatus: false });
                        this.warnAboutPremiumStatus();
                        reject();

                    } else {
                        this.#raw_game_data = e.data.game_data;
                        resolve();
                    };  
                };
            }, { signal: startCtrl.signal });

            const message: WindowMessage = {
                direction: 'from-insidious',
                reason: 'get-game-data'
            };

            window.postMessage(message);
        });
    };

    private static async fetchWorldConfig() {
        try {
            // Verifica se as configurações do mundo atual foram salvas.
            // Em caso negativo, faz download dos arquivos XML.
            const worldConfigStatus = await Store.get(Keys.worldConfig);
            if (!worldConfigStatus) {
                const configSources = [
                    { name: Keys.config, url: TWAssets.info.get_config },
                    { name: Keys.unit, url: TWAssets.info.get_unit_info }
                ];

                const worldConfigData = await Promise.all(configSources.map((source) => {
                    return new Promise<WorldInfo | UnitInfo>((resolve, reject) => {
                        const request = new XMLHttpRequest();
                        request.timeout = 2000;

                        request.addEventListener("error", () => reject(request.status));
                        request.addEventListener("timeout", () => reject(request.status));
                        request.addEventListener("load", () => {
                            if (request.responseXML) {
                                const configXML = request.responseXML;
                                switch (source.name) {
                                    case Keys.config: resolve(new WorldInfo(configXML));
                                        break;
                                    case Keys.unit: resolve(new UnitInfo(configXML));
                                        break;
                                };

                            } else {
                                reject(new InsidiousError('\"XMLHttpRequest.responseXML\" não está presente.'));
                            };
                        });

                        request.open('GET', source.url, true);
                        request.send();
                    });
                }));

                await Promise.all(worldConfigData.map((config: WorldInfo | UnitInfo) => {
                    if (config instanceof WorldInfo) return Store.set({ [Keys.config]: config }); 
                    return Store.set({ [Keys.unit]: config });
                }));

                await Store.set({ [Keys.worldConfig]: true });
            };

        } catch (err) {
            await Store.remove(Keys.worldConfig);
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /** Define o mundo atual como ativo e o registra como sendo o último acessado. */
    private static async setAsActiveWorld() {
        try {
            const activeWorlds = await Store.get(Keys.activeWorlds) as SNObject ?? { };
            activeWorlds[Game.world] = new Date().getTime();

            await Store.set({ [Keys.activeWorlds]: activeWorlds });
            await Store.set({ [Keys.lastWorld]: Game.world });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static warnAboutPremiumStatus() {
        Utils.modal('Insidious');
        const modalWindow = document.querySelector('#insidious_modal') as HTMLDivElement | null;
        if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

        const warningMessage = 'Não é possível utilizar o Insidious sem uma conta premium ativada.';
        new Manatsu(modalWindow, { class: 'insidious_modalMessage', text: warningMessage }).create();

        const modalButtonArea = new Manatsu(modalWindow, { class: 'insidious_modalButtonArea' }).create();
        new Manatsu('button', { class: 'insidious_modalButton', text: 'OK' }, modalButtonArea).create()
            .addEventListener('click', () => {
                document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
            });
    };

    /** Dados, ainda sem tratamento, obtidos diretamente do jogo. */
    static #raw_game_data: TribalWarsGameData;
    static get raw_game_data() {return this.#raw_game_data};
};