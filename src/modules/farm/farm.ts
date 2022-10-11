class TWFarm {
    /** Chave para obter as informações sobre o modelo de saque A (amodel). */
    static readonly aKey = `amodel_${Insidious.world}`;
    /** Chave para obter as informações sobre o modelo de saque B (bmodel). */
    static readonly bKey = `bmodel_${Insidious.world}`;

    static async #open() {
        // Elementos originais.
        const plunderListFilters = document.querySelector('#plunder_list_filters');
        if (!plunderListFilters) throw new InsidiousError('DOM: #plunder_list_filters');

        const farmModels = document.querySelector('#content_value div.vis div form table.vis tbody');
        if (!farmModels) throw new InsidiousError('DOM: #content_value div.vis div form table.vis tbody');

        // Elementos da extensão.
        const menuArea = new Manatsu({ id: 'insidious_farmMenuArea' }).create();
        if (!plunderListFilters.parentNode) throw new InsidiousError('\"#insidious_farmMenuArea\" não pôde ser posicionado.');
        plunderListFilters.parentNode.insertBefore(menuArea, plunderListFilters.nextElementSibling);

        const buttonArea = new Manatsu({ id: 'insidious_farmButtonArea' }, menuArea).create();
        const optionsArea = new Manatsu({ id: 'insidious_farmOptionsArea' }, menuArea).create();
        const actionArea = new Manatsu({ id: 'insidious_farmActionArea' }, menuArea).create();

        ////// BOTÕES
        // Os botões são adicionados à página após o Insidious terminar de verificar o status do plunder.
        const startPlunderBtn = new Manatsu('button', {
            class: 'insidious_farmButtonArea_Btn',
            id: 'insidious_startPlunderBtn'
        }).create();

        const showOptionsBtn = new Manatsu('button', {
            class: 'insidious_farmButtonArea_Btn',
            id: 'insidious_showOptionsBtn',
            text: 'Opções'
        }).create();
        
        ////// OPÇÕES
        const optionsAreaItems: Manatsu[] = this.#createOptions();

        ////// DADOS
        await this.#info();

        // Recolhe dados sobre os modelos salvos.
        // farmModels.firstElementChild é a linha com os ícones acima da área de input do modelo A.
        if (!farmModels.firstElementChild) throw new InsidiousError('Não foi possível obter a linha principal da tabela de modelos A.');
        const aRow = farmModels.firstElementChild.nextElementSibling;
        const parentRow = { a: {}, b: {} };

        const farmModelsInputFields = farmModels.querySelectorAll('tr td input[type=\"text\"][name]');
        // Em mundos com arqueiros esse número é maior.
        if (farmModelsInputFields.length < 14) throw new InsidiousError('Não foi possível encontrar os campos de texto dos modelos.');

        for (const field of Array.from(farmModelsInputFields)) {
            const fieldName = field.getAttribute('name');
            if (!fieldName) throw new InsidiousError('O atributo \"name\" não foi encontrado nos campos de texto dos modelos.');

            const fieldType = fieldName.slice(0, fieldName.indexOf('\['));
            const fieldValue = field.getAttribute('value');
            if (fieldValue === null) throw new InsidiousError(`Não foi possível encontrar o valor do campo de texto \"${fieldType}\".`);

            // Verifica se o campo pertence ao modelo A.
            if (field.parentElement?.parentElement === aRow) {
                field.setAttribute('insidious-model-a', fieldType);
                Object.defineProperty(parentRow.a, fieldType, {
                    value: Number.parseInt(fieldValue, 10),
                    enumerable: true
                });

            // Em caso contrário, assume que pertence ao modelo B.
            } else {
                field.setAttribute('insidious-model-b', fieldType);
                Object.defineProperty(parentRow.b, fieldType, {
                    value: Number.parseInt(fieldValue, 10),
                    enumerable: true
                });
            };
        };

        // Salva os modelos no banco de dados.
        browser.storage.local.set({ [this.aKey]: parentRow.a, [this.bKey]: parentRow.b })
            .catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });

        ////// EVENTOS
        // Inicia ou para o plunder.
        const plunderBtnEvents = async () => {
            startPlunderBtn.removeEventListener('click', plunderBtnEvents);
            Manatsu.removeChildren(actionArea);

            try {
                // Insidious não pode realizar operações fetch enquanto o plunder estiver ativo.
                const plunderStatus = (await browser.storage.local.get(Plunder.key))[Plunder.key] as boolean | undefined;
                // Se estiver ativo no momento do clique, desativa o plunder e troca o texto do botão.
                if (plunderStatus === true) {
                    await browser.storage.local.set({ [Plunder.key]: false });
                    startPlunderBtn.textContent = 'Saquear';

                // Em caso contrário, ativa o plunder.
                } else if (plunderStatus === false) {
                    await browser.storage.local.set({ [Plunder.key]: true });
                    await browser.storage.local.remove(Plunder.totalKey);
                    startPlunderBtn.textContent = 'Parar';
                    Plunder.start();
                };

            } catch (err) {
                if (err instanceof Error) InsidiousError.handle(err);

            } finally {
                startPlunderBtn.addEventListener('click', plunderBtnEvents);
            };
        };

        startPlunderBtn.addEventListener('click', plunderBtnEvents);

        // Exibe as opções do plunder.
        const optionsBtnEvents = async () => {
            if (!Plunder.options) {
                // Se o menu de opções for aberto antes que o Plunder tenha sido executado alguma vez, Plunder.options estará indefinido.
                Plunder.options = (await browser.storage.local.get(Plunder.optionsKey))[Plunder.optionsKey] as PlunderOptions ?? {};
            };

            Manatsu.createAll(optionsAreaItems);
            showOptionsBtn.setAttribute('disabled', '');

            const optionsCtrl = new AbortController();

            // Ataca de múltiplas aldeias.
            const groupAttack = optionsArea.querySelector('#insidious_group_attack_checkbox') as HTMLInputElement;
            if (Plunder.options.group_attack === true) groupAttack.checked = true;
            groupAttack.addEventListener('change', async (e) => {
                optionsCtrl.abort();
                await this.#saveOptions(e, 'group_attack');
                setTimeout(() => window.location.reload(), Utils.getResponseTime());
            }, { signal: optionsCtrl.signal });

            // Ignora aldeias com muralha.
            const ignoreWall = optionsArea.querySelector('#insidious_ignore_wall_checkbox') as HTMLInputElement;
            if (Plunder.options.ignore_wall === true) ignoreWall.checked = true;
            ignoreWall.addEventListener('change', (e) => this.#saveOptions(e, 'ignore_wall'), { signal: optionsCtrl.signal });

            // Destrói muralhas.
            const destroyWall = optionsArea.querySelector('#insidious_destroy_wall_checkbox') as HTMLInputElement;
            if (Plunder.options.destroy_wall === true) destroyWall.checked = true;
            destroyWall.addEventListener('change', (e) => this.#saveOptions(e, 'destroy_wall'), { signal: optionsCtrl.signal });

            new Manatsu('button', optionsArea, { text: 'Fechar' }).createInside('div')
                .addEventListener('click', () => {
                    optionsCtrl.abort();
                    Manatsu.removeChildren(optionsArea);
                    showOptionsBtn.removeAttribute('disabled');
                }, { signal: optionsCtrl.signal });
        };

        showOptionsBtn.addEventListener('click', optionsBtnEvents);

        // Configura o botão de saque de acordo com o status do plunder.
        // Além disso, se o plunder já estiver marcado como ativo, chama Plunder.start() automaticamente.
        browser.storage.local.get(Plunder.key)
            .then((result: SBObject) => {
                buttonArea.appendChild(startPlunderBtn);
                buttonArea.appendChild(showOptionsBtn);

                if (result[Plunder.key] === true) {
                    startPlunderBtn.textContent = 'Parar';
                    Plunder.start();

                // Caso não esteja ativo, apaga o histórico de recursos saqueados.
                } else if (result[Plunder.key] === false) {
                    startPlunderBtn.textContent = 'Saquear';
                    browser.storage.local.remove(`totalPlundered_${Insidious.world}`);

                } else if (result[Plunder.key] === undefined) {
                    startPlunderBtn.textContent = 'Saquear';
                    browser.storage.local.set({ [Plunder.key]: false });
                };

            }).catch((err: unknown) => {
                if (err instanceof Error) {
                    // Caso haja algum erro, desativa o plunder, por segurança.
                    browser.storage.local.set({ [Plunder.key]: false });
                    InsidiousError.handle(err);
                };
            });
    };

    static async #saveOptions(event: Event, item: keyof PlunderOptions) {
        if (event.target instanceof HTMLInputElement) {
            if (event.target.checked === true) {
                Plunder.options[item] = true;
            } else {
                Plunder.options[item] = false;
            };
        };
        
        try {
            await browser.storage.local.set({ [Plunder.optionsKey]: Plunder.options });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static async #info() {
        try {
            // Célula de referência.
            const spearElem = document.querySelector('#farm_units #units_home tbody tr td#spear');
            if (!spearElem) throw new InsidiousError('DOM: #farm_units #units_home tbody tr td#spear');
    
            // Tabela com as tropas disponíveis.
            if (!spearElem.parentElement) throw new InsidiousError('Não foi possível encontrar a linha que abriga a lista de tropas disponíveis.');
            spearElem.parentElement.setAttribute('insidious-available-unit-table', 'true');
    
            // É necessário verificar se o mundo possui arqueiros.
            if (!Insidious.worldInfo.game) {
                await browser.storage.local.remove(Insidious.worldConfigKey);
                throw new InsidiousError('Não foi possível obter as configurações do mundo.');
            };
    
            const isThereArchers = () => {
                switch (Insidious.worldInfo.game.archer) {
                    case 0: return TWAssets.list.farm_units;
                    case 1: return TWAssets.list.farm_units_archer;
                    default: return TWAssets.list.farm_units;
                };
            };
    
            isThereArchers().forEach((unit) => {
                const unitElem = document.querySelector(`#farm_units #units_home tbody tr td#${unit}`);
                if (!unitElem) throw new InsidiousError(`DOM: #farm_units #units_home tbody tr td#${unit}`);
                unitElem.setAttribute('insidious-available-units', unit);
            });

            // Dados sobre a aldeia atual.
            const currentVillageID: string | null = Utils.currentVillage();
            if (currentVillageID === null) throw new InsidiousError('Não foi possível obter o ID da aldeia atual.');

            const currentVillageData = await browser.storage.local.get(`v${currentVillageID}_${Insidious.world}`);
            if (currentVillageData[`v${currentVillageID}_${Insidious.world}`] === undefined) {
                throw new InsidiousError(`Não foi possível obter dados relativos à aldeia atual (${currentVillageID}).`);
            };

            const { x: currentX, y: currentY } = currentVillageData[`v${currentVillageID}_${Insidious.world}`] as VillageInfo  ?? { };
            if (currentX === undefined || currentY === undefined) {
                throw new InsidiousError(`Não foi possível obter as coordenadas da aldeia atual (${currentVillageID}).`);
            };

            // Lista das aldeias que já foram atacadas alguma vez.
            // É usado no mapa para marcar as aldeias que ainda não foram alguma vez atacadas.
            let alreadyPlunderedVillages: Set<string> = new Set();
            const attackHistory = (await browser.storage.local.get(Plunder.plunderedKey))[Plunder.plunderedKey] as Set<string> | undefined;
            if (attackHistory !== undefined) alreadyPlunderedVillages = attackHistory;
    
            // Ajuda a controlar o MutationObserver.
            const infoEventTarget = new EventTarget();
    
             // Adiciona informações úteis às tags HTML originais da página.
            const addInfo = async () => {
                // Desconecta qualquer observer que esteja ativo.
                infoEventTarget.dispatchEvent(new Event('stopinfoobserver'));

                try {
                    // https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors
                    const plunderListRows = document.querySelectorAll('#plunder_list tbody tr[id^="village_"]');
                    for (const row of Array.from(plunderListRows)) {
                        if (!row.hasAttribute('insidious-village')) {
                            // A coerção à string é válida pois já foi verificada a existência do ID ao usar querySelectorAll();
                            let villageID: string = row.getAttribute('id') as string;
                            villageID = villageID.replace(/\D/g, '');

                            const verifyVillageID: number = Number.parseInt(villageID, 10);
                            if (Number.isNaN(verifyVillageID)) throw new InsidiousError(`O ID da aldeia é inválido (${villageID})`);
                            alreadyPlunderedVillages.add(villageID);

                            row.setAttribute('insidious-village', villageID);
                            row.setAttribute('insidious-tr-farm', 'true');

                            // Relatório.
                            const reportLink = row.querySelector('td a[href*="screen=report" i]');
                            if (!reportLink) throw new InsidiousError(`Não foi possível encontrar o link do relatório (${villageID}).`);
                            reportLink.setAttribute('insidious-td-type', 'report');
                            
                            // Data do último ataque.
                            const findDateField = (): HTMLElement | null => {
                                const fields = row.querySelectorAll('td');
                                for (const field of Array.from(fields)) {
                                    if (!field.textContent) continue;
                                    const date = this.#decipherPlunderListDate(field.textContent);
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
                                    const woodField = field.querySelector('.nowrap span[class*="wood"] + span');
                                    const stoneField = field.querySelector('.nowrap span[class*="stone"] + span');
                                    const ironField = field.querySelector('.nowrap span[class*="iron"] + span');
                                    if (!woodField || !stoneField || !ironField) continue;

                                    let totalAmount: number = 0;
                                    [woodField, stoneField, ironField].forEach((resField) => {
                                        let resAmount: string | null = resField.textContent;
                                        if (resAmount === null) throw new InsidiousError(`Os campos de recursos foram encontrados, mas estão vazios (${villageID}).`);
                                        resAmount = resAmount.replace(/\D/g, '');

                                        // Adiciona o valor à quantia total.
                                        const parsedResAmount: number = parseInt(resAmount, 10);
                                        if (!Number.isNaN(parsedResAmount)) {
                                            totalAmount += parsedResAmount;
                                        } else {
                                            throw new InsidiousError(`A quantia de recursos calculada não é válida (${villageID}).`);
                                        };

                                        // A coerção é possível pois a existência já foi verificada ao usar querySelector() com o seletor "+".
                                        let resType = resField.previousElementSibling!.getAttribute('class') as string;
                                        const resName = ['wood', 'stone', 'iron'].some((name) => {
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
                                    if (Number.isNaN(parsed) || parsed !== Number(wallLevel)) {
                                        throw new InsidiousError(`O valor encontrado não corresponde ao nível da muralha (${villageID}).`);
                                    };

                                    row.setAttribute('insidious-wall', wallLevel);
                                    wallLevelField.setAttribute('insidious-td-type', 'wall');
                                } else {
                                    throw new InsidiousError(`O nível da muralha não foi encontrado (${villageID}).`);
                                };
                            };
        
                            // Distância e coordenadas (adquirido de forma independente, não dependendo da posição na tabela).
                            const targetVillageData = await browser.storage.local.get(`v${villageID}_${Insidious.world}`);
                            const { x: targetX, y: targetY } = targetVillageData[`v${villageID}_${Insidious.world}`] as VillageInfo ?? { };

                            if (targetX !== undefined && targetY !== undefined) {
                                const getRelativeCoords = (): number[] => {
                                    const coords: number[] = [currentX, currentY, targetX, targetY];
                                    if (coords.some(coord => !Number.isInteger(coord))) {
                                        throw new InsidiousError(`As coordenadas obtidas são inválidas (${currentVillageID} e/ou ${villageID}).`);
                                    };
                                    return coords;
                                };
    
                                const distance = Utils.calcDistance(...getRelativeCoords());
                                row.setAttribute('insidious-distance', distance.toFixed(1));
                                row.setAttribute('insidious-x', String(targetX));
                                row.setAttribute('insidious-y', String(targetY));

                            } else {
                                // Nesse caso, muito provavelmente a aldeia não está salva no banco de dados.
                                row.setAttribute('insidious-distance', 'unknown');
                            };

                            // A
                            const aFarmBtn = row.querySelector('td a[class*="farm_icon_a" i]:not([class*="disabled" i])');
                            if (aFarmBtn) aFarmBtn.setAttribute('insidious-farm-btn', `a_${villageID}`);
                                    
                            // B
                            const bFarmBtn = row.querySelector('td a[class*="farm_icon_b" i]:not([class*="disabled" i])');
                            if (bFarmBtn) bFarmBtn.setAttribute('insidious-farm-btn', `b_${villageID}`);
        
                            // C
                            const cFarmBtn = row.querySelector('td a[class*="farm_icon_c" i]:not([class*="disabled" i])');
                            if (cFarmBtn) cFarmBtn.setAttribute('insidious-farm-btn', `c_${villageID}`);

                            // Praça de reunião.
                            const placeButton = row.querySelector('td a[href*="screen=place" i][onclick]');
                            if (!placeButton) throw new InsidiousError(`O botão para praça de reunião não foi encontrado. ${villageID}`);
                            placeButton.setAttribute('insidious-td-type', 'place');
                            placeButton.setAttribute('insidious-place-btn', `place_${villageID}`);
                        };
                    };

                    browser.storage.local.set({ [Plunder.plunderedKey]: alreadyPlunderedVillages })
                        .catch((err: unknown) => {
                            if (err instanceof Error) InsidiousError.handle(err);
                        });

                } catch (err) {
                    if (err instanceof Error) InsidiousError.handle(err);
                };
    
                ////// CONTROLE DE EVENTOS
                const plunderList = document.querySelector('table#plunder_list');
                if (!plunderList) throw new InsidiousError('DOM: table#plunder_list.');

                // Dispara a função novamente caso surjam alterações na tabela.
                const observeTable = new MutationObserver(() => addInfo());
                observeTable.observe(plunderList, { subtree: true, childList: true });
    
                const farmTableCtrl = new AbortController();
                infoEventTarget.addEventListener('stopinfoobserver', () => {
                    observeTable.disconnect();
                    farmTableCtrl.abort();
                }, { signal: farmTableCtrl.signal });
            };
    
            // Inicia a adição dos dados.
            await addInfo();

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static #createOptions(): Manatsu[] {
        const optionsArea = document.querySelector('#insidious_farmOptionsArea');
        if (!optionsArea) throw new InsidiousError('A área de opções não existe.');

        const optionsAreaItems: Manatsu[] = [];

        // Ataca de múltiplas aldeias usando um grupo como referência.
        // O nome do grupo obrigatoriamente precisa ser Insidious.
        optionsAreaItems.push(...Manatsu.createCheckbox({
            id: 'insidious_group_attack_checkbox',
            label: 'Usar grupo'
        }, false, optionsArea) as Manatsu[]);

        // Não ataca aldeias que tenham muralha.
        optionsAreaItems.push(...Manatsu.createCheckbox({
            id: 'insidious_ignore_wall_checkbox',
            label: 'Ignorar muralha'
        }, false, optionsArea) as Manatsu[]);

        // Envia ataques com aríetes em aldeias com muralha.
        // Independe de como "ignorar muralha" está configurado.
        optionsAreaItems.push(...Manatsu.createCheckbox({
            id: 'insidious_destroy_wall_checkbox',
            label: 'Demolir muralha'
        }, false, optionsArea) as Manatsu[]);

        return optionsAreaItems;
    };

    static #decipherPlunderListDate(date: string): number | null {
        // Exemplos de data: hoje às 00:05:26 | ontem às 16:29:50 | em 21.09. às 12:36:38
        const writtenDate = date.toLowerCase();
        if (!writtenDate.includes('às')) return null;

        // splitDate representa apenas as horas, os minutos e os segundos.
        const splitDate: string | undefined = writtenDate.split(' ').pop();
        if (splitDate) {
            const date: number[] = splitDate.split('\:').map((item: string) => Number.parseInt(item, 10));
            if (date.length !== 3) return null;
            if (date.some((item) => Number.isNaN(item))) return null;

            // Se o ataque foi hoje, toma o horário atual e apenas ajusta a hora, os minutos e os segundos.
            if (writtenDate.includes('hoje')) {       
                return new Date().setHours(date[0], date[1], date[2]);

            // Se foi ontem, faz a mesma coisa, mas remove 24 horas do resultado.
            } else if (writtenDate.includes('ontem')) {
                const yesterday = new Date().getTime() - (3600000 * 24);
                return new Date(yesterday).setHours(date[0], date[1], date[2]);

            } else if (writtenDate.includes('em')) {
                // Em outros cenários, também altera o dia e o mês.
                let dayAndMonth: string | number[] = (writtenDate.split(' '))[1];
                dayAndMonth = dayAndMonth.split('.').map((item: string) => Number.parseInt(item, 10));
                dayAndMonth.filter((item) => !Number.isNaN(item));

                let anyDay: number = new Date().setHours(date[0], date[1], date[2]);
                // O valor para o mês começa com índica zero, por isso é preciso diminuir em 1.
                anyDay = new Date(anyDay).setMonth(dayAndMonth[1] - 1, dayAndMonth[0]);

                // Caso essa condição for verdadeira, há diferença de ano entre a data atual e a data do ataque.
                if (anyDay > new Date().getTime()) throw new InsidiousError('Issue #2: https://github.com/ferreira-tb/insidious/issues/2#issue-1383251210');
                
                return anyDay;
            };
        };

        return null;
    };

    static get open() {return this.#open};
};