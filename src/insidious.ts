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
            await Game.setWorldConfig();

            // Aciona as ferramentas da extensão de acordo com a janela na qual o usuário está.
            switch (Game.screen) {
                case 'am_farm': await TWFarm.open();
                    break;
                case 'overview': await this.setAsActiveWorld();
                    break;
                default: await this.requestScript(Game.screen);
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

            // Exibe informações sobre os status do Plunder e do Shield no rodapé da página.
            this.showServerInfo(shieldStatus)
                .catch((err: unknown) => InsidiousError.handle(err));

        } catch (err) {
            InsidiousError.handle(err);
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
                const sources = new SourceList();
                const worldConfigData = await this.requestConfigData(sources);

                await Promise.all(worldConfigData.map((config: WorldInfo | UnitInfo) => {
                    if (config instanceof WorldInfo) return Store.set({ [Keys.config]: config }); 
                    return Store.set({ [Keys.unit]: config });
                }));

                await Store.set({ [Keys.worldConfig]: true });
            };

        } catch (err) {
            await Store.remove(Keys.worldConfig);
            InsidiousError.handle(err);
        };
    };

    private static requestConfigData(sources: SourceList) {
        return Promise.all(Object.keys(sources).map((key: keyof SourceList) => {
            return new Promise<WorldInfo | UnitInfo>((resolve, reject) => {
                const request = new XMLHttpRequest();
                request.timeout = 2000;
    
                request.addEventListener('error', () => reject(request.status));
                request.addEventListener('timeout', () => reject(request.status));
                request.addEventListener('load', () => {
                    if (request.responseXML) {
                        const configXML = request.responseXML;
                        switch (sources[key].name) {
                            case Keys.config: return resolve(new WorldInfo(configXML));
                            case Keys.unit: return resolve(new UnitInfo(configXML));
                        };
                    };

                    reject(new InsidiousError('\"XMLHttpRequest.responseXML\" não está presente.'));     
                });
    
                request.open('GET', sources[key].url, true);
                request.send();
            });
        }));
    };

    /** Solicita os scripts correspondentes à página atual. */
    private static requestScript(screen: GameScreen) {
        return new Promise<void>((resolve, reject) => {
            browser.runtime.sendMessage({ type: screen })
                .then(() => this.loadScript(screen))
                .then(() => resolve())
                .catch((err: unknown) => reject(err));
        });
    };

    /** Carrega os scripts de acordo com a janela atual. */
    private static loadScript(screen: GameScreen): Promise<void> {
        switch(screen) {
            case 'market': return TWMarket.open();
            case 'overview_villages': return TWOverview.open();
            case 'place': return TWSword.open();
            case 'report': return TWReport.open();
            default: return Promise.resolve();
        };
    };

    /** Exibe informações sobre os status do Plunder e do Shield no rodapé da página. */
    private static async showServerInfo(shieldStatus: boolean | undefined) {
        const plunderStatus = await Store.get(Keys.plunder) as boolean | undefined;

        // O estado padrão deles, quando undefined, difere.
        // Para o Shield é 'ativo', já para o Plunder é 'inativo'.
        const eachStatus = [shieldStatus, plunderStatus].map((status, index) => {
            if (status === false) return 'inativo';
            if (status === undefined) {
                switch (index) {
                    case 0: return 'ativo';
                    case 1: return 'inativo';
                };
            };

            return 'ativo';
        });

        const shieldInfo = `Shield: ${eachStatus[0]}`;
        const plunderInfo = `Plunder: ${eachStatus[1]}`;
        const responseTime = `Tempo de resposta: ${Utils.responseTime.toLocaleString('pt-br')}ms`;

        const serverInfo = document.querySelector('td.maincell > p.server_info');
        if (!serverInfo) throw new InsidiousError('DOM: td.maincell > p.server_info');

        const spanText = { text: `${shieldInfo} \| ${plunderInfo} \| ${responseTime} \| ` };
        new Manatsu('span', spanText).createBefore(serverInfo.firstChild);
    };

    /** Define o mundo atual como ativo e o registra como sendo o último acessado. */
    private static async setAsActiveWorld() {
        try {
            const activeWorlds = await Store.get(Keys.activeWorlds) as SNObject ?? { };
            activeWorlds[Game.world] = Date.now();

            await Store.set({ [Keys.activeWorlds]: activeWorlds });
            await Store.set({ [Keys.lastWorld]: Game.world });

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static warnAboutPremiumStatus() {
        Utils.createModal('Insidious', true);
        const modalWindow = document.querySelector('#insidious_modal');
        if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

        const warningMessage = 'Não é possível utilizar o Insidious sem uma conta premium ativada.';
        new Manatsu(modalWindow, { class: 'insidious_modalMessage', text: warningMessage }).create();

        const modalButtonArea = new Manatsu(modalWindow, { class: 'insidious_modalButtonArea' }).create();
        new Manatsu('button', { class: 'insidious_modalButton', text: 'OK' }, modalButtonArea).create()
            .addEventListener('click', Utils.closeModal);
    };

    /** Dados, ainda sem tratamento, obtidos diretamente do jogo. */
    static #raw_game_data: TribalWarsGameData;
    static get raw_game_data() {return this.#raw_game_data};
};