class TWFarm {
    /** Botões do Plunder. */
    static menu: PlunderButtons;
    /** Mapa com as informações sobre cada aldeia da tabela. */
    static readonly village_info: Map<string, PlunderVillageInfo> = new Map();
    /** Mapa com os elementos que constituem o menu de opções do Plunder. */
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
            .then((status: boolean | undefined) => this.appendButtons(status))
            .catch((err: unknown) => InsidiousError.handle(err));
    };

    /** Cria os botões e salva o status atual do Plunder. */
    private static async appendButtons(status: boolean | undefined) {
        for (const value of Object.values(TWFarm.menu.button)) {
            this.menu.section.button.appendChild(value);
        };

        if (status !== undefined) Plunder.status.active = status;

        switch (status) {
            case true:
                this.menu.button.plunder.textContent = 'Parar';
                return Plunder.start();
            case false:
                this.menu.button.plunder.textContent = 'Saquear';
                return Store.remove(Keys.totalPlundered);
            default:
                Plunder.status.active = false;
                this.menu.button.plunder.textContent = 'Saquear';
                return Store.set({ [Keys.plunder]: false });
        };
    };
    
    /** Inicia ou para o plunder. */
    static async togglePlunder() {
        try {
            TWFarm.menu.button.plunder.removeEventListener('click', TWFarm.togglePlunder);
            Manatsu.removeChildren(TWFarm.menu.section.action);

            // Se estiver ativo, desativa-o e troca o texto do botão.
            // Além disso, salva a quantia saqueada no histórico global e remove o histórico de navegação.
            if (Plunder.status.active === true) {
                await TWFarm.savePlunderedAmounts();
                await Store.remove(Keys.plunderNavigation);
                await Store.set({ [Keys.plunder]: false });
                TWFarm.menu.button.plunder.textContent = 'Saquear';
                Plunder.status.active = false;

                // Elimina todos os registros feitos durante os ataques.
                TWFarm.clearAllRecords();

                Plunder.eventTarget.dispatchEvent(new Event('stopplundering'));
                Plunder.eventTarget.dispatchEvent(new Event('cancelautoreload'));

                // Horário do próximo recarregamento automático da página.
                const nextAutoReloadDate = document.querySelector('#ins_next_auto_reload');
                if (nextAutoReloadDate) Manatsu.remove(nextAutoReloadDate);

                const message = new UIMessage('O saque foi interrompido.');
                Insidious.showUIMessage(message);

            // Caso contrário, ativa-o.
            } else if (Plunder.status.active === false) {
                await Store.remove(Keys.totalPlundered);
                await Store.set({ [Keys.plunder]: true });
                TWFarm.menu.button.plunder.textContent = 'Parar';
                Plunder.status.active = true;
                Plunder.start();

                const message = new UIMessage('Saque iniciado.');
                Insidious.showUIMessage(message);
            };

            TWFarm.menu.button.plunder.addEventListener('click', TWFarm.togglePlunder);

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    /** Abre um modal que exibe as opções do Plunder. */
    static async toggleOptions() {
        try {
            // Se o menu de opções for aberto antes que o Plunder tenha sido executado alguma vez, Plunder.options será undefined.
            if (!Plunder.options) Plunder.options = await Plunder.setPlunderOptions();

            // Abre a janela modal.
            Utils.createModal('Opções', true, { caller: 'plunder_options' });
            const modalWindow = document.querySelector('#ins_modal') as HTMLDivElement | null;
            if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

            // Áreas do modal.
            const containerStyle = 'display: flex; text-align: left;';
            const container = modalWindow.appendManatsu({ style: containerStyle });

            const checkboxArea = new Manatsu(container, { style: 'padding-right: 5px;' }).create();
            const inputArea = new Manatsu(container, { style: 'padding-left: 5px;' }).create();

            // Adiciona as opções disponíveis.
            if (this.config.size === 0) this.createOptions();
            this.config.forEach((value, key) => {
                const callback = (item: string) => item === key;
                if (Options.plunder.number.some(callback)) {
                    Manatsu.createAllInside(value, 2, [inputArea, { style: 'padding-top: 2px;' }]);
                } else {
                    Manatsu.createAllInside(value, 2, [checkboxArea]);
                };
            });

            const optionsCtrl = new AbortController();

            Options.plunder.checkbox.forEach((option) => {
                const checkbox = checkboxArea.querySelector(`#ins_${option}`) as HTMLInputElement;
                if (Plunder.options[option] === true) checkbox.checked = true;

                if (option === 'group_attack') {
                    if (Game.village_amount < 2) checkbox.setAttribute('disabled', '');

                    checkbox.addEventListener('change', async (e) => {
                        optionsCtrl.abort();
                        await this.saveOptions(e.target, option);
                        location.reload();
                    });

                } else {
                    checkbox.addEventListener('change', (e) => {
                        this.saveOptions(e.target, option);
                    }, { signal: optionsCtrl.signal });
                };

            }, this);

            Options.plunder.number.forEach((option) => {
                const inputElement = inputArea.querySelector(`#ins_${option}`) as HTMLInputElement;
                inputElement.value = Plunder.options[option].toFixed(0);

                if (option === 'max_distance') inputElement.setAttribute('disabled', '');

                inputElement.addEventListener('change', (e) => {
                    this.saveOptions(e.target, option);
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

    static async toggleInfo() {
        let lastPlundered = await Store.get(Keys.lastPlundered) as TotalPlundered | undefined;
        if (!lastPlundered) lastPlundered = new NothingPlundered();

        let globalPlundered = await Store.get(Keys.globalPlundered) as TotalPlundered | undefined;
        if (!globalPlundered) globalPlundered = new NothingPlundered();

        // Abre a janela modal.
        Utils.createModal('Informações', true);
        const modalWindow = document.querySelector('#ins_modal');
        if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

        const containers = Manatsu.repeat(2, modalWindow, false, { class: 'nowrap' }) as Manatsu[];

        new Manatsu('h2', modalWindow, { text: 'Último saque' }).create();
        Utils.showResourceIcons(lastPlundered, containers[0].create(), true);

        new Manatsu('h2', modalWindow, { text: 'Total saqueado' }).create();
        Utils.showResourceIcons(globalPlundered, containers[1].create(), true);
        
        // Fecha a janela modal.
        new Manatsu('button', modalWindow, { class: 'ins_modal_btn', text: 'Fechar' }).createInside('div')
            .addEventListener('click', () => Utils.closeModal());
    };

    /**
     * Salva o status atual da opção no banco de dados.
     * @param target - Elemento correspondente à opção.
     * @param name - Nome da opção.
     */
    private static async saveOptions(target: EventTarget | null, name: keyof PlunderOptions & string) {
        if (!(target instanceof HTMLInputElement)) return;

        try {
            switch (target.getAttribute('type') as InputElement | null) {
                case 'checkbox':
                    Plunder.options[name as keyof PlunderCheckboxOptions] = target.checked;
                    break;
                case 'number':
                    Plunder.options[name as keyof PlunderInputOptions] = Number.parseInt(target.value, 10);
                    break;
            };

            await Store.set({ [Keys.plunderOptions]: Plunder.options[Keys.master] });

            const message = new UIMessage('Salvo.');
            Insidious.showUIMessage(message);

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static async info() {
        try {
            /** 
             * Lista das aldeias que já foram atacadas alguma vez.
             * É usado no mapa para marcar as aldeias que ainda não foram alguma vez atacadas.
             */
            const attackHistory = await Store.get(Keys.alreadyPlundered) as string[] ?? [];
            const alreadyPlundered: Set<string> = new Set(attackHistory);
    
            /** Ajuda a controlar o MutationObserver. */
            const infoEventTarget = new EventTarget();
    
            /** Salva informações úteis a respeito de cada aldeia da tabela. */
            const getInfo = () => {
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
                            alreadyPlundered.add(villageID);

                            // Armazena as informações sobre a aldeia.
                            const info = new PlunderVillageInfo();

                            // Facilita o acesso ao id da aldeia.
                            row.setAttribute('insidious-village', villageID);

                            // Relatório e data do último ataque.
                            const fields = row.querySelectorAll('td');
                            for (const field of Array.from(fields)) {
                                if (!field.textContent) continue;

                                const coords = Utils.getCoordsFromTextContent(field.textContent);
                                if (coords) {
                                    info.distance = Utils.calcDistance(Game.x, Game.y, coords[0], coords[1]);
                                    continue;
                                };

                                const date = Utils.parseGameDate(field.textContent);
                                if (!date) continue;
                                info.last_attack = date;
                            };

                            if (!info.last_attack) throw new InsidiousError(`Não foi possível determinar a data do último ataque (${villageID}).`);
        
                            // Quantidade de recursos.
                            const findResourcesField = (): HTMLElement | null => {
                                const fields = row.querySelectorAll('td');
                                for (const field of Array.from(fields)) {
                                    const woodField = field.querySelector('span span[class*="wood"] + span');
                                    const stoneField = field.querySelector('span span[class*="stone"] + span');
                                    const ironField = field.querySelector('span span[class*="iron"] + span');
                                    if (!woodField || !stoneField || !ironField) continue;

                                    [woodField, stoneField, ironField].forEach((resField) => {
                                        let resAmount = resField.textContent;
                                        if (!resAmount) throw new InsidiousError(`A quantidade de recursos é inválida (${villageID}).`);
                                        resAmount = resAmount.replace(/\D/g, '');

                                        // Adiciona o valor à quantia total.
                                        const parsedResAmount = Number.parseInt(resAmount, 10);
                                        if (!Number.isNaN(parsedResAmount)) {
                                            info.total += parsedResAmount;
                                        } else {
                                            throw new InsidiousError(`A quantidade de recursos calculada não é válida (${villageID}).`);
                                        };

                                        // A coerção é possível pois a existência já foi verificada ao usar querySelector com "+".
                                        const className = resField.previousElementSibling!.getAttribute('class') as string;
                                        let resType!: ResourceList;
                                        const resName = Assets.list.resources.some((name) => {
                                            if (className.includes(name)) {
                                                resType = name;
                                                return true;
                                            };

                                            return false;
                                        });

                                        if (resName === false) throw new InsidiousError(`Não foi possível determinar o tipo de recurso (${villageID}).`);
                                        info[resType] = parsedResAmount;
                                    });

                                    // Indica que exploradores obtiveram informações sobre a aldeia.
                                    info.spy_status = true;
                                    return field;
                                };
                          
                                return null;
                            };

                            const expectedResources = findResourcesField();
                            // O campo da muralha depende da posição do campo de recursos para ser encontrado.
                            if (expectedResources !== null) {
                                // Muralha.
                                const wallLevelField = expectedResources.nextElementSibling;
                                if (!wallLevelField) throw new InsidiousError(`O campo com o nível da muralha não foi encontrado (${villageID}).`);

                                // Verifica se o elemento irmão ao de recursos realmente descreve o nível da muralha.
                                const wallLevel = wallLevelField.textContent?.replace(/\D/g, '');
                                if (wallLevel) {
                                    info.wall = Number.parseInt(wallLevel, 10) as WallLevel;
                                    if (Number.isNaN(info.wall)) {
                                        throw new InsidiousError(`O valor encontrado não corresponde ao nível da muralha (${villageID}).`);
                                    };
                                    
                                } else {
                                    throw new InsidiousError(`O nível da muralha não foi encontrado (${villageID}).`);
                                };
                            };

                            // Não pode haver emissão de erro caso os botões não forem encontrados.
                            // Isso porquê eles naturalmente não estarão presentes caso não haja modelo registrado.
                            info.a_button = row.querySelector('td a[class*="farm_icon_a" i]:not([class*="disabled" i])');      
                            info.b_button = row.querySelector('td a[class*="farm_icon_b" i]:not([class*="disabled" i])');
        
                            // C
                            info.c_button = row.querySelector('td a[class*="farm_icon_c" i][onclick]');
                            if (info.c_button) {
                                // Verifica o status do botão C.
                                const cFarmBtnStatus = info.c_button.getAttribute('class');
                                if (!(cFarmBtnStatus?.includes('disabled'))) info.c_status = true;
                            };

                            // Praça de reunião.
                            info.place = row.querySelector('td a[href*="screen=place" i][onclick]');
                            if (!info.place) throw new InsidiousError(`O botão para praça de reunião não foi encontrado. ${villageID}`);

                            // Armazena os dados obtidos.
                            TWFarm.village_info.set(villageID, info);
                        };
                    };

                    // Se novas aldeias foram encontradas, salva-as no banco de dados.
                    if (alreadyPlundered.size > attackHistory.length) {
                        Store.set({ [Keys.alreadyPlundered]: Array.from(alreadyPlundered) })
                            .catch((err: unknown) => InsidiousError.handle(err));
                    };

                } catch (err) {
                    InsidiousError.handle(err);
                };
    
                ////// CONTROLE DE EVENTOS
                const plunderList = document.querySelector('table#plunder_list');
                if (!plunderList) throw new InsidiousError('DOM: table#plunder_list.');

                // Dispara a função novamente caso surjam alterações na tabela.
                const observeTable = new MutationObserver(() => getInfo());
                observeTable.observe(plunderList, { subtree: true, childList: true });
    
                // Caso a função seja chamada novamente, desconecta o observer ativo.
                const farmTableCtrl = new AbortController();
                infoEventTarget.addEventListener('stopinfoobserver', () => {
                    observeTable.disconnect();
                    farmTableCtrl.abort();
                }, { signal: farmTableCtrl.signal });
            };
    
            // Inicia a obtenção dos dados.
            getInfo();

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static createOptions() {
        Options.plunder.checkbox.forEach((option) => {
            const attributes = new InsidiousInputAttributes(option, 'checkbox');
            const checkbox = Manatsu.createLabeledInputElement('checkbox', attributes, false) as Manatsu[];
            this.config.set(option, checkbox);
        }, this);

        Options.plunder.number.forEach((option) => {
            const attributes = new InsidiousInputAttributes(option, 'number');
            const numberInput = Manatsu.createLabeledInputElement('number', attributes, false) as Manatsu[];
            this.config.set(option, numberInput);
        }, this);
    };

    /** Atualiza a quantia total de recursos saqueados e ataques enviados pelo Plunder no mundo atual. */
    private static async savePlunderedAmounts() {
        // Total saqueado na última execução do Plunder.
        const totalPlundered = await Store.get(Keys.totalPlundered) as TotalPlundered | undefined;
        if (!totalPlundered) return;

        // Soma dos recursos saqueados em todas as execuções do Plunder.
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

    private static clearAllRecords() {
        // Mapa contendo os modelos C salvos durante a execução do Plunder.
        Plunder.cmodel.clear();
        // Set contendo as aldeias aguardando ataques pelo modelo C.
        Plunder.waitingC.clear();
    };
};