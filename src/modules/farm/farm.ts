class Farm {
    /** Botões do Plunder. */
    static menu: PlunderButtons;
    /** Mapa com os elementos que constituem o menu de configurações do Plunder. */
    private static readonly config: Map<string, Manatsu[]> = new Map();

    static async open() {
        // Os botões são adicionados à página após o Insidious terminar de verificar o status do Plunder.
        // O construtor também adiciona os eventos.
        this.menu = new PlunderButtons();

        ////// DADOS
        await this.info();

        // Área com os modelos do assistente de saque.
        const farmModels = document.querySelector('#content_value div.vis div form table.vis tbody');
        if (!farmModels) throw new InsidiousError('DOM: #content_value div.vis div form table.vis tbody');

        // Recolhe dados sobre os modelos salvos.
        // farmModels.firstElementChild é a linha com os ícones acima da área de input do modelo A.
        if (!farmModels.firstElementChild) throw new InsidiousError('Não foi possível obter a linha principal da tabela de modelos A.');

        // Linha com os campos do modelo A.
        const aRow = farmModels.firstElementChild.nextElementSibling;
        if (!aRow) throw new InsidiousError('Não foi possível encontrar a linha do modelo A.')
        
        // São ao menos sete campos em cada modelo.
        // Em mundos com arqueiros esse número é maior.
        const farmModelsInputFields = farmModels.querySelectorAll('tr td input[type=\"text\"][name]');
        if (farmModelsInputFields.length < 14) throw new InsidiousError('Não foi possível encontrar os campos de texto dos modelos.');

        // Quantidade de tropas em cada modelo.
        const eachModelUnitAmount = new ModelUnitAmount(farmModelsInputFields, aRow);

        // Salva os modelos no banco de dados.
        Store.set({ [Keys.plunderA]: eachModelUnitAmount.a, [Keys.plunderB]: eachModelUnitAmount.b })
            .catch((err: unknown) => InsidiousError.handle(err));

    
        // Configura o botão de saque de acordo com o status do plunder.
        // Se o plunder já estiver marcado como ativo, ele iniciará automaticamente.
        Store.get(Keys.plunder)
            .then((result: boolean | undefined) => this.appendButtons(result))
            .catch((err: unknown) => InsidiousError.handle(err));
    };

    private static async appendButtons(plunderStatus: boolean | undefined) {
        for (const value of Object.values(Farm.menu.button)) {
            this.menu.section.button.appendChild(value);
        };

        switch (plunderStatus) {
            case true:
                this.menu.button.plunder.textContent = 'Parar';
                return Plunder.start();
            case false:
                this.menu.button.plunder.textContent = 'Saquear';
                return Store.remove(Keys.totalPlundered);
            default:
                this.menu.button.plunder.textContent = 'Saquear';
                return Store.set({ [Keys.plunder]: false });
        };
    };
    
    /** Inicia ou para o plunder. */
    static async togglePlunder() {
        try {
            Farm.menu.button.plunder.removeEventListener('click', Farm.togglePlunder);
            Manatsu.removeChildren(Farm.menu.section.action);

            const plunderStatus = await Store.get(Keys.plunder) as boolean | undefined;
            // Se estiver ativo, desativa-o e troca o texto do botão.
            // Além disso, salva a quantia saqueada no histórico global e remove o histórico de navegação.
            if (plunderStatus === true) {
                await Farm.setGlobalAndLastPlundered();
                await Store.remove(Keys.plunderNavigation);
                await Store.set({ [Keys.plunder]: false });
                Farm.menu.button.plunder.textContent = 'Saquear';

                // Mapa contendo os modelos C salvos durante a execução do Plunder.
                Plunder.cmodel.clear();

                Plunder.eventTarget.dispatchEvent(new Event('stopplundering'));
                Plunder.eventTarget.dispatchEvent(new Event('cancelautoreload'));

                // Horário do próximo recarregamento automático da página.
                const nextAutoReloadDate = document.querySelector('#insidious_nextAutoReloadDate');
                if (nextAutoReloadDate) Manatsu.remove(nextAutoReloadDate);

            // Caso contrário, ativa-o.
            } else if (plunderStatus === false) {
                await Store.remove(Keys.totalPlundered);
                await Store.set({ [Keys.plunder]: true });
                Farm.menu.button.plunder.textContent = 'Parar';
                Plunder.start();
            };

            Farm.menu.button.plunder.addEventListener('click', Farm.togglePlunder);

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    /** Abre um modal que exibe as opções do Plunder. */
    static async toggleOptions() {
        // Se o menu de opções for aberto antes que o Plunder tenha sido executado alguma vez, Plunder.options será undefined.
        if (!Plunder.options) Plunder.options = await Store.get(Keys.plunderOptions) as PlunderOptions ?? {};

        // Abre a janela modal.
        Utils.createModal('Opções', true, { caller: 'plunder_options' });
        const modalWindow = document.querySelector('#insidious_modal');
        if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

        // Adiciona as opções disponíveis.
        if (this.config.size === 0) this.createOptions();
        const styleList = { style: 'text-align: left;' };
        this.config.forEach((option) => Manatsu.createAllInside(option, 2, [modalWindow, styleList]));

        const optionsCtrl = new AbortController();

        // Ataca de múltiplas aldeias.
        const groupAttack = modalWindow.querySelector('#insidious_group_attack_checkbox') as HTMLInputElement;
        if (Plunder.options.group_attack === true) groupAttack.checked = true;
        groupAttack.addEventListener('change', async (e) => {
            optionsCtrl.abort();
            await this.saveOptions(e.target, 'group_attack');
            setTimeout(() => window.location.reload(), Utils.responseTime);
        }, { signal: optionsCtrl.signal });

        // Ignora aldeias com muralha.
        const ignoreWall = modalWindow.querySelector('#insidious_ignore_wall_checkbox') as HTMLInputElement;
        if (Plunder.options.ignore_wall === true) ignoreWall.checked = true;
        ignoreWall.addEventListener('change', (e) => {
            this.saveOptions(e.target, 'ignore_wall');
        }, { signal: optionsCtrl.signal });

        // Destrói muralhas.
        const destroyWall = modalWindow.querySelector('#insidious_destroy_wall_checkbox') as HTMLInputElement;
        if (Plunder.options.destroy_wall === true) destroyWall.checked = true;
        destroyWall.addEventListener('change', (e) => {
            this.saveOptions(e.target, 'destroy_wall');
        }, { signal: optionsCtrl.signal });

        // Usa o modelo C para atacar.
        const useCModel = modalWindow.querySelector('#insidious_use_c') as HTMLInputElement;
        if (Plunder.options.use_c === true) useCModel.checked = true;
        useCModel.addEventListener('change', (e) => {
            this.saveOptions(e.target, 'use_c');
        }, { signal: optionsCtrl.signal });

        // Ataca rapidamente, enviando vários ataques simultaneamente.
        const rushMode = modalWindow.querySelector('#insidious_rush_mode') as HTMLInputElement;
        if (Plunder.options.rush_mode === true) rushMode.checked = true;
        rushMode.addEventListener('change', (e) => {
            this.saveOptions(e.target, 'rush_mode');
        }, { signal: optionsCtrl.signal });

        // Fecha a janela modal.
        new Manatsu('button', modalWindow, { class: 'insidious_modalButton', text: 'Fechar' }).createInside('div')
            .addEventListener('click', () => {
                optionsCtrl.abort();
                Utils.closeModal();
            }, { signal: optionsCtrl.signal });
    };

    static async toggleInfo() {
        let lastPlundered = await Store.get(Keys.lastPlundered) as TotalPlundered | undefined;
        if (!lastPlundered) lastPlundered = new NothingPlundered();

        let globalPlundered = await Store.get(Keys.globalPlundered) as TotalPlundered | undefined;
        if (!globalPlundered) globalPlundered = new NothingPlundered();

        // Abre a janela modal.
        Utils.createModal('Informações', true);
        const modalWindow = document.querySelector('#insidious_modal');
        if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

        const containers = Manatsu.repeat(2, modalWindow, false, { class: 'nowrap' }) as Manatsu[];

        new Manatsu('h2', modalWindow, { text: 'Último saque' }).create();
        Utils.showResourceIcons(lastPlundered, containers[0].create(), true);

        new Manatsu('h2', modalWindow, { text: 'Total saqueado' }).create();
        Utils.showResourceIcons(globalPlundered, containers[1].create(), true);
        
        // Fecha a janela modal.
        new Manatsu('button', modalWindow, { class: 'insidious_modalButton', text: 'Fechar' }).createInside('div')
            .addEventListener('click', () => Utils.closeModal());
    };

    /**
     * Salva o status atual da opção no banco de dados.
     * @param target - Elemento correspondente à opção.
     * @param name - Nome da opção.
     */
    private static async saveOptions(target: EventTarget | null, name: keyof PlunderOptions) {
        try {
            if (target instanceof HTMLInputElement) {
                if (target.checked === true) {
                    Plunder.options[name] = true;
                } else {
                    Plunder.options[name] = false;
                };
            };

            await Store.set({ [Keys.plunderOptions]: Plunder.options });

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static async info() {
        try {
            // Célula usada como referência.
            const spearElem = document.querySelector('#farm_units #units_home tbody tr td#spear');
            if (!spearElem) throw new InsidiousError('DOM: #farm_units #units_home tbody tr td#spear');
    
            // Tabela com as tropas disponíveis.
            if (!spearElem.parentElement) throw new InsidiousError('Não foi possível encontrar a linha que abriga a lista de tropas disponíveis.');
            spearElem.parentElement.setAttribute('insidious-available-unit-table', 'true');
    
            // É necessário verificar se o mundo possui arqueiros.
            if (!Game.worldInfo.game) {
                await Store.remove(Keys.worldConfig);
                throw new InsidiousError('Não foi possível obter as configurações do mundo.');
            };
    
            /** Retorna uma array com as tropas disponíveis no mundo atual (aquelas que podem saquear). */
            const getFarmUnits = () => {
                switch (Game.worldInfo.game.archer) {
                    case 0: return Assets.list.farm_units;
                    case 1: return Assets.list.farm_units_archer;
                    default: return Assets.list.farm_units;
                };
            };
    
            getFarmUnits().forEach((unit) => {
                const unitElem = document.querySelector(`#farm_units #units_home tbody tr td#${unit}`);
                if (!unitElem) throw new InsidiousError(`DOM: #farm_units #units_home tbody tr td#${unit}`);
                unitElem.setAttribute('insidious-available-units', unit);
            });

            /** 
             * Lista das aldeias que já foram atacadas alguma vez.
             * É usado no mapa para marcar as aldeias que ainda não foram alguma vez atacadas.
             */
            const attackHistory = await Store.get(Keys.alreadyPlundered) as string[] ?? [];
            const alreadyPlunderedVillages: Set<string> = new Set(attackHistory);
    
            /** Ajuda a controlar o MutationObserver. */
            const infoEventTarget = new EventTarget();
    
            /** Adiciona informações úteis às tags HTML originais da página. */
            const addInfo = async () => {
                // Desconecta qualquer observer que esteja ativo.
                infoEventTarget.dispatchEvent(new Event('stopinfoobserver'));

                try {
                    const plunderListRows = document.querySelectorAll('#plunder_list tbody tr[id^="village_"]');
                    for (const row of Array.from(plunderListRows)) {
                        if (!row.hasAttribute('insidious-village')) {
                            // A coerção à string é válida pois já foi verificada a existência do id ao usar querySelectorAll();
                            let villageID = row.getAttribute('id') as string;
                            villageID = villageID.replace(/\D/g, '');

                            // Salva a aldeia na lista de aldeias já atacadas.
                            alreadyPlunderedVillages.add(villageID);

                            row.setAttribute('insidious-village', villageID);
                            // Esse atributo é utilizado pela função sendAttack() do Plunder.
                            // É selecionando ele que o Plunder tem acesso às linhas da tabela.
                            row.setAttribute('insidious-tr-farm', 'true');

                            // Relatório.
                            const reportLink = row.querySelector('td a[href*="screen=report" i]');
                            if (!reportLink) throw new InsidiousError(`Não foi possível encontrar o link do relatório (${villageID}).`);
                            reportLink.setAttribute('insidious-td-type', 'report');
                            
                            // Data do último ataque.
                            /**
                             * Vasculha as células da linha até encontrar a que contém a data.
                             * @returns A célula com a data do último ataque.
                             */
                            const findDateField = (): HTMLTableCellElement | null => {
                                const fields = row.querySelectorAll('td');
                                for (const field of Array.from(fields)) {
                                    if (!field.textContent) continue;
                                    const date = this.decipherPlunderListDate(field.textContent);
                                    if (!date) continue;

                                    row.setAttribute('insidious-date', String(date));
                                    return field;
                                };

                                return null;
                            };

                            const lastBattleDate = findDateField();
                            if (!lastBattleDate) throw new InsidiousError(`Não foi possível encontrar o campo com a data do último ataque (${villageID}).`);
                            lastBattleDate.setAttribute('insidious-td-type', 'date');
        
                            // Quantidade de recursos.
                            const findResourcesField = (): HTMLElement | null => {
                                const fields = row.querySelectorAll('td');
                                for (const field of Array.from(fields)) {
                                    const woodField = field.querySelector('span span[class*="wood"] + span');
                                    const stoneField = field.querySelector('span span[class*="stone"] + span');
                                    const ironField = field.querySelector('span span[class*="iron"] + span');
                                    if (!woodField || !stoneField || !ironField) continue;

                                    let totalAmount: number = 0;
                                    [woodField, stoneField, ironField].forEach((resField) => {
                                        let resAmount: string | null = resField.textContent;
                                        if (resAmount === null) throw new InsidiousError(`Os campos de recursos foram encontrados, mas estão vazios (${villageID}).`);
                                        resAmount = resAmount.replace(/\D/g, '');

                                        // Adiciona o valor à quantia total.
                                        const parsedResAmount = Number.parseInt(resAmount, 10);
                                        if (!Number.isNaN(parsedResAmount)) {
                                            totalAmount += parsedResAmount;
                                        } else {
                                            throw new InsidiousError(`A quantia de recursos calculada não é válida (${villageID}).`);
                                        };

                                        // A coerção é possível pois a existência já foi verificada ao usar querySelector com o seletor "+".
                                        let resType = resField.previousElementSibling!.getAttribute('class') as string;
                                        const resName = Assets.list.resources.some((name) => {
                                            if (resType.includes(name)) {
                                                resType = name;
                                                return true;
                                            };

                                            return false;
                                        });

                                        if (resName === false) throw new InsidiousError(`Não foi possível determinar o tipo de recurso (${villageID}).`);
                                        row.setAttribute(`insidious-${resType}`, resAmount);  
                                    });

                                    field.setAttribute('insidious-td-type', 'resources');
                                    row.setAttribute('insidious-resources', String(totalAmount));

                                    // Indica que exploradores obtiveram informações sobre a aldeia.
                                    row.setAttribute('insidious-spy-status', 'true');
                                    return field;
                                };
                          
                                // Caso não hajam informações de exploradores, marca com os atributos adequados.
                                row.setAttribute('insidious-resources', 'unknown');
                                row.setAttribute('insidious-spy-status', 'false');
                                return null;
                            };

                            const expectedResources = findResourcesField();
                            // O campo da muralha depende da posição do campo de recursos para ser encontrado.
                            if (expectedResources !== null) {
                                // Muralha.
                                const wallLevelField = expectedResources.nextElementSibling;
                                if (!wallLevelField) throw new InsidiousError(`O campo com o nível da muralha não foi encontrado (${villageID}).`);

                                // Verifica se o elemento irmão ao de recursos realmente descreve o nível da muralha.
                                let wallLevel: string | null = wallLevelField.textContent;
                                if (wallLevel !== null) {
                                    const parsed = Number.parseInt(wallLevel, 10);
                                    if (!Number.isInteger(parsed)) {
                                        throw new InsidiousError(`O valor encontrado não corresponde ao nível da muralha (${villageID}).`);
                                    };

                                    row.setAttribute('insidious-wall', wallLevel);
                                    wallLevelField.setAttribute('insidious-td-type', 'wall');
                                } else {
                                    throw new InsidiousError(`O nível da muralha não foi encontrado (${villageID}).`);
                                };
                            };

                            // Não pode haver emissão de erro caso os botões não forem encontrados.
                            // Isso porquê eles naturalmente não estarão presentes caso não haja modelo registrado.
                            // A
                            const aFarmBtn = row.querySelector('td a[class*="farm_icon_a" i]:not([class*="disabled" i])');
                            if (aFarmBtn) aFarmBtn.setAttribute('insidious-farm-btn', `a_${villageID}`);
                                    
                            // B
                            const bFarmBtn = row.querySelector('td a[class*="farm_icon_b" i]:not([class*="disabled" i])');
                            if (bFarmBtn) bFarmBtn.setAttribute('insidious-farm-btn', `b_${villageID}`);
        
                            // C
                            const cFarmBtn = row.querySelector('td a[class*="farm_icon_c" i][onclick]');
                            if (cFarmBtn) {
                                cFarmBtn.setAttribute('insidious-farm-btn', `c_${villageID}`);

                                // Verifica o status do botão C.
                                const cFarmBtnStatus = cFarmBtn.getAttribute('class');
                                if (cFarmBtnStatus?.includes('disabled')) {
                                    row.setAttribute('insidious-c-btn', 'off');
                                } else {
                                    row.setAttribute('insidious-c-btn', 'on');
                                };
                            };

                            // Praça de reunião.
                            const placeButton = row.querySelector('td a[href*="screen=place" i][onclick]');
                            if (!placeButton) throw new InsidiousError(`O botão para praça de reunião não foi encontrado. ${villageID}`);
                            placeButton.setAttribute('insidious-td-type', 'place');
                            placeButton.setAttribute('insidious-place-btn', `place_${villageID}`);
                        };
                    };

                    // Se novas aldeias foram encontradas, salva-as no banco de dados.
                    if (alreadyPlunderedVillages.size > attackHistory.length) {
                        Store.set({ [Keys.alreadyPlundered]: Array.from(alreadyPlunderedVillages) })
                            .catch((err: unknown) => InsidiousError.handle(err));
                    };

                } catch (err) {
                    InsidiousError.handle(err);
                };
    
                ////// CONTROLE DE EVENTOS
                const plunderList = document.querySelector('table#plunder_list');
                if (!plunderList) throw new InsidiousError('DOM: table#plunder_list.');

                // Dispara a função novamente caso surjam alterações na tabela.
                const observeTable = new MutationObserver(() => addInfo());
                observeTable.observe(plunderList, { subtree: true, childList: true });
    
                // Caso a função seja chamada novamente, desconecta o observer ativo.
                const farmTableCtrl = new AbortController();
                infoEventTarget.addEventListener('stopinfoobserver', () => {
                    observeTable.disconnect();
                    farmTableCtrl.abort();
                }, { signal: farmTableCtrl.signal });
            };
    
            // Inicia a adição dos dados.
            await addInfo();

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static createOptions() {
        // Ataca de múltiplas aldeias usando um grupo como referência.
        // O nome do grupo obrigatoriamente precisa ser Insidious.
        this.config.set('group_attack', Manatsu.createCheckbox({
            id: 'insidious_group_attack_checkbox',
            label: 'Usar grupo'
        }, false) as Manatsu[]);

        // Não ataca aldeias que tenham muralha.
        this.config.set('ignore_wall', Manatsu.createCheckbox({
            id: 'insidious_ignore_wall_checkbox',
            label: 'Ignorar muralha'
        }, false) as Manatsu[]);

        // Envia ataques com aríetes em aldeias com muralha.
        // Independe de como "ignorar muralha" está configurado.
        this.config.set('destroy_wall', Manatsu.createCheckbox({
            id: 'insidious_destroy_wall_checkbox',
            label: 'Demolir muralha'
        }, false) as Manatsu[]);

        // Ataca usando o modelo C.
        this.config.set('use_c', Manatsu.createCheckbox({
            id: 'insidious_use_c',
            label: 'Usar C'
        }, false) as Manatsu[]);

        // Rush Mode
        this.config.set('rush_mode', Manatsu.createCheckbox({
            id: 'insidious_rush_mode',
            label: 'Atacar rapidamente'
        }, false) as Manatsu[]);
    };

    /**
     * Verifica se o campo corresponde à data do último ataque.
     * Em caso positivo, converte o valor para milisegundos.
     * 
     * Exemplos de data: hoje às 00:05:26 | ontem às 16:29:50 | em 21.09. às 12:36:38
     * @param date - Texto do campo a analisar.
     * @returns Data do último ataque em milisegundos.
     */
    private static decipherPlunderListDate(date: string): number | null {
        const writtenDate = date.toLowerCase();
        if (!writtenDate.includes('às')) return null;

        // splitDate representa apenas as horas, os minutos e os segundos.
        const splitDate: string | undefined = writtenDate.split(' ').pop();
        if (splitDate) {
            const date = splitDate.split('\:').map((item) => Number.parseInt(item, 10));
            if (date.length !== 3) return null;
            if (date.some((item) => Number.isNaN(item))) return null;

            // Se o ataque foi hoje, toma o horário atual e apenas ajusta a hora, os minutos e os segundos.
            if (writtenDate.includes('hoje')) {       
                return new Date().setHours(date[0], date[1], date[2]);

            // Se foi ontem, faz a mesma coisa, mas remove 24 horas do resultado.
            } else if (writtenDate.includes('ontem')) {
                const yesterday = Date.now() - (3600000 * 24);
                return new Date(yesterday).setHours(date[0], date[1], date[2]);

            } else if (writtenDate.includes('em')) {
                // Em outros cenários, também altera o dia e o mês.
                let dayAndMonth: string | number[] = (writtenDate.split(' '))[1];
                dayAndMonth = dayAndMonth.split('.').map((item: string) => Number.parseInt(item, 10));
                dayAndMonth.filter((item) => !Number.isNaN(item));

                let anyDay = new Date().setHours(date[0], date[1], date[2]);
                // O valor para o mês começa com índice zero, por isso é preciso diminuir em 1.
                anyDay = new Date(anyDay).setMonth(dayAndMonth[1] - 1, dayAndMonth[0]);

                // Caso essa condição for verdadeira, há diferença de ano entre a data atual e a data do ataque.
                if (anyDay > Date.now()) {
                    throw new InsidiousError('Issue #2: https://github.com/ferreira-tb/insidious/issues/2#issue-1383251210');
                };
                
                return anyDay;
            };
        };

        return null;
    };

    /** Atualiza a quantia total de recursos saqueados e ataques enviados pelo Plunder no mundo atual. */
    protected static async setGlobalAndLastPlundered() {
        const totalPlundered = await Store.get(Keys.totalPlundered) as TotalPlundered | undefined;
        if (!totalPlundered) return;
        let globalPlundered = await Store.get(Keys.globalPlundered) as TotalPlundered | undefined;
        if (!globalPlundered) globalPlundered = new NothingPlundered();

        for (const [key, value] of Object.entries(totalPlundered) as TotalPlunderedEntries) {
            if (!Number.isInteger(value)) continue;
            globalPlundered[key] = globalPlundered[key] + totalPlundered[key];
        };

        const lastPlundered = new LastPlundered(totalPlundered);
        Store.set({ [Keys.globalPlundered]: globalPlundered })
            .then(() => Store.set({ [Keys.lastPlundered]: lastPlundered }))
            .catch((err: unknown) => InsidiousError.handle(err));
    };
};