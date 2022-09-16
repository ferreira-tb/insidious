'use strict';
class TWFarm {
    static #open() {
        // Elementos originais.
        const plunderListFilters = document.querySelector('#plunder_list_filters');
        if (!plunderListFilters) throw new ElementError({ id: 'plunder_list_filters' });

        const farmModels = document.querySelector('#content_value div.vis div form table.vis tbody');
        if (!farmModels) throw new ElementError({ id: 'content_value div.vis div form table.vis tbody' });

        // Elementos da extensão.
        const menuArea = document.createElement('div');
        menuArea.setAttribute('id', 'insidious_farmMenuArea');
        plunderListFilters.parentNode.insertBefore(menuArea, plunderListFilters.nextElementSibling);

        const buttonArea = document.createElement('div');
        buttonArea.setAttribute('id', 'insidious_farmButtonArea');
        menuArea.appendChild(buttonArea);

        const actionArea = document.createElement('div');
        actionArea.setAttribute('id', 'insidious_farmActionArea');
        menuArea.appendChild(actionArea);

        ////// BOTÕES
        const startPlunderBtn = document.createElement('button');
        startPlunderBtn.setAttribute('class', 'insidious_farmButtonArea_Btn');
        startPlunderBtn.setAttribute('id', 'insidious_startPlunderBtn');

        ////// DADOS
        this.#info();

        // Recolhe dados sobre os modelos salvos.
        const aRow = farmModels.firstElementChild.nextElementSibling;
        const parentRow = { a: {}, b: {} };
        for (const field of farmModels.querySelectorAll('tr td input[type=\"text\"]')) {
            const fieldName = field.getAttribute('name');
            const fieldType = fieldName.slice(0, fieldName.indexOf('\['));

            if (field.parentElement.parentElement === aRow) {
                field.setAttribute('data-insidious-model-a', fieldType);
                Object.defineProperty(parentRow.a, fieldType, {
                    value: Number(field.value),
                    enumerable: true
                });

            } else {
                field.setAttribute('data-insidious-model-b', fieldType);
                Object.defineProperty(parentRow.b, fieldType, {
                    value: Number(field.value),
                    enumerable: true
                });
            };
        };

        Insidious.storage.set({ amodel: parentRow.a, bmodel: parentRow.b })
            .catch((err) => console.error(err));

