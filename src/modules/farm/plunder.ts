class Plunder extends TWFarm {
    static #models: UnitModels;
    static #carryCapacity: SNObject;

    // Ajuda a controlar o estado das promises.
    static readonly #eventTarget = new EventTarget();

    static async #start() {
        try {
            // Exibe a quantidade de recursos saqueado durante o período em que o plunder estiver ativo.
            // A função #updatePlunderedAmount() atualiza essa informação após cada ataque feito.
            await this.#showPlunderedAmount();

            // Informações sobre cada tipo de unidade do jogo.
            if (!Insidious.unitInfo.unit) {
                await browser.storage.local.remove('worldConfigFetch');
                throw new InsidiousError('Não foi possível obter as informações sobre as unidades do jogo.');
            };

            // Modelos de saque do usuário.
            this.#models = await browser.storage.local.get(['amodel', 'bmodel']);
            if (!this.#models.amodel) throw new InsidiousError('Os dados do modelo A não estão presentes no banco de dados.');
            if (!this.#models.bmodel) throw new InsidiousError('Os dados do modelo B não estão presentes no banco de dados.');

            this.#carryCapacity = this.#getCarryCapacity();

            // Alea iacta est.
            this.#sendAttack();

            // Após vários minutos, recarrega a página.
            // Como isPlunderActive === true, o plunder voltará a atacar automaticamente.
            this.#setPlunderTimeout().catch((err: unknown) => {
                if (err instanceof FarmAbort) {
                    if (err.reason) console.error(err.reason);
                    return;
                };
            });

        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static async #sendAttack(): Promise<void> {
        try {
            // Representa cada linha na tabela.
            const villageRows = document.querySelectorAll('tr[insidious-tr-farm="true"]');
            for (const village of (villageRows as unknown) as HTMLElement[]) {
                // Ignora a linha caso ela esteja oculta.
                // Elas automaticamente ficam ocultas assim que são atacadas.
                if (village.getAttribute('style')?.includes('display: none')) continue;
                
                // Caso não hajam informações obtidas por exploradores, a linha é ignorada.
                // No entanto, emite um erro caso a função addInfo() tiver falhado em criar o atributo.
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
                let bestRatio: ABNull = null, otherRatio: ABNull = null;
                const verifyRatio = (): boolean => {
                    const bigger: AB = this.#carryCapacity.a >= this.#carryCapacity.b ? 'a' : 'b';
                    const smaller: AB = this.#carryCapacity.a < this.#carryCapacity.b ? 'a' : 'b';

                    // Se ambos são menores que a quantidade de recursos, basta mandar o maior.
                    // A diferença entre a carga do maior e a quantidade de recursos não é relevante nesse caso.
                    if (resourceAmount >= this.#carryCapacity[bigger]) {
                        bestRatio = bigger;
                        otherRatio = smaller;
                        return true;

                    // Se os dois são maiores, descartam-se aqueles que estejam fora da zona aceitável.
                    // Se todos forem descartados, a função será obrigada a retornar false.
                    } else if (resourceAmount <= this.#carryCapacity[smaller]) {
                        bestRatio = resourceAmount / this.#carryCapacity[smaller] >= 0.8 ? smaller : null;
                        otherRatio = resourceAmount / this.#carryCapacity[bigger] >= 0.8 ? bigger : null;
                        if (bestRatio !== null) return true;
                        return false;

                    // Nesse caso, a quantidade de recursos é maior que a carga de um, mas menor que a de outro.
                    } else {
                        // Razão em relação ao maior (será sempre MENOR que 1).
                        const ratioB = resourceAmount / this.#carryCapacity[bigger];
                        // Razão em relação ao menor (será sempre MAIOR que 1).
                        const ratioS = resourceAmount / this.#carryCapacity[smaller];

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

                    // Retorna uma função, que então é guardada em checkAvailability.
                    // Essa nova função guarda o escopo de this.#getAvailableTroops.
                    const checkAvailability = this.#getAvailableTroops();
                    
                    // Modelo escolhido pela função verifyRatio.
                    const bestModel: SNObject = this.#models[bestRatio + 'model'];

                    // Esse boolean determina se o ataque é enviado ou não.
                    let attackIsPossible: boolean = checkAvailability(bestModel);

                    // Caso não hajam tropas disponíveis, verifica se um ataque usando o outro modelo seria aceitável.
                    if (otherRatio !== null && !attackIsPossible) {
                        const otherModel = this.#models[otherRatio + 'model'];
                        // Em caso positivo, determina o outro modelo como bestRatio.
                        if (checkAvailability(otherModel)) {
                            bestRatio = otherRatio;
                            attackIsPossible = true;
                        };
                    };
                    
                    // Se as tropas estiverem disponíveis, envia o ataque após um delay aleatório.
                    if (attackIsPossible) {
                        // Esse return não pode ser removido, caso contrário o código após o FOR será executado indevidamente.
                        return new Promise<void>((resolve, reject) => {
                            if (Utils.isThereCaptcha()) {
                                browser.storage.local.set({ isPlunderActive: false });
                                this.#eventTarget.dispatchEvent(new Event('stopplundering'));
                                this.#eventTarget.dispatchEvent(new Event('cancelautoreload'));
                                reject(new FarmAbort());
                                return;   
                            };

                            const attackCtrl = new AbortController();
                            const timerID = setTimeout(async () => {
                                try {
                                    // Envia o ataque e espera até que o servidor dê uma resposta.
                                    await this.#handleAttack(village, bestRatio as AB);

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
                                            if (totalAmount > this.#carryCapacity[bestRatio as string]) {
                                                return Math.floor((amount / totalAmount) * this.#carryCapacity[bestRatio as string]);
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
                            }, Utils.generateIntegerBetween(250, 350));

                            this.#eventTarget.addEventListener('stopplundering', () => {
                                clearTimeout(timerID);
                                attackCtrl.abort();
                                reject(new FarmAbort());
                            }, { signal: attackCtrl.signal });

                            document.querySelector('#insidious_startPlunderBtn')?.addEventListener('click', () => {
                                clearTimeout(timerID);
                                attackCtrl.abort();
                                reject(new FarmAbort());
                            }, { signal: attackCtrl.signal });

                        }).then(() => this.#sendAttack()).catch((err) => {
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

            // Caso, em toda tabela, não haja aldeia adequada para envio do ataque, verifica se há mais páginas.
            // Em caso positivo, navega para a próxima após um breve delay.
            setTimeout(() => this.#navigateToNextPlunderPage(), Utils.generateIntegerBetween(2000, 3000));

        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    // O plunder cumpre sua tarefa bem mais rápido que o servidor consegue responder.
    // No entanto, como ele depende do número de tropas ditado pelo jogo, é necessário esperar o valor ser atualizado.
    static #handleAttack(village: Element, bestRatio: AB) {
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
            if (!attackButton) throw new InsidiousError(`O botão ${bestRatio.toUpperCase()} não foi encontrado.`);
            attackButton.dispatchEvent(new Event('click')); 
        });
    };

    static #getCarryCapacity(): SNObject {
        // Calcula a capacidade total de carga com base nos dados salvos.
        const calcEachCarryCapacity = (unitModel: SNObject) => {
            let result: number = 0;
            for (const key in unitModel) {
                // Ignora o explorador, já que ele não pode carregar recursos.
                if (key !== 'spy') result += unitModel[key] * Insidious.unitInfo.unit[key as UnitList].carry;
            };

            if (!Number.isInteger(result)) {
                throw new InsidiousError('O valor calculado para a capacidade de carga é inválido.');
            };
            return result;
        };

        const capacityA: number = calcEachCarryCapacity(this.#models.amodel);
        const capacityB: number = calcEachCarryCapacity(this.#models.bmodel);

        // Caso o valor seja zero, surge uma divisão por zero no cálculo da razão.
        // Qualquer valor dividido por Infinity se torna zero, o que o torna a melhor opção lá.
        return {
            a: capacityA === 0 ? Infinity : capacityA,
            b: capacityB === 0 ? Infinity : capacityB,
        };
    };

    static #getAvailableTroops() {
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

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures
        return function(model: SNObject): boolean {
            // É possível usar a mesma chave em ambas, pois a estrutura é exatamente igual.
            for (const key in availableTroops) {
                // Se houver menos tropas do que consta no modelo, a função deve ser interrompida.
                if (availableTroops[key as keyof typeof availableTroops] < model[key]) return false;
            };
            return true;
        };
    };

    static #navigateToNextPlunderPage() {
        // Antes de ir para a próxima página, verifica se há tropas disponíveis em algum dos modelos.
        const checkAvailability = this.#getAvailableTroops();
        // this.#getCarryCapacity atribui Infinity caso a capacidade seja igual a zero.
        // Isso é feito para evitar divisões por zero.
        let statusA: boolean = false, statusB: boolean = false;
        if (checkAvailability(this.#models.amodel) && this.#carryCapacity.a !== Infinity) statusA = true;
        if (checkAvailability(this.#models.bmodel) && this.#carryCapacity.b !== Infinity) statusB = true;
        if (statusA === false && statusB === false) return;

        try {
            // Linha da tabela com os números das páginas.
            const plunderListNav = document.querySelector('#plunder_list_nav table tbody tr td');

            if (plunderListNav) {
                const currentPageElement = plunderListNav.querySelector('strong.paged-nav-item');

                // Analisa os links disponíveis para determinar quantos existem.
                const getPageNumber = (element: Element) => Number.parseInt((element.textContent as string).replace(/\D/g, ''), 10);
                let plunderPages: number[] = Array.from(plunderListNav.querySelectorAll('a.paged-nav-item'), getPageNumber);
                plunderPages = plunderPages.filter((item) => !Number.isNaN(item));
                if (!currentPageElement?.textContent || plunderPages.length === 0) return;

                // Identifica a página atual.
                const currentPage = Number.parseInt(currentPageElement.textContent.replace(/\D/g, ''), 10);
                if (Number.isNaN(currentPage)) throw new InsidiousError('Não foi possível identificar a página atual.');
                // Anexa a página atual na array e em seguida a ordena.
                plunderPages.push(currentPage);
                plunderPages.sort((a, b) => a - b);

                // Seleciona um link arbitrário para servir como referência para a construção do novo.
                // Exemplo de link: "/game.php?village=23215&screen=am_farm&order=distance&dir=asc&Farm_page=1".
                const plunderPageArbitraryLink = plunderListNav.querySelector('a.paged-nav-item');
                if (!plunderPageArbitraryLink) throw new InsidiousError('Não foi encontrado um link de referência para a navegação.');
                const plunderPageURL = plunderPageArbitraryLink.getAttribute('href');
                if (!plunderPageURL) throw new InsidiousError('Não foi possível obter a URL para a navegação entre as páginas.');

                // Determina qual página foi escolhida arbitrariamente.
                let arbitraryPage: string | string[] = plunderPageURL.split('&').filter((item) => item.includes('Farm_page='));
                arbitraryPage = arbitraryPage[0].replace(/\D/g, '');

                // Caso a página atual seja a última página, volta para a primeira.
                // Ao contrário de como acontece na lista, as páginas no link começam no índice zero.
                // Ou seja, no link, a página 2 é representada por "Farm_page=1", e a página 5 por "Farm_page=4".
                // Então é necessário diminuir em um o valor quando se quer ir para uma página em espécifico.
                if (currentPage === plunderPages.at(-1)) {
                    location.href = newLocation(plunderPages[0] - 1);

                // Para navegar para a próxima página, é preciso usar currentPage ao atribuir o link.
                // Isso porquê currentPage é a numeração na lista (começa no indíce 1) e o link começa no índice zero.
                // Logo, se a página atual é a 3, seu link é "Farm_page=2", com o link da próxima sendo "Farm_page=3".
                } else {
                    location.href = newLocation(currentPage);
                };

                function newLocation(pageIndex: number) {
                    return plunderPageURL!.replace(`Farm_page=${arbitraryPage}`, `Farm_page=${String(pageIndex)}`);
                };
            };

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

    static #setPlunderTimeout() {
        return new Promise<void>((resolve, reject) => {
            const autoReloadCtrl = new AbortController();

            const plunderTimeoutID = setTimeout(() => {
                // Interrompe qualquer atividade no plunder e inicia a preparação para o recarregamento.
                this.#eventTarget.dispatchEvent(new Event('stopplundering'));
                autoReloadCtrl.abort();
                setTimeout(() => window.location.reload(), 5000);
                resolve();
            }, Utils.generateIntegerBetween((60000 * 20), (60000 * 30)));

            document.querySelector('#insidious_startPlunderBtn')?.addEventListener('click', () => {
                clearTimeout(plunderTimeoutID);
                autoReloadCtrl.abort();
                reject(new FarmAbort());
            }, { signal: autoReloadCtrl.signal });

            this.#eventTarget.addEventListener('cancelautoreload', () => {
                clearTimeout(plunderTimeoutID);
                autoReloadCtrl.abort();
                resolve();
            }, { signal: autoReloadCtrl.signal });
        });
    };

    static get start() { return this.#start };
};