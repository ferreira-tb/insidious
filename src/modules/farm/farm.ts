class TWFarm {
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
        // Esse botão é adicionado à página após o Insidious terminar de verificar o status do plunder.
        const startPlunderBtn = new Manatsu('button', {
            class: 'insidious_farmButtonArea_Btn',
            id: 'insidious_startPlunderBtn'
        }).create();

        
        
        ////// OPÇÕES
        const optionsAreaItems: Manatsu[] = [];

        const ignoreWall = new Manatsu('input', {
            type: 'checkbox',
            id: 'insidious_ignore_wall_checkbox'
        }, optionsArea);

        const ignoreWallLabel = new Manatsu('label', {
            for: 'insidious_ignore_wall_checkbox',
            text: 'Ignorar muralha'
        }, optionsArea);

        optionsAreaItems.push(ignoreWall, ignoreWallLabel);

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

        for (const field of (farmModelsInputFields as unknown) as HTMLElement[]) {
            const fieldName = field.getAttribute('name');
            if (!fieldName) throw new InsidiousError('O atributo \"name\" não foi encontrado nos campos de texto dos modelos.');

            const fieldType = fieldName.slice(0, fieldName.indexOf('\['));
            const fieldValue = field.getAttribute('value');
            if (fieldValue === null) throw new InsidiousError(`Não foi possível encontrar o valor do campo de texto \"${fieldType}\".`);

            // Verifica se o campo pertence ao modelo A.
            if (field.parentElement?.parentElement === aRow) {
                field.setAttribute('insidious-model-a', fieldType);
                Object.defineProperty(parentRow.a, fieldType, {
                    value: parseInt(fieldValue, 10),
                    enumerable: true
                });

            // Em caso contrário, assume que pertence ao modelo B.
            } else {
                field.setAttribute('insidious-model-b', fieldType);
                Object.defineProperty(parentRow.b, fieldType, {
                    value: parseInt(fieldValue, 10),
                    enumerable: true
                });
            };
        };

        // Salva os modelos no banco de dados.
        browser.storage.local.set({ amodel: parentRow.a, bmodel: parentRow.b })
            .catch((err: unknown) => {
                if (err instanceof Error) console.error(err);
            });

        ////// EVENTOS
        const plunderBtnEvents = async () => {
            startPlunderBtn.removeEventListener('click', plunderBtnEvents);
            Manatsu.removeChildren(actionArea);

            try {
                // Insidious não pode realizar operações fetch enquanto o plunder estiver ativo.
                const result: { isPlunderActive: boolean } = await browser.storage.local.get('isPlunderActive');
                // Se estiver ativo no momento do clique, desativa o plunder e troca o texto do botão.
                if (result.isPlunderActive === true) {
                    await browser.storage.local.set({ isPlunderActive: false });
                    startPlunderBtn.textContent = 'Saquear';

                // Em caso contrário, ativa o plunder.
                } else if (result.isPlunderActive === false) {
                    await browser.storage.local.set({ isPlunderActive: true });
                    await browser.storage.local.remove('totalPlundered');
                    startPlunderBtn.textContent = 'Parar';
                    Plunder.start();
                };

            } catch (err) {
                if (err instanceof Error) console.error(err);

            } finally {
                startPlunderBtn.addEventListener('click', plunderBtnEvents);
            };
        };

        startPlunderBtn.addEventListener('click', plunderBtnEvents);

        // Configura o botão de saque de acordo com o status do plunder.
        // Além disso, se o plunder já estiver marcado como ativo, chama #plunder() automaticamente.
        browser.storage.local.get('isPlunderActive')
            .then((result: any) => {
                buttonArea.appendChild(startPlunderBtn);
                Manatsu.createAll(optionsAreaItems);

                if (result.isPlunderActive === true) {
                    startPlunderBtn.textContent = 'Parar';
                    Plunder.start();

                // Caso não esteja ativo, apaga o histórico de recursos saqueados.
                } else if (result.isPlunderActive === false) {
                    startPlunderBtn.textContent = 'Saquear';
                    browser.storage.local.remove('totalPlundered');

                } else if (result.isPlunderActive === undefined) {
                    startPlunderBtn.textContent = 'Saquear';
                    browser.storage.local.set({ isPlunderActive: false });
                };

            }).catch((err: unknown) => {
                if (err instanceof Error) {
                    // Caso haja algum erro, desativa o plunder, por segurança.
                    browser.storage.local.set({ isPlunderActive: false });
                    console.error(err);
                };
            });
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
            if (!Insidious.worldInfo.config.game) {
                await browser.storage.local.remove('worldConfigFetch');
                throw new InsidiousError('Não foi possível obter as configurações do mundo.');
            };
    
            const isThereArchers = () => {
                switch (Insidious.worldInfo.config.game.archer) {
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

            const currentVillageData = await browser.storage.local.get(`village${currentVillageID}`);
            if (currentVillageData['village' + currentVillageID] === undefined) {
                throw new InsidiousError(`Não foi possível obter dados relativos à aldeia atual (${currentVillageID}).`);
            };

            const { x: currentX, y: currentY }: SNObject = currentVillageData['village' + currentVillageID] ?? { };
            if (currentX === undefined || currentY === undefined) {
                throw new InsidiousError(`Não foi possível obter as coordenadas da aldeia atual (${currentVillageID}).`);
            };

            // Lista das aldeias que já foram atacadas alguma vez.
            // É usado no mapa para marcar as aldeias que ainda não foram alguma vez atacadas.
            let alreadyPlunderedVillages: Set<string> = new Set();
            const attackHistory: Set<string> | undefined = (await browser.storage.local.get('alreadyPlunderedVillages')).alreadyPlunderedVillages;
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
                    for (const row of (plunderListRows as unknown) as HTMLElement[]) {
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
                                for (const field of (fields as unknown) as HTMLElement[]) {
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
                                for (const field of (fields as unknown) as HTMLElement[]) {
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
                            const targetVillageData = await browser.storage.local.get(`village${villageID}`);
                            const { x: targetX, y: targetY }: SNObject = targetVillageData['village' + villageID] ?? { };

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

                    browser.storage.local.set({ alreadyPlunderedVillages: alreadyPlunderedVillages })
                        .catch((err: unknown) => {
                            if (err instanceof Error) console.error(err);
                        });

                } catch (err) {
                    if (err instanceof Error) console.error(err);
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
            if (err instanceof Error) console.error(err);
        };
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
                if (anyDay > new Date().getTime()) throw new InsidiousError('Issue #2: https://github.com/ferreira-tb/insidious/issues/2');
                
                return anyDay;
            };
        };

        return null;
    };

    static get open() { return this.#open };
};

class FarmAbort {
    reason;
    
    constructor(reason?: string) {
        this.reason = reason;
    };
};