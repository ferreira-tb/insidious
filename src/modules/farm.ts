class TWFarm {
    static #open() {
        // Elementos originais.
        const plunderListFilters = document.querySelector('#plunder_list_filters');
        if (!plunderListFilters) throw new ElementError({ id: 'plunder_list_filters' });

        const farmModels = document.querySelector('#content_value div.vis div form table.vis tbody');
        if (!farmModels) throw new ElementError({ id: 'content_value div.vis div form table.vis tbody' });

        // Elementos da extensão.
        const menuArea = new Manatsu('div', { id: 'insidious_farmMenuArea' }).create();
        plunderListFilters.parentNode.insertBefore(menuArea, plunderListFilters.nextElementSibling);

        const buttonArea = new Manatsu('div', { id: 'insidious_farmButtonArea' }).create();
        menuArea.appendChild(buttonArea);

        const actionArea = new Manatsu('div', { id: 'insidious_farmActionArea' }).create();
        menuArea.appendChild(actionArea);

        ////// BOTÕES
        const startPlunderBtn = new Manatsu('button', {
            class: 'insidious_farmButtonArea_Btn',
            id: 'insidious_startPlunderBtn'
        }).create();

        ////// DADOS
        this.#info();

        // Recolhe dados sobre os modelos salvos.
        if (!farmModels.firstElementChild) throw new InsidiousError('Não foi possível obter a linha principal da tabela de modelos.');
        const aRow = farmModels.firstElementChild.nextElementSibling;
        const parentRow = { a: {}, b: {} };

        const farmModelsInputFields = farmModels.querySelectorAll('tr td input[type=\"text\"]');
        if (farmModelsInputFields.length < 14) throw new InsidiousError('Não foi possível obter os campos de texto dos modelos.');

        for (const field of farmModelsInputFields) {
            const fieldName = field.getAttribute('name');
            const fieldType = fieldName.slice(0, fieldName.indexOf('\['));

            if (field.parentElement.parentElement === aRow) {
                field.setAttribute('data-insidious-model-a', fieldType);
                Object.defineProperty(parentRow.a, fieldType, {
                    value: parseInt(field.value, 10),
                    enumerable: true
                });

            } else {
                field.setAttribute('data-insidious-model-b', fieldType);
                Object.defineProperty(parentRow.b, fieldType, {
                    value: parseInt(field.value, 10),
                    enumerable: true
                });
            };
        };

        Insidious.storage.set({ amodel: parentRow.a, bmodel: parentRow.b })
            .catch((err) => {
                if (err instanceof Error) console.error(err);
            });

        ////// EVENTOS
        const plunderBtnEvents = async () => {
            startPlunderBtn.removeEventListener('click', plunderBtnEvents);
            Manatsu.removeChildren(actionArea);

            try {
                // Insidious não pode realizar operações fetch enquanto o plunder estiver ativo.
                const result: { isPlunderActive: boolean } = await Insidious.storage.get('isPlunderActive');
                if (result.isPlunderActive === true) {
                    await Insidious.storage.set({ isPlunderActive: false });
                    startPlunderBtn.textContent = 'Saquear';

                } else if (result.isPlunderActive === false) {
                    await Insidious.storage.set({ isPlunderActive: true });
                    await Insidious.storage.remove('totalPlundered');
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
        // Além disso, se o plunder estiver marcaddo como ativo, chama a função #plunder().
        Insidious.storage.get('isPlunderActive')
            .then((result) => {
                buttonArea.appendChild(startPlunderBtn);
                if (result.isPlunderActive === true) {
                    startPlunderBtn.textContent = 'Parar';
                    this.#plunder();

                } else if (result.isPlunderActive === false) {
                    startPlunderBtn.textContent = 'Saquear';
                    Insidious.storage.remove('totalPlundered');

                } else if (result.isPlunderActive === undefined) {
                    startPlunderBtn.textContent = 'Saquear';
                    Insidious.storage.set({ isPlunderActive: false });
                };

            }).catch((err) => {
                
                if (err instanceof Error) {
                    // Caso haja algum erro, desativa o plunder, por segurança.
                    Insidious.storage.set({ isPlunderActive: false });
                    console.error(err);
                };
            });
    };

    static async #plunder() {
        await this.#showPlunderedAmount();

        // Ajuda a controlar o estado das promises.
        const plunderEventTarget = new EventTarget();

        try {
            const models = await Insidious.storage.get(['amodel', 'bmodel']);
            const unitInfo = await Insidious.storage.get('unit');
            
            // Calcula a capacidade total de carga com base nos dados salvos.
            const calcCarryCapacity = (unitModel) => {
                let result = 0;
                for (const key in unitModel) {
                    if (key !== 'spy') {
                        result += unitModel[key] * unitInfo.unit[key].carry;
                    };
                };
                return result;
            };

            const capacityA = calcCarryCapacity(models.amodel);
            const capacityB = calcCarryCapacity(models.bmodel);

            // Caso o valor fosse zero, surgiria uma divisão por zero no cálculo do ratio.
            // Qualquer valor dividido por Infinity se torna zero, o que o torna a melhor opção lá.
            // Isso porquê bestRatio.value > ratio será sempre falso.
            const carryCapacity = {
                a: capacityA === 0 ? Infinity : capacityA,
                b: capacityB === 0 ? Infinity : capacityB,
            };

            // Caso não exista um ratio salvo, usa o padrão e o registra.
            let ratio = await Insidious.storage.get('resourceRatio');
            if (!ratio.resourceRatio) {
                ratio = 0.8;
                Insidious.storage.set({ resourceRatio: 0.8 })
                    .catch((err) => {
                        if (err instanceof Error) console.error(err);
                    });
            } else {
                ratio = ratio.resourceRatio;
            };

            const sendAttack = async (): Promise<void> => {
                for (const village of document.querySelectorAll('tr[data-insidious-tr-farm="true"]')) {
                    if (village.getAttribute('style')?.includes('display: none')) continue;

                    // Calcula a razão entre os recursos disponíveis e cada um dos modelos.
                    const resourceAmount = parseInt(village.dataset.insidiousResources, 10);
                    const ratioA = parseFloat((resourceAmount / carryCapacity.a).toFixed(2));
                    const ratioB = parseFloat((resourceAmount / carryCapacity.b).toFixed(2));
                    // Em seguida, escolhe o maior entre eles.
                    const bestRatio = ratioA >= ratioB ? { origin: 'a', value: ratioA } : { origin: 'b', value: ratioB };

                    // Se essa razão for aceitável, verifica se há tropas disponíveis.
                    if (bestRatio.value > ratio) {
                        const getUnitElem = (unit: string) => {
                            const unitElem = document.querySelector(`#farm_units #units_home tbody tr td#${unit}`);
                            if (!unitElem || unitElem.textContent === null) throw new ElementError({ id: `#farm_units #units_home tbody tr td#${unit}` });
                            return parseInt(unitElem.textContent, 10);
                        };

                        // Lista das tropas disponíveis.
                        const availableTroops = {
                            spear: getUnitElem('spear'),
                            sword: getUnitElem('sword'),
                            axe: getUnitElem('axe'),
                            spy: getUnitElem('spy'),
                            light: getUnitElem('light'),
                            heavy: getUnitElem('heavy'),
                            knight: getUnitElem('knight')
                        };

                        // Modelo escolhido pela função.
                        const bestModel = models[bestRatio.origin + 'model'];

                        const checkAvailability = () => {
                            // É possível usar a mesma chave em ambas, pois a estrutura é exatamente igual.
                            for (const key in availableTroops) {
                                // Se houver menos tropas do que consta no modelo, a função deve ser interrompida.
                                if (availableTroops[key as keyof typeof availableTroops] < bestModel[key]) return false;
                            };
                            return true;
                        };

                        // Se as tropas estiverem disponíveis, envia o ataque após um delay aleatório.
                        if (checkAvailability()) {
                            return new Promise<void>((resolve, reject) => {
                                const attackCtrl = new AbortController();

                                const timerID = setTimeout(async () => {
                                    attackCtrl.abort();
                                    // O plunder cumpre sua tarefa bem mais rápido que o servidor consegue responder.
                                    // No entanto, como ele depende do número de tropas ditado pelo jogo, é necessário esperar o valor ser atualizado.
                                    await new Promise<void>((resolve, reject) => {
                                        const observerTimeout = setTimeout(handleTimeout, 5000);
                                        const observeTroops = new MutationObserver(() => {
                                            clearTimeout(observerTimeout);
                                            observeTroops.disconnect();
                                            resolve();
                                        });

                                        function handleTimeout() {
                                            observeTroops.disconnect();
                                            reject(new InsidiousError('TIMEOUT: O servidor demorou demais para responder.'));
                                        };

                                        const unitTable = document.querySelector('tr[data-insidious-available-unit-table="true"]');
                                        if (!unitTable) throw new ElementError({ attribute: 'tr[data-insidious-available-unit-table]' });

                                        observeTroops.observe(unitTable, { subtree: true, childList: true, characterData: true });
                                        const attackButton = document.querySelector(`#${bestRatio.origin}_btn_${village.dataset.insidiousVillage}`);
                                        attackButton?.dispatchEvent(new Event('click')); 
                                    });

                                    // Calcula a quantidade recursos esperada no saque (sempre quantia total).
                                    const calcExpected = () => {
                                        const woodAmount = parseAmount(village.dataset.insidiousWood);
                                        const stoneAmount = parseAmount(village.dataset.insidiousStone);
                                        const ironAmount = parseAmount(village.dataset.insidiousIron);

                                        const totalAmount = calcTotalAmount();
                                        const modelCarryCapacity = carryCapacity[bestRatio.origin];

                                        const calcRatio = (amount: number) => {
                                            return Math.floor((amount / totalAmount) * modelCarryCapacity);
                                        };

                                        function parseAmount(amount: string) {
                                            const parsed = parseInt(amount, 10);
                                            if (Number.isNaN(parsed)) return 0;
                                            return parsed;
                                        };

                                        function calcTotalAmount() {
                                            const sum = woodAmount + stoneAmount + ironAmount;
                                            if (sum === 0) return Infinity;
                                            return sum;
                                        };

                                        return [calcRatio(woodAmount), calcRatio(stoneAmount), calcRatio(ironAmount)];
                                    };

                                    await this.#updatePlunderedAmount(...calcExpected());
                                    resolve();
                                    
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
                        };
                    };
                };
            };

            // Após vários minutos, recarrega a página.
            // Como isPlunderActive === true, o plunder voltará a atacar automaticamente.
            const setPlunderTimeout = () => {
                return new Promise((resolve, reject) => {
                    const timeoutCtrl = new AbortController();

                    const plunderTimeoutID = setTimeout(() => {
                        // Interrompe qualquer atividade no plunder e inicia a preparação para o recarregamento.
                        plunderEventTarget.dispatchEvent(new Event('stopplundering'));
                        timeoutCtrl.abort();
                        setTimeout(() => window.location.reload(), 5000);
                        resolve();
                    }, Utils.generateIntegerBetween((60000 * 20), (60000 * 30)));

                    document.querySelector('#insidious_startPlunderBtn').addEventListener('click', () => {
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
        const actionArea = document.querySelector('#insidious_farmActionArea');
        if (!actionArea) return;
        Manatsu.removeChildren(actionArea);

        const plundered = await Insidious.storage.get('totalPlundered');

        const spanContainer = new Manatsu('span', {
             class: 'nowrap',
             ['data-insidious-custom']: 'true'
        }).create();
        actionArea.appendChild(spanContainer);

        // MADEIRA
        const plunderedWood = Utils.createResourceSpan('wood');
        spanContainer.appendChild(plunderedWood);

        const woodAmount = Utils.createResourceSpanLabel('wood');
        woodAmount.setAttribute('id', 'insidious_plundered_wood');
        woodAmount.textContent = plundered.totalPlundered?.wood ?? 0;
        spanContainer.appendChild(woodAmount);

        // ARGILA
        const plunderedStone = Utils.createResourceSpan('stone');
        spanContainer.appendChild(plunderedStone);

        const stoneAmount = Utils.createResourceSpanLabel('stone');
        stoneAmount.setAttribute('id', 'insidious_plundered_stone');
        stoneAmount.textContent = plundered.totalPlundered?.stone ?? 0;
        spanContainer.appendChild(stoneAmount);

        // FERRO
        const plunderediron = Utils.createResourceSpan('iron');
        spanContainer.appendChild(plunderediron);

        const ironAmount = Utils.createResourceSpanLabel('iron');
        ironAmount.setAttribute('id', 'insidious_plundered_iron');
        ironAmount.textContent = plundered.totalPlundered?.iron ?? 0;
        spanContainer.appendChild(ironAmount);
    };

    static async #updatePlunderedAmount(...args: number[]) {
        const [wood, stone, iron] = args;
        const woodLabel = document.querySelector('#insidious_plundered_wood');
        const stoneLabel = document.querySelector('#insidious_plundered_stone');
        const ironLabel = document.querySelector('#insidious_plundered_iron');

        try {
            const plundered: Plundered = await Insidious.storage.get('totalPlundered');
            if (plundered.totalPlundered) {
                const updatedValues = {
                    wood: plundered.totalPlundered.wood + wood,
                    stone: plundered.totalPlundered.stone + stone,
                    iron: plundered.totalPlundered.iron + iron
                };

                await Insidious.storage.set({ totalPlundered: updatedValues });

                if (woodLabel) woodLabel.textContent = String(updatedValues.wood);
                if (stoneLabel) stoneLabel.textContent = String(updatedValues.stone);
                if (ironLabel) ironLabel.textContent = String(updatedValues.iron);

            } else {
                await Insidious.storage.set({ totalPlundered: {
                    wood: wood,
                    stone: stone,
                    iron: iron
                }});

                if (woodLabel) woodLabel.textContent = String(wood);
                if (stoneLabel) stoneLabel.textContent = String(stone);
                if (ironLabel) ironLabel.textContent = String(iron);
            };

        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static #info() {
        const plunderList = document.querySelector('#plunder_list tbody');
        if (!plunderList) throw new ElementError({ id: 'plunder_list tbody' });

        // Célula de referência.
        const spearElem = document.querySelector('#farm_units #units_home tbody tr td#spear');
        if (!spearElem) throw new ElementError({ id: `#farm_units #units_home tbody tr td#spear` });

        // Tabela com as tropas disponíveis.
        //if (!spearElem.parentElement) throw new ElementError({ id: `#farm_units #units_home tbody tr td#spear` });
        spearElem.parentElement.setAttribute('data-insidious-available-unit-table', 'true');

        TWAssets.list.farm_units.forEach((unit) => {
            const unitElem = document.querySelector(`#farm_units #units_home tbody tr td#${unit}`);
            if (!unitElem) throw new ElementError({ id: `#farm_units #units_home tbody tr td#${unit}` });
            unitElem.setAttribute('data-insidious-available-units', unit);
        });

        // Ajuda a controlar o MutationObserver.
        const infoEventTarget = new EventTarget();

         // Adiciona informações úteis às tags HTML originais da página.
        const addInfo = () => {
            // Desconecta qualquer observer que esteja ativo.
            infoEventTarget.dispatchEvent(new Event('stopinfoobserver'));

            for (const child of (plunderList.children as unknown) as HTMLElement[]) {
                if (child.id?.startsWith('village_') && !child.hasAttribute('data-insidious-village')) {
                    const villageID = child.id.replace('village_', '');
                    child.setAttribute('data-insidious-village', villageID);
                    child.setAttribute('data-insidious-tr-farm', 'true');

                    // Identifica cada célula da linha.
                    const deleteReportsBtn = child.firstElementChild;
                    deleteReportsBtn.setAttribute('data-insidious-td-type', 'delete');

                    const battleStatusDot = deleteReportsBtn.nextElementSibling;
                    battleStatusDot.setAttribute('data-insidious-td-type', 'battle_status');

                    const lastPlunderStatus = battleStatusDot.nextElementSibling;
                    lastPlunderStatus.setAttribute('data-insidious-td-type', 'last_plunder_status');

                    const reportLinkBtn = lastPlunderStatus.nextElementSibling;
                    reportLinkBtn.setAttribute('data-insidious-td-type', 'report');

                    const lastBattleDate = reportLinkBtn.nextElementSibling;
                    lastBattleDate.setAttribute('data-insidious-td-type', 'date');
                    child.setAttribute('data-insidious-date', Utils.decipherDate(lastBattleDate.textContent));

                    // Quantidade de recursos.
                    const expectedResources = lastBattleDate.nextElementSibling;
                    expectedResources.setAttribute('data-insidious-td-type', 'resources');
                    child.setAttribute('data-insidious-resources', calcResourceAmount());

                    function calcResourceAmount() {
                        let result = 0;
                        for (const span of expectedResources.children) result += parseInt(getAmount(span), 10);
                        return result;
                    };

                    // É preciso adicionar tratamento para casos onde os recursos não estão visíveis, pois não houve ataque de explorador.
                    function getAmount(span: HTMLElement): string {
                        const querySpan = (className: string) => {
                            const resSpan = span.querySelector(`.${className}`);
                            if (!resSpan) return false;

                            let resValue = resSpan.textContent.includes('.') ? resSpan.textContent.replaceAll('.', '') : resSpan.textContent;
                            resValue = resValue.replace(/\s+/g, '');

                            const resType = resSpan.previousElementSibling.dataset.title;
                            switch (resType) {
                                case 'Madeira': child.setAttribute('data-insidious-wood', resValue);
                                    break;
                                case 'Argila': child.setAttribute('data-insidious-stone', resValue);
                                    break;
                                case 'Ferro': child.setAttribute('data-insidious-iron', resValue);
                                    break;
                            };

                            return resValue;
                        };

                        function* findValidClass() {
                            yield querySpan('res');
                            yield querySpan('warn');
                            yield querySpan('warn_90');
                        };

                        for (const text of findValidClass()) if (text) return text;
                        throw new InsidiousError('Não foi encontrada informação sobre a quantidade de recursos disponíveis.');
                    };

                    // Muralha.
                    const wallLevel = expectedResources.nextElementSibling;
                    wallLevel.setAttribute('data-insidious-td-type', 'wall');
                    child.setAttribute('data-insidious-wall', String(wallLevel.textContent));

                    // Distância.
                    const villageDistance = wallLevel.nextElementSibling;
                    villageDistance.setAttribute('data-insidious-td-type', 'distance');
                    child.setAttribute('data-insidious-distance', String(villageDistance.textContent));

                    // A
                    const aFarmBtnTD = villageDistance.nextElementSibling;
                    aFarmBtnTD.setAttribute('data-insidious-td-type', 'a_btn');
                    verifyFarmButton(aFarmBtnTD);

                    // B
                    const bFarmBtnTD = aFarmBtnTD.nextElementSibling;
                    bFarmBtnTD.setAttribute('data-insidious-td-type', 'b_btn');
                    verifyFarmButton(bFarmBtnTD);

                    // C
                    const cFarmBtnTD = bFarmBtnTD.nextElementSibling;
                    cFarmBtnTD.setAttribute('data-insidious-td-type', 'c_btn');
                    verifyFarmButton(cFarmBtnTD);

                    function verifyFarmButton(btnParent) {
                        for (const btn of btnParent.children) {
                            const btnClassName = btn.getAttribute('class');
                            if (btnClassName.startsWith('farm_village_')) {
                                if (!btn.hasAttribute('id')) btn.setAttribute('id', 'a_btn_' + villageID);
    
                                if (btnClassName.includes('disabled')) {
                                    btn.setAttribute('data-insidious-farm-btn-status', 'disabled');
                                } else {
                                    btn.setAttribute('data-insidious-farm-btn-status', 'enabled');
                                };
    
                                break;
                            };
                        };
                    };

                    // Praça de reunião.
                    const placeButton = cFarmBtnTD.nextElementSibling;
                    placeButton.setAttribute('data-insidious-td-type', 'place');
                    for (const btn of placeButton.children) {
                        if (btn.hasAttribute('href')) {
                            if (!btn.hasAttribute('id')) btn.setAttribute('id', 'place_' + villageID);
                            break;
                        };
                    };
                };
            };

            ////// CONTROLE DE EVENTOS
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
        addInfo();
    };

    static get open() {return this.#open};
};

class FarmAbort {
    reason;
    
    constructor(reason?: string) {
        this.reason = reason;
    };
};