class Insidious {
    /** Inicia a extensão. */
    static async start() {
        try {
            // Inicia os scripts de apoio.
            await browser.runtime.sendMessage({ type: 'start' });
            Game.verifyIntegrity();
            
            // Verifica se as configurações do mundo já estão salvas no banco de dados local.
            await this.verifyConfigData();
            // Armazena as informações obtidas em propriedades da classe Game.
            await Game.setWorldConfig();

            // Define o mundo atual como ativo e o registra como sendo o último acessado.
            this.setAsActiveWorld();
            // Aciona as ferramentas da extensão de acordo com a janela na qual o usuário está.
            await this.requestScript(Game.screen);
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
            const request = async (e: MessageEvent<WindowMessageFromPage>) => {
                if (e?.data?.direction === 'from-tribalwars') {
                    window.removeEventListener('message', request);
                    
                    if (!e.data.game_data) throw new InsidiousError('Não foi possível iniciar o Insidious.');

                    // Não continua caso o mundo esteja em fase de pré-registro.
                    if (e.data.game_data.pregame === true) return reject();

                    // Se o jogador não possuir conta premium, o Insidious não é iniciado.
                    if (e.data.premium === false) {
                        this.warnAboutPremiumStatus();
                        reject();

                    } else {
                        this.#raw_game_data = e.data.game_data;
                        resolve();
                    };
                };
            };

            const bridge = new Bridge('get-game-data');
            window.addEventListener('message', request);
            window.postMessage(bridge);
        });
    };

    /** Exibe uma notificação nativa do jogo. */
    static showUIMessage(message: UIMessage) {
        const bridge = new Bridge('ui-message', message);
        window.postMessage(bridge);
    };

    /**
     * Verifica se as configurações do mundo atual estão salvas.
     * Em caso negativo, faz download dos arquivos XML.
     */
    private static async verifyConfigData() {
        try {
            const worldConfigStatus = await Store.get(Keys.worldConfig);
            if (!worldConfigStatus) {
                const sources = new SourceList();
                const worldConfigData = await this.fetchConfigData(sources);

                await Promise.all(worldConfigData.map((info: WorldInfo | UnitInfo) => {
                    if (info instanceof WorldInfo) return Store.set({ [Keys.config]: info });
                    if (info instanceof UnitInfo) return Store.set({ [Keys.unit]: info });
                    throw new InsidiousError('Os dados sobre o mundo são inválidos.');
                }));

                await Store.set({ [Keys.worldConfig]: true });
            };

        } catch (err) {
            await Store.remove(Keys.worldConfig);
            InsidiousError.handle(err);
        };
    };

    private static fetchConfigData(sources: SourceList) {
        return Promise.all(Object.keys(sources).map((key: keyof SourceList) => {
            const parser = new DOMParser();
            return new Promise<WorldInfo | UnitInfo>(async (resolve) => {
                const result = await fetch(sources[key].url);
                const text = await result.text();
                const htmlDocument = parser.parseFromString(text, 'text/xml');

                switch (sources[key].name) {
                    case Keys.config: return resolve(new WorldInfo(htmlDocument));
                    case Keys.unit: return resolve(new UnitInfo(htmlDocument));
                };
            });
        }));
    };

    /** Solicita os scripts correspondentes à página atual. */
    private static requestScript(screen: GameScreen) {
        return new Promise<void>((resolve, reject) => {
            browser.runtime.sendMessage({ type: screen })
                .then(() => resolve())
                .then(() => this.loadScript(screen))
                .catch((err: unknown) => reject(err));
        });
    };

    /** Carrega os scripts de acordo com a janela atual. */
    private static loadScript(screen: GameScreen): Promise<void> {
        switch(screen) {
            case 'am_farm': return TWFarm.open();
            case 'info_player': return TWPlayer.open();
            case 'market': return TWMarket.open();
            case 'overview': return TWVillage.open();
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
        const plunderInfo = `Saque: ${eachStatus[1]}`;
        const responseTime = `Tempo de resposta: ${Utils.responseTime.toLocaleString('pt-br')}ms`;

        const serverInfo = document.querySelector('td.maincell > p.server_info');
        if (!serverInfo) throw new InsidiousError('DOM: td.maincell > p.server_info');

        const spanText = { text: `${shieldInfo} \| ${plunderInfo} \| ${responseTime} \| ` };
        new Manatsu('span', spanText).createBefore(serverInfo.firstChild);
    };

    /** Define o mundo atual como ativo e o registra como sendo o último acessado. */
    private static async setAsActiveWorld() {
        try {
            const activeWorlds = await Store.get(Keys.activeWorlds) as StandardObject<number> ?? { };
            Reflect.set(activeWorlds, Game.world, Date.now());

            await Store.set({ [Keys.activeWorlds]: activeWorlds });
            await Store.set({ [Keys.lastWorld]: Game.world });

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    /** Avisa ao jogador que não é possível utilizar o Insidious sem uma conta premium ativa.  */
    private static warnAboutPremiumStatus() {
        const serverInfo = document.querySelector('td.maincell > p.server_info');
        if (!serverInfo) throw new InsidiousError('DOM: td.maincell > p.server_info');

        const warning = { text: 'Não é possível utilizar o Insidious sem uma conta premium ativa.' };
        new Manatsu('span', warning).createBefore(serverInfo.firstChild);
    };

    /** Dados, ainda sem tratamento, obtidos diretamente do jogo. */
    static #raw_game_data: TribalWarsGameData;
    static get raw_game_data() { return this.#raw_game_data };
};