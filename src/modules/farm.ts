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
        const actionArea = new Manatsu({ id: 'insidious_farmActionArea' }, menuArea).create();

        ////// BOTÕES
        // Esse botão é adicionado à página após o Insidious terminar de verificar o status do plunder.
        const startPlunderBtn = new Manatsu('button', {
            class: 'insidious_farmButtonArea_Btn',
            id: 'insidious_startPlunderBtn'
        }).create();

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
                    this.#plunder();
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
                if (result.isPlunderActive === true) {
                    startPlunderBtn.textContent = 'Parar';
                    this.#plunder();

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

    static async #plunder() {
        try {
            // Exibe a quantidade de recursos saqueado durante o período em que o plunder estiver ativo.
            // A função #updatePlunderedAmount() atualiza essa informação após cada ataque feito.
            await this.#showPlunderedAmount();

            // Ajuda a controlar o estado das promises.
            const plunderEventTarget = new EventTarget();

            // Informações sobre cada tipo de unidade do jogo.
            if (!Insidious.unitInfo.unit) {
                await browser.storage.local.remove('worldConfigFetch');
                throw new InsidiousError('Não foi possível obter as informações sobre as unidades do jogo.');
            };

            // Modelos de saque do usuário.
            const models = await browser.storage.local.get(['amodel', 'bmodel']);
            if (!models.amodel) throw new InsidiousError('Os dados do modelo A não estão presentes no banco de dados.');
            if (!models.bmodel) throw new InsidiousError('Os dados do modelo B não estão presentes no banco de dados.');

            // Calcula a capacidade total de carga com base nos dados salvos.
            const calcCarryCapacity = (unitModel: any) => {
                let result: number = 0;
                for (const key in unitModel) {
                    // Ignora o explorador, já que ele não pode carregar recursos.
                    if (key !== 'spy') result += unitModel[key] * Insidious.unitInfo.unit[key].carry;
                };

                if (!Number.isInteger(result)) {
                    throw new InsidiousError('O valor calculado para a capacidade de carga é inválido.');
                };
                return result;
            };

            const capacityA: number = calcCarryCapacity(models.amodel);
            const capacityB: number = calcCarryCapacity(models.bmodel);

            // Caso o valor seja zero, surge uma divisão por zero no cálculo da razão.
            // Qualquer valor dividido por Infinity se torna zero, o que o torna a melhor opção lá.
            const carryCapacity: { [index: string]: number } = {
                a: capacityA === 0 ? Infinity : capacityA,
                b: capacityB === 0 ? Infinity : capacityB,
            };

            const sendAttack = async (): Promise<void> => {
                try {
                    // Representa cada linha na tabela.
                    const villageRows = document.querySelectorAll('tr[insidious-tr-farm="true"]');
                    for (const village of (villageRows as unknown) as HTMLElement[]) {
                        // Ignora a linha caso ela esteja oculta.
                        // Elas automaticamente ficam ocultas assim que são atacadas.
                        if (village.getAttribute('style')?.includes('display: none')) continue;
                        
                        // Caso não hajam informações obtidas por exploradores, a linha é ignorada.
                        // No entanto, provoca um erro caso a função addInfo() tiver falhado em criar o atributo.
                        const spyStatus = village.getAttribute('insidious-spy-status');
                        if (spyStatus === null || spyStatus === '') {
                            throw new InsidiousError('A linha não possui atributo indicando se foi explorada ou não.');
                        } else if (spyStatus === 'false') {
                            continue;
                        };

                        const resourceData: string | number | null = village.getAttribute('insidious-resources');
                        if (resourceData === null || resourceData === '') {
                            throw new InsidiousError('A linha não possui atributo indicando a situação dos recursos.');
                        };
                        // Representa a quantidade total de recursos disponível na aldeia alvo.
                        const resourceAmount = Number.parseInt(resourceData, 10);

                        // Determina qual modelo usar com base na capacidade de cada um e nos recursos disponíveis.
                        // Caso um modelo não seja adequado, será marcado como null.
                        let bestRatio: AB = null, otherRatio: AB = null;
                        const verifyRatio = (): boolean => {
                            let bigger: AB = carryCapacity.a >= carryCapacity.b ? 'a' : 'b';
                            let smaller: AB = carryCapacity.a < carryCapacity.b ? 'a' : 'b';

                            // Se ambos são menores que a quantidade de recursos, basta mandar o maior.
                            // A diferença entre a carga do maior e a quantidade de recursos não é relevante nesse caso.
                            if (resourceAmount >= carryCapacity[bigger]) {
                                bestRatio = bigger;
                                otherRatio = smaller;
                                return true;

                            // Se os dois são maiores, descartam-se aqueles que estejam fora da zona aceitável.
                            // Se todos forem descartados, a função será obrigada a retornar false.
                            } else if (resourceAmount <= carryCapacity[smaller]) {
                                bestRatio = resourceAmount / carryCapacity[smaller] >= 0.8 ? smaller : null;
                                otherRatio = resourceAmount / carryCapacity[bigger] >= 0.8 ? bigger : null;
                                if (bestRatio !== null) return true;
                                return false;

                            // Nesse caso, a quantidade de recursos é maior que a carga de um, mas menor que a de outro.
                            } else {
                                // Razão em relação ao maior (será sempre MENOR que 1).
                                const ratioB = resourceAmount / carryCapacity[bigger];
                                // Razão em relação ao menor (será sempre MAIOR que 1).
                                const ratioS = resourceAmount / carryCapacity[smaller];

                                // O de maior carga é descartado caso seja grande demais.
                                // O menor é dado como válido pois valores menores são sempre adequados.
                                if (ratioB < 0.8) {
                                    bestRatio = smaller;
                                    otherRatio = null;
                                    return true;

                                // Caso o maior seja válido, verifica-se qual está mais próximo da quantidade de recursos.
                                } else {
                                    bestRatio = (1 - ratioB) <= (ratioS - 1) ? bigger : smaller;
                                    otherRatio = (1 - ratioB) > (ratioS - 1) ? bigger : smaller;
                                    return true;
                                };
                            };
                        };

                        // Verifica o modelo mais adequado e em seguida se há tropas disponíveis.
                        if (verifyRatio()) {
                            if (bestRatio === null) throw new InsidiousError('Não foi atribuído valor a uma variável de controle (ratio).');

                            const getUnitElem = (unit: string): number => {
                                const unitElem = document.querySelector(`#farm_units #units_home tbody tr td#${unit}`);
                                if (!unitElem || unitElem.textContent === null) throw new InsidiousError(`DOM: #farm_units #units_home tbody tr td#${unit}`);
                                return Number.parseInt(unitElem.textContent, 10);
                            };

                            // Lista das tropas disponíveis.
                            const availableTroops: AvailableTroops = {
                                spear: getUnitElem('spear'),
                                sword: getUnitElem('sword'),
                                axe: getUnitElem('axe'),
                                spy: getUnitElem('spy'),
                                light: getUnitElem('light'),
                                heavy: getUnitElem('heavy'),
                                knight: getUnitElem('knight')
                            };

                            if (!Insidious.worldInfo.config.game) {
                                browser.storage.local.remove('worldConfigFetch');
                                throw new InsidiousError('Não foi possível obter as configurações do mundo.');
                            };

                            // Caso o mundo tenha arqueiros, adiciona-os à lista.
                            if (Insidious.worldInfo.config.game.archer === 1) {
                                Object.defineProperties(availableTroops, {
                                    archer: {
                                        value: getUnitElem('archer'),
                                        enumerable: true
                                    },

                                    marcher: {
                                        value: getUnitElem('marcher'),
                                        enumerable: true
                                    }
                                });
                            };

                            // Modelo escolhido pela função.
                            const bestModel = models[bestRatio + 'model'];

                            const checkAvailability = (model: any): boolean => {
                                // É possível usar a mesma chave em ambas, pois a estrutura é exatamente igual.
                                for (const key in availableTroops) {
                                    // Se houver menos tropas do que consta no modelo, a função deve ser interrompida.
                                    if (availableTroops[key as keyof typeof availableTroops] < model[key]) return false;
                                };
                                return true;
                            };

                            // Esse boolean determina se o ataque é enviado ou não.
                            let attackIsPossible: boolean = checkAvailability(bestModel);

                            // Caso não hajam tropas disponíveis, verifica se um ataque usando o outro modelo seria aceitável.
                            if (otherRatio !== null && !attackIsPossible) {
                                const otherModel = models[otherRatio + 'model'];
                                // Em caso positivo, determina o outro modelo como bestRatio.
                                if (checkAvailability(otherModel)) {
                                    bestRatio = otherRatio;
                                    attackIsPossible = true;
                                };
                            };
                            
                            // Se as tropas estiverem disponíveis, envia o ataque após um delay aleatório.
                            if (attackIsPossible) {
                                return new Promise<void>((resolve, reject) => {
                                    const attackCtrl = new AbortController();
                                    const timerID = setTimeout(async () => {
                                        try {
                                            // Envia o ataque e espera até que o servidor dê uma resposta.
                                            await handleAttack();
    
                                            // Calcula a quantidade recursos esperada no saque (sempre pressupondo carga total).
                                            const calcExpected = () => {
                                                const woodAmount: string | null = village.getAttribute('insidious-wood');
                                                const stoneAmount: string | null = village.getAttribute('insidious-stone');
                                                const ironAmount: string | null = village.getAttribute('insidious-iron');
    
                                                if (!woodAmount || !stoneAmount || !ironAmount) {
                                                    throw new InsidiousError('O atributo que informa a quantidade de recursos está ausente.');
                                                };
    
                                                const allResources: number[] = [woodAmount, stoneAmount, ironAmount].map((resource: string) => {
                                                    const parsed = Number.parseInt(resource, 10);
                                                    if (Number.isNaN(parsed)) throw new InsidiousError(`O valor dos recursos não é válido (${parsed}).`);
                                                    return parsed;
                                                });
    
                                                let totalAmount = allResources.reduce((previous, current) => {
                                                    return previous + current;
                                                }, 0);
                                                
                                                // Caso a soma resulte em zero, "totalAmount = Infinity" garante que não surja uma divisão por zero mais adiante.
                                                // Qualquer valor dividido por Infinity é igual a zero.
                                                if (totalAmount === 0) totalAmount = Infinity;
    
                                                return allResources.map((amount: number) => {
                                                    // Se houver mais recursos do que a carga suporta, calcula quanto de cada recurso deve ser saqueado.
                                                    if (totalAmount > carryCapacity[bestRatio as string]) {
                                                        return Math.floor((amount / totalAmount) * carryCapacity[bestRatio as string]);
                                                    } else {
                                                        return amount;
                                                    };
                                                });
                                            };
    
                                            await this.#updatePlunderedAmount(...calcExpected());
                                            attackCtrl.abort();
                                            resolve();

                                        } catch (err) {
                                            attackCtrl.abort();
                                            reject(err);
                                        };
 
                                    // O jogo possui um limite de cinco ações por segundo.
                                    }, Utils.generateIntegerBetween(300, 500));
    
                                    plunderEventTarget.addEventListener('stopplundering', () => {
                                        clearTimeout(timerID);
                                        attackCtrl.abort();
                                        reject(new FarmAbort());
                                    }, { signal: attackCtrl.signal });

                                    document.querySelector('#insidious_startPlunderBtn')?.addEventListener('click', () => {
                                        clearTimeout(timerID);
                                        attackCtrl.abort();
                                        reject(new FarmAbort());
                                    }, { signal: attackCtrl.signal });

                                }).then(() => sendAttack()).catch((err) => {
                                    if (err instanceof FarmAbort) {
                                        if (err.reason) console.error(err.reason);
                                        return;

                                    } else if (err instanceof Error) {
                                        console.error(err);
                                    };
                                });

                                // O plunder cumpre sua tarefa bem mais rápido que o servidor consegue responder.
                                // No entanto, como ele depende do número de tropas ditado pelo jogo, é necessário esperar o valor ser atualizado.
                                function handleAttack() {
                                    return new Promise<void>((resolve) => {
                                        const observerTimeout = setTimeout(handleTimeout, 5000);
                                        const observeTroops = new MutationObserver(() => {
                                            clearTimeout(observerTimeout);
                                            observeTroops.disconnect();
                                            resolve();
                                        });

                                        // Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro.
                                        function handleTimeout() {
                                            observeTroops.disconnect();
                                            throw new InsidiousError('TIMEOUT: O servidor demorou demais para responder.');
                                        };

                                        const unitTable = document.querySelector('tr[insidious-available-unit-table="true"]');
                                        if (!unitTable) throw new InsidiousError('DOM: tr[insidious-available-unit-table]');
                                        observeTroops.observe(unitTable, { subtree: true, childList: true, characterData: true });
                                        
                                        const targetVillageID = village.getAttribute('insidious-village');
                                        if (targetVillageID === null || targetVillageID === '') {
                                            throw new InsidiousError('Não foi possível obter o ID da aldeia alvo.');
                                        };

                                        // Como a promise superior está esperando a resolução dessa, o plunder só irá continuar após isso acontecer.
                                        const attackButton = document.querySelector(
                                            `a[insidious-farm-btn^="${bestRatio}" i][insidious-farm-btn$="${targetVillageID}"]`
                                        );
                                        if (!attackButton) throw new InsidiousError(`O botão ${(bestRatio as string).toUpperCase()} não foi encontrado.`);
                                        attackButton.dispatchEvent(new Event('click')); 
                                    });
                                };
                            };
                        };
                    };

                } catch (err) {
                    if (err instanceof Error) console.error(err);
                };
            };

            // Após vários minutos, recarrega a página.
            // Como isPlunderActive === true, o plunder voltará a atacar automaticamente.
            const setPlunderTimeout = () => {
                return new Promise<void>((resolve, reject) => {
                    const timeoutCtrl = new AbortController();

                    const plunderTimeoutID = setTimeout(() => {
                        // Interrompe qualquer atividade no plunder e inicia a preparação para o recarregamento.
                        plunderEventTarget.dispatchEvent(new Event('stopplundering'));
                        timeoutCtrl.abort();
                        setTimeout(() => window.location.reload(), 5000);
                        resolve();
                    }, Utils.generateIntegerBetween((60000 * 20), (60000 * 30)));

                    document.querySelector('#insidious_startPlunderBtn')?.addEventListener('click', () => {
                        clearTimeout(plunderTimeoutID);
                        timeoutCtrl.abort();
                        reject(new FarmAbort());
                    }, { signal: timeoutCtrl.signal });
                });
            };

            // Alea iacta est.
            sendAttack();
            setPlunderTimeout().catch((err) => {
                if (err instanceof FarmAbort) {
                    if (err.reason) console.error(err.reason);
                    return;
                };
            });

        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static async #showPlunderedAmount() {
        try {
            const actionArea = document.querySelector('#insidious_farmActionArea');
            if (!actionArea) throw new InsidiousError('Não foi possível exibir a estimativa de saque, pois #insidious_farmActionArea não existe.');
            Manatsu.removeChildren(actionArea);

            const plundered: TotalPlundered = await browser.storage.local.get('totalPlundered');
            const { wood = 0, stone = 0, iron = 0 }: SNObject = plundered.totalPlundered ?? { };

            const spanContainer = new Manatsu('span', {
                class: 'nowrap',
                ['insidious-custom']: 'true'
            }, actionArea).create();

            // MADEIRA
            new Manatsu('span', spanContainer, { class: 'icon header wood' }).create();
            new Manatsu('span', spanContainer, {
                class: 'res',
                id: 'insidious_plundered_wood',
                text: String(wood)
            }).create();

            // ARGILA
            new Manatsu('span', spanContainer, { class: 'icon header stone' }).create();
            new Manatsu('span', spanContainer, {
                class: 'res',
                id: 'insidious_plundered_stone',
                text: String(stone)
            }).create();

            // FERRO
            new Manatsu('span', spanContainer, { class: 'icon header iron' }).create();
            new Manatsu('span', spanContainer, {
                class: 'res',
                id: 'insidious_plundered_iron',
                text: String(iron)
            }).create();

        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static async #updatePlunderedAmount(...args: number[]) {
        const [wood, stone, iron] = args;
        const woodLabel = document.querySelector('#insidious_plundered_wood');
        const stoneLabel = document.querySelector('#insidious_plundered_stone');
        const ironLabel = document.querySelector('#insidious_plundered_iron');

        try {
            const plundered: TotalPlundered = await browser.storage.local.get('totalPlundered');
            if (plundered.totalPlundered) {
                const updatedValues = {
                    wood: plundered.totalPlundered.wood + wood,
                    stone: plundered.totalPlundered.stone + stone,
                    iron: plundered.totalPlundered.iron + iron
                };

                await browser.storage.local.set({ totalPlundered: updatedValues });

                if (woodLabel && stoneLabel && ironLabel) {
                    woodLabel.textContent = String(updatedValues.wood);
                    stoneLabel.textContent = String(updatedValues.stone);
                    ironLabel.textContent = String(updatedValues.iron);
                };

            } else {
                await browser.storage.local.set({ totalPlundered: {
                    wood: wood,
                    stone: stone,
                    iron: iron
                }});

                if (woodLabel && stoneLabel && ironLabel) {
                    woodLabel.textContent = String(wood);
                    stoneLabel.textContent = String(stone);
                    ironLabel.textContent = String(iron);
                };
            };

        } catch (err) {
            if (err instanceof Error) console.error(err);
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
                            villageID = villageID.replace('village_', '');

                            const verifyVillageID: number = Number.parseInt(villageID);
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
                                    if (field.getAttribute('colspan') !== "3") continue;

                                    const woodField = field.querySelector('.nowrap span[class*="wood"][data-title*="Madeira" i] + span');
                                    const stoneField = field.querySelector('.nowrap span[class*="stone"][data-title*="Argila" i] + span');
                                    const ironField = field.querySelector('.nowrap span[class*="iron"][data-title*="Ferro" i] + span');
                                    if (!woodField || !stoneField || !ironField) continue;

                                    let totalAmount: number = 0;
                                    [woodField, stoneField, ironField].forEach((resField) => {
                                        const resText: string | null = resField.textContent;
                                        if (resText === null) throw new InsidiousError(`Os campos de recursos foram encontrados, mas estão vazios (${villageID}).`);
                                        let resAmount: string = '';

                                        for (const char of resText) {
                                            const parsed = parseInt(char, 10);
                                            if (!Number.isNaN(parsed)) resAmount += char;
                                        };

                                        // Adiciona o valor à quantia total.
                                        const parsedResAmount: number = parseInt(resAmount, 10);
                                        if (!Number.isNaN(parsedResAmount)) {
                                            totalAmount += parsedResAmount;
                                        } else {
                                            throw new InsidiousError(`A quantia calculada não é válida (${villageID}).`);
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
        
                            // Distância (é calculada de forma independente, não dependendo da posição na tabela).
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
        const writtenDate = date.toLowerCase();
        if (!writtenDate.includes('às')) return null;

        const splitDate: string | undefined = writtenDate.split(' ').pop();
        if (splitDate) {
            const date: number[] = splitDate.split('\:').map((item: string) => Number(item));
            if (date.length !== 3) return null;
            if (date.some((item) => Number.isNaN(item))) return null;

            if (writtenDate.includes('hoje')) {       
                return new Date().setHours(date[0], date[1], date[2]);
    
            } else if (writtenDate.includes('ontem')) {
                const yesterday = new Date().getTime() - (3600000 * 24);
                return new Date(yesterday).setHours(date[0], date[1], date[2]);

            } else {
                // Essa parte é apenas temporária.
                return new Date().setHours(date[0], date[1], date[2]);
            };
        };

        return null;
    };

    static get open() {return this.#open};
};

class FarmAbort {
    reason;
    
    constructor(reason?: string) {
        this.reason = reason;
    };
};