        ////// EVENTOS
        const plunderBtnEvents = async () => {
            startPlunderBtn.removeEventListener('click', plunderBtnEvents);

            while (actionArea.firstChild) {
                actionArea.removeChild(actionArea.firstChild)
            };

            try {
                // Insidious não pode realizar operações fetch enquanto o plunder estiver ativo.
                const result = await Insidious.storage.get('isPlunderActive');
                if (result.isPlunderActive === true) {
                    await Insidious.storage.set({ isPlunderActive: false });
                    startPlunderBtn.innerText = 'Saquear';

                } else if (result.isPlunderActive === false) {
                    await Insidious.storage.set({ isPlunderActive: true });
                    await Insidious.storage.remove('totalPlundered');
                    startPlunderBtn.innerText = 'Parar';
                    this.#plunder();
                };

            } catch (err) {
                console.error(err);

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
                    startPlunderBtn.innerText = 'Parar';
                    this.#plunder();

                } else if (result.isPlunderActive === false) {
                    startPlunderBtn.innerText = 'Saquear';
                    Insidious.storage.remove('totalPlundered');

                } else if (result.isPlunderActive === undefined) {
                    startPlunderBtn.innerText = 'Saquear';
                    Insidious.storage.set({ isPlunderActive: false });
                };

            }).catch((err) => {
                // Caso haja algum erro, desativa o plunder, por segurança.
                Insidious.storage.set({ isPlunderActive: false });
                console.error(err);      
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

            const carryCapacity = {
                a: calcCarryCapacity(models.amodel),
                b: calcCarryCapacity(models.bmodel)
            };

            // Caso não exista um ratio salvo, usa o padrão e o registra.
            let ratio = await Insidious.storage.get('resourceRatio');
            if (!ratio.resourceRatio) {
                ratio = 0.8;
                Insidious.storage.set({ resourceRatio: 0.8 })
                    .catch((err) => console.error(err));
            };

            const sendAttack = async () => {
                for (const village of document.querySelectorAll('tr[data-insidious-tr-farm="true"]')) {
                    if (village.getAttribute('style')?.includes('display: none')) continue;

                    // Calcula a razão entre os recursos disponíveis e cada um dos modelos.
                    const resourceAmount = Number(village.dataset.insidiousResources);
                    const ratioA = Number((resourceAmount / carryCapacity.a).toFixed(2));
                    const ratioB = Number((resourceAmount / carryCapacity.b).toFixed(2));
                    // Em seguida, escolhe o maior entre eles.
                    const bestRatio = ratioA > ratioB ? { origin: 'a', value: ratioA } : { origin: 'b', value: ratioB };

                    // Verifica se há tropas disponíveis.
                    if (bestRatio.value > 0.8) {
                        const getTroopElem = (troop) => {
                            return Number(document.querySelector(`#farm_units #units_home tbody tr td#${troop}`).innerText);
                        };

                        // Lista das tropas disponíveis.
                        const availableTroops = {
                            spear: getTroopElem('spear'),
                            sword: getTroopElem('sword'),
                            axe: getTroopElem('axe'),
                            spy: getTroopElem('spy'),
                            light: getTroopElem('light'),
                            heavy: getTroopElem('heavy'),
                            knight: getTroopElem('knight')
                        };

                        // Modelo escolhido pela função.
                        const bestModel = models[bestRatio.origin + 'model'];

                        const checkAvailability = () => {
                            // É possível usar a mesma chave em ambas, pois a estrutura é exatamente igual.
                            for (const key in availableTroops) {
                                // Se houver menos tropas do que consta no modelo, a função deve ser interrompida.
                                if (availableTroops[key] < bestModel[key]) return false;
                            };
                            return true;
                        };

                        // Se as tropas estiverem disponíveis, envia o ataque após um delay aleatório.
                        if (checkAvailability()) {
                            new Promise((resolve, reject) => {
                                const attackCtrl = new AbortController();

                                const timerID = setTimeout(async () => {
                                    attackCtrl.abort();
                                    const attackButton = document.querySelector(`#${bestRatio.origin}_btn_${village.dataset.insidiousVillage}`);
                                    attackButton?.dispatchEvent(new Event('click'));

                                    const calcExpected = () => {
                                        const woodAmount = Number(village.dataset.insidiousWood);
                                        const stoneAmount = Number(village.dataset.insidiousStone);
                                        const ironAmount = Number(village.dataset.insidiousIron);

                                        const totalAmount = woodAmount + stoneAmount + ironAmount;
                                        const modelCarryCapacity = carryCapacity[bestRatio.origin];

                                        const woodRatio = Math.floor((woodAmount / totalAmount) * modelCarryCapacity);
                                        const stoneRatio = Math.floor((stoneAmount / totalAmount) * modelCarryCapacity);
                                        const ironRatio = Math.floor((ironAmount / totalAmount) * modelCarryCapacity);

                                        return [woodRatio, stoneRatio, ironRatio];
                                    };

                                    await this.#updatePlunderedAmount(...calcExpected());
                                    sendAttack();
                                    resolve();
                                }, Utils.generateIntegerBetween(1000, 3000));
 
                                plunderEventTarget.addEventListener('stopplundering', () => {
                                    clearTimeout(timerID);
                                    attackCtrl.abort();
                                    reject();
                                }, { signal: attackCtrl.signal });

                                document.querySelector('#insidious_startPlunderBtn').addEventListener('stopplundering', () => {
                                    clearTimeout(timerID);
                                    attackCtrl.abort();
                                    reject();
                                }, { signal: attackCtrl.signal });
                            });

                            break;
                        };
                    };
                };
            };

            // Após vários minutos, recarrega a página.
            // Como isPlunderActive === true, o plunder voltará a atacar automaticamente.
            const setPlunderTimeout = () => {
                return new Promise((resolve, reject) => {
                    const timeoutCtrl = new AbortController();

                    const plunderTimeoutID = setTimeout(async () => {
                        const plunderStatus = await Insidious.storage.get('isPlunderActive');
                        if (plunderStatus.isPlunderActive === false) {
                            reject();
                            return;
                        };

                        // Interrompe qualquer atividade no plunder e inicia a preparação para o recarregamento.
                        plunderEventTarget.dispatchEvent(new Event('stopplundering'));
                        timeoutCtrl.abort();
                        setTimeout(() => window.location.reload(), 5000);
                        resolve();

                    }, Utils.generateIntegerBetween((60000 * 20), (60000 * 30)));

                    document.querySelector('#insidious_startPlunderBtn').addEventListener('click', () => {
                        clearTimeout(plunderTimeoutID);
                        timeoutCtrl.abort();
                        reject();
                    }, { signal: timeoutCtrl.signal });
                });
            };

            // Alea iacta est.
            sendAttack();
            setPlunderTimeout();

        } catch (err) {
            console.error(err);
        };   
    };

    static #info() {
        const plunderList = document.querySelector('#plunder_list tbody');
        if (!plunderList) throw new ElementError({ id: 'plunder_list tbody' });

        // Ajuda a controlar o MutationObserver.
        const infoEventTarget = new EventTarget();

         // Adiciona informações úteis às tags HTML originais da página.
        const addInfo = () => {
            // Desconecta qualquer observer que esteja ativo.
            infoEventTarget.dispatchEvent(new Event('stopinfoobserver'));

            for (const child of plunderList.children) {
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
                    child.setAttribute('data-insidious-date', Utils.decipherDate(lastBattleDate.innerText));

                    // Quantidade de recursos.
                    const expectedResources = lastBattleDate.nextElementSibling;
                    expectedResources.setAttribute('data-insidious-td-type', 'resources');
                    child.setAttribute('data-insidious-resources', calcResourceAmount());

                    function calcResourceAmount() {
                        let result = 0;
                        for (const span of expectedResources.children) result += Number(getAmount(span));
                        return result;
                    };

                    function getAmount(span) {
                        const querySpan = (className) => {
                            const resSpan = span.querySelector(`.${className}`);                        
                            if (!resSpan) return;

                            const resValue = resSpan.innerText.replaceAll('.', '');
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
                    };

                    // Muralha.
                    const wallLevel = expectedResources.nextElementSibling;
                    wallLevel.setAttribute('data-insidious-td-type', 'wall');
                    child.setAttribute('data-insidious-wall', String(wallLevel.innerText));

                    // Distância.
                    const villageDistance = wallLevel.nextElementSibling;
                    villageDistance.setAttribute('data-insidious-td-type', 'distance');
                    child.setAttribute('data-insidious-distance', String(villageDistance.innerText));

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

    static async #showPlunderedAmount() {
        const actionArea = document.querySelector('#insidious_farmActionArea');
        while (actionArea.firstChild) actionArea.removeChild(actionArea.firstChild);

        const plundered = await Insidious.storage.get('totalPlundered');

        const spanContainer = document.createElement('span');
        spanContainer.setAttribute('class', 'nowrap');
        spanContainer.setAttribute('data-insidious-custom', 'true');
        actionArea.appendChild(spanContainer);

        // MADEIRA
        const plunderedWood = Utils.createResourceSpan('wood');
        spanContainer.appendChild(plunderedWood);

        const woodAmount = Utils.createResourceSpanLabel('wood');
        woodAmount.setAttribute('id', 'insidious_plundered_wood');
        woodAmount.innerText = plundered.totalPlundered?.wood ?? 0;
        spanContainer.appendChild(woodAmount);

        // ARGILA
        const plunderedStone = Utils.createResourceSpan('stone');
        spanContainer.appendChild(plunderedStone);

        const stoneAmount = Utils.createResourceSpanLabel('stone');
        stoneAmount.setAttribute('id', 'insidious_plundered_stone');
        stoneAmount.innerText = plundered.totalPlundered?.stone ?? 0;
        spanContainer.appendChild(stoneAmount);

        // FERRO
        const plunderediron = Utils.createResourceSpan('iron');
        spanContainer.appendChild(plunderediron);

        const ironAmount = Utils.createResourceSpanLabel('iron');
        ironAmount.setAttribute('id', 'insidious_plundered_iron');
        ironAmount.innerText = plundered.totalPlundered?.iron ?? 0;
        spanContainer.appendChild(ironAmount);
    };

    static async #updatePlunderedAmount(wood, stone, iron) {
        try {
            const plundered = await Insidious.storage.get('totalPlundered');
            if (plundered.totalPlundered) {
                const updatedValues = {
                    wood: plundered.totalPlundered.wood + wood,
                    stone: plundered.totalPlundered.stone + stone,
                    iron: plundered.totalPlundered.iron + iron
                };

                await Insidious.storage.set({ totalPlundered: updatedValues });

                document.querySelector('#insidious_plundered_wood').innerText = updatedValues.wood;
                document.querySelector('#insidious_plundered_stone').innerText = updatedValues.stone;
                document.querySelector('#insidious_plundered_iron').innerText = updatedValues.iron;

            } else {
                await Insidious.storage.set({ totalPlundered: {
                    wood: wood,
                    stone: stone,
                    iron: iron
                }});
            };

        } catch (err) {
            console.error(err);
        };
    };

    static get open() {return this.#open};
};