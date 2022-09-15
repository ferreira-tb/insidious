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

        ////// BOTÕES
        const startPlunderBtn = document.createElement('button');
        startPlunderBtn.setAttribute('class', 'insidious_farmButtonArea_Btn');
        Insidious.storage.get('isPlunderActive')
            .then((result) => {
                buttonArea.appendChild(startPlunderBtn);
                if (result.isPlunderActive === true) {
                    startPlunderBtn.innerText = 'Parar';
                } else if (result.isPlunderActive === false) {
                    startPlunderBtn.innerText = 'Saquear';
                } else if (result.isPlunderActive === undefined) {
                    Insidious.storage.set({ isPlunderActive: false });
                };

            }).catch((err) => console.error(err));

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
            try {
                // Insidious não pode realizar operações fetch enquanto o plunder estiver ativo.
                const result = await Insidious.storage.get('isPlunderActive');
                if (result.isPlunderActive === true) {
                    await Insidious.storage.set({ isPlunderActive: false });
                    startPlunderBtn.innerText = 'Saquear';
                    console.log('parar');

                } else if (result.isPlunderActive === false) {
                    await Insidious.storage.set({ isPlunderActive: true });
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
    };

    static #plunder() {
        console.log('plunder start');
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
                    lastBattleDate.setAttribute('data-insidious-date', Utils.decipherDate(lastBattleDate.innerText));

                    const expectedResources = lastBattleDate.nextElementSibling;
                    expectedResources.setAttribute('data-insidious-td-type', 'resources');
                    expectedResources.setAttribute('data-insidious-total-amount', calcResourceAmount());

                    function calcResourceAmount() {
                        let result = 0;
                        for (const span of expectedResources.children) result += Number(getAmount(span));
                        return result;
                    };

                    function getAmount(span) {
                        function* findValidClass() {
                            yield span.querySelector('.res')?.innerText?.replaceAll('.', '');
                            yield span.querySelector('.warn')?.innerText?.replaceAll('.', '');
                            yield span.querySelector('.warn_90')?.innerText?.replaceAll('.', '');
                        };

                        for (const text of findValidClass()) if (text) return text;
                    };

                    const wallLevel = expectedResources.nextElementSibling;
                    wallLevel.setAttribute('data-insidious-td-type', 'wall');
                    wallLevel.setAttribute('data-insidious-wall-level', String(wallLevel.innerText));

                    const villageDistance = wallLevel.nextElementSibling;
                    villageDistance.setAttribute('data-insidious-td-type', 'distance');
                    villageDistance.setAttribute('data-insidious-distance', String(villageDistance.innerText));

                    const aFarmBtnTD = villageDistance.nextElementSibling;
                    aFarmBtnTD.setAttribute('data-insidious-td-type', 'a_btn');
                    for (const btn of aFarmBtnTD.children) {
                        if (btn.getAttribute('class').startsWith('farm_village_')) {
                            if (!btn.hasAttribute('id')) btn.setAttribute('id', 'a_btn_' + villageID);
                            break;
                        };
                    };

                    const bFarmBtnTD = aFarmBtnTD.nextElementSibling;
                    bFarmBtnTD.setAttribute('data-insidious-td-type', 'b_btn');
                    for (const btn of bFarmBtnTD.children) {
                        if (btn.getAttribute('class').startsWith('farm_village_')) {
                            if (!btn.hasAttribute('id')) btn.setAttribute('id', 'b_btn_' + villageID);
                            break;
                        };
                    };

                    const cFarmBtnTD = bFarmBtnTD.nextElementSibling;
                    cFarmBtnTD.setAttribute('data-insidious-td-type', 'c_btn');
                    for (const btn of cFarmBtnTD.children) {
                        if (btn.getAttribute('class').startsWith('farm_village_')) {
                            if (!btn.hasAttribute('id')) btn.setAttribute('id', 'c_btn_' + villageID);
                            break;
                        };
                    };

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