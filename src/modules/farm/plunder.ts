class Plunder extends TWFarm {
    static #models: UnitModels;
    static #carryCapacity: CarryCapacity;
    public static options: PlunderOptions;
    static #optionsParameters: PlunderOptionsParameters;
    static #ram: number | null = null;

    // Ajuda a controlar o estado das promises.
    static readonly #eventTarget = new EventTarget();

    static async #start() {
        try {
            // Exibe a quantidade de recursos saqueado durante o período em que o plunder estiver ativo.
            // A função #updatePlunderedAmount() atualiza essa informação após cada ataque feito.
            await this.#showPlunderedAmount();

            // Informações sobre cada tipo de unidade do jogo.
            if (!Insidious.unitInfo[`unit_${Insidious.world}`]) {
                await browser.storage.local.remove(`worldConfigFetch_${Insidious.world}`);
                throw new InsidiousError('Não foi possível obter as informações sobre as unidades do jogo.');
            };

            // Opções do plunder.
            const plunderOptions = `plunderOptions_${Insidious.world}`;
            this.options = (await browser.storage.local.get(plunderOptions))[plunderOptions] as PlunderOptions ?? {};

            // Parâmetros das opções.
            const optionsParameters = `plunderOptionsParameters_${Insidious.world}`;
            this.#optionsParameters = (await browser.storage.local.get(optionsParameters))[optionsParameters] as PlunderOptionsParameters ?? {};

            // Prepara os ataques usando o grupo Insidious.
            if (this.options.group_attack === true) await GroupAttack.start();

            // Modelos de saque do usuário.
            this.#models = await browser.storage.local.get([`amodel_${Insidious.world}`, `bmodel_${Insidious.world}`]);
            if (!this.#models[`amodel_${Insidious.world}`]) throw new InsidiousError('Os dados do modelo A não estão presentes no banco de dados.');
            if (!this.#models[`bmodel_${Insidious.world}`]) throw new InsidiousError('Os dados do modelo B não estão presentes no banco de dados.');

            this.#carryCapacity = this.#getCarryCapacity();

            // Alea iacta est.
            this.#sendAttack();

            // Após vários minutos, recarrega a página.
            // Como isPlunderActive === true, o plunder voltará a atacar automaticamente.
            this.#setPlunderTimeout().catch((err: unknown) => {
                if (err instanceof FarmAbort) {
                    if (err.reason) InsidiousError.handle(err.reason);
                    return;
                };
            });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static async #sendAttack(): Promise<void> {
        try {
            // Se a opção de exibir aldeias sob ataque estiver ativa, exibe um aviso.
            // O usuário poderá ou desativá-la ou encerrar o Plunder.
            const areThereVillagesUnderAttack = await this.#areThereVillagesUnderAttack();
            if (areThereVillagesUnderAttack) {
                this.#forceStopPlunder();
                return;
            };
            
            // Representa cada linha na tabela.
            const villageRows = Array.from(document.querySelectorAll('tr[insidious-tr-farm="true"]')) as HTMLElement[];
            for (const village of villageRows) {
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

                // Determina o nível da muralha.
                let wallLevel: string | number | null = village.getAttribute('insidious-wall');
                if (!wallLevel) throw new InsidiousError('Não foi possível determinar o nível da muralha.');

                wallLevel = Number.parseInt(wallLevel, 10)
                if (Number.isNaN(wallLevel)) throw new InsidiousError('O nível da muralha é inválido.');

                // Envia aríetes caso a aldeia possua muralha e "demolir muralha" esteja ativo.
                // Se o ataque for enviado com sucesso, pula para a próxima aldeia.
                // Em hipótese alguma "destroy_wall" pode estar após "ignore_wall".
                if (this.options.destroy_wall === true && wallLevel !== 0) {
                    const skipToNextVillage = await this.#destroyWall(village, wallLevel as WallLevel);
                    if (skipToNextVillage === true) continue;
                };

                // A aldeia é ignorada caso possua muralha e "ignorar muralha" esteja ativo.
                if (this.options.ignore_wall === true && wallLevel !== 0) continue;

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
                    const bestModel: SNObject = this.#models[`${bestRatio}model_${Insidious.world}`];

                    // Esse boolean determina se o ataque é enviado ou não.
                    let attackIsPossible: boolean = checkAvailability(bestModel);

                    // Caso não hajam tropas disponíveis, verifica se um ataque usando o outro modelo seria aceitável.
                    if (otherRatio !== null && !attackIsPossible) {
                        const otherModel = this.#models[`${otherRatio}model_${Insidious.world}`];
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
                                this.#forceStopPlunder();
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

                                        let totalAmount = allResources.reduce((previous, current) => previous + current, 0);
                                        
                                        // Caso a soma resulte em zero, "totalAmount = Infinity" garante que não surja uma divisão por zero mais adiante.
                                        // Qualquer valor dividido por Infinity é igual a zero.
                                        if (totalAmount === 0) totalAmount = Infinity;

                                        return allResources.map((amount: number) => {
                                            // Se houver mais recursos do que a carga suporta, calcula quanto de cada recurso deve ser saqueado.
                                            if (totalAmount > this.#carryCapacity[bestRatio as AB]) {
                                                return Math.floor((amount / totalAmount) * this.#carryCapacity[bestRatio as AB]);
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
                                browser.storage.local.remove(`plunderOptionsParameters_${Insidious.world}`)
                                    .catch((err: unknown) => {
                                        if (err instanceof Error) {
                                            InsidiousError.handle(err);
                                        };
                                    });

                                clearTimeout(timerID);
                                attackCtrl.abort();
                                reject(new FarmAbort());
                            }, { signal: attackCtrl.signal });

                            document.querySelector('#insidious_startPlunderBtn')?.addEventListener('click', () => {
                                clearTimeout(timerID);
                                attackCtrl.abort();
                                reject(new FarmAbort());
                            }, { signal: attackCtrl.signal });

                        }).then(() => this.#sendAttack()).catch((err: unknown) => {
                            if (err instanceof FarmAbort) {
                                if (err.reason) InsidiousError.handle(err.reason);
                                return;

                            } else if (err instanceof Error) {
                                InsidiousError.handle(err);
                            };
                        });
                    };
                };
            };

            // Caso, em toda tabela, não haja aldeia adequada para envio do ataque, verifica se há mais páginas.
            // Em caso positivo, navega para a próxima após um breve delay.
            // Se não houverem outras páginas ou tropas disponíveis, navega para a próxima aldeia caso this.#options.group_attack === true.
            setTimeout(() => this.#navigateToNextPlunderPage(), Utils.generateIntegerBetween(2000, 3000));

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
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

    static #getCarryCapacity(): CarryCapacity {
        // Calcula a capacidade total de carga com base nos dados salvos.
        const calcEachCarryCapacity = (unitModel: SNObject) => {
            let result: number = 0;
            for (const key in unitModel) {
                // Ignora o explorador, já que ele não pode carregar recursos.
                if (key !== 'spy') result += unitModel[key] * Insidious.unitInfo[`unit_${Insidious.world}`][key as UnitList].carry;
            };

            if (!Number.isInteger(result)) {
                throw new InsidiousError('O valor calculado para a capacidade de carga é inválido.');
            };
            return result;
        };

        const capacityA: number = calcEachCarryCapacity(this.#models[`amodel_${Insidious.world}`]);
        const capacityB: number = calcEachCarryCapacity(this.#models[`bmodel_${Insidious.world}`]);

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

        if (!Insidious.worldInfo[`config_${Insidious.world}`].game) {
            browser.storage.local.remove(`worldConfigFetch_${Insidious.world}`);
            throw new InsidiousError('Não foi possível obter as configurações do mundo.');
        };

        // Caso o mundo tenha arqueiros, adiciona-os à lista.
        if (Insidious.worldInfo[`config_${Insidious.world}`].game.archer === 1) {
            Object.defineProperties(availableTroops, {
                archer: {
                    value: getUnitElem('archer'),
                    enumerable: true,
                    writable: false,
                    configurable: false
                },

                marcher: {
                    value: getUnitElem('marcher'),
                    enumerable: true,
                    writable: false,
                    configurable: false
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
        if (checkAvailability(this.#models[`amodel_${Insidious.world}`]) && this.#carryCapacity.a !== Infinity) statusA = true;
        if (checkAvailability(this.#models[`bmodel_${Insidious.world}`]) && this.#carryCapacity.b !== Infinity) statusB = true;
        if (statusA === false && statusB === false) {
            // Caso a aldeia se torne a última num grupo dinâmico, a seta de navegação continua ativa.
            // Em decorrência disso, o plunder fica navegando para a mesma aldeia repetidas vezes.
            // Para impedir isso, é necessário verificar qual foi a última aldeia que realizou um ataque.
            // O valor de last_attacking_village só é atualizado durante a execução de navigateToNextVillage().
            // Como isso ocorre somente após a verificação, não há risco envolvido.
            if (this.#optionsParameters.last_attacking_village === Insidious.currentVillageID) return;
            if (this.options.group_attack === true) this.#navigateToNextVillage();
            return;
        };

        try {
            // Linha da tabela com os números das páginas.
            const plunderListNav = document.querySelector('#plunder_list_nav table tbody tr td');

            if (plunderListNav) {
                const currentPageElement = plunderListNav.querySelector('strong.paged-nav-item');

                // Analisa os links disponíveis para determinar quantos existem.
                const getPageNumber = (element: Element) => Number.parseInt((element.textContent as string).replace(/\D/g, ''), 10);
                let plunderPages: number[] = Array.from(plunderListNav.querySelectorAll('a.paged-nav-item'), getPageNumber);
                plunderPages = plunderPages.filter((item) => !Number.isNaN(item));

                if (!currentPageElement?.textContent || plunderPages.length === 0) {
                    if (this.options.group_attack === true) this.#navigateToNextVillage();
                    return;
                };

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
                    location.assign(newLocation(plunderPages[0] - 1));

                // Para navegar para a próxima página, é preciso usar currentPage ao atribuir o link.
                // Isso porquê currentPage é a numeração na lista (começa no indíce 1) e o link começa no índice zero.
                // Logo, se a página atual é a 3, seu link é "Farm_page=2", com o link da próxima sendo "Farm_page=3".
                } else {
                    location.assign(newLocation(currentPage));
                };

                function newLocation(pageIndex: number) {
                    return plunderPageURL!.replace(`Farm_page=${arbitraryPage}`, `Farm_page=${String(pageIndex)}`);
                };
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    // Navega para a próxima aldeia caso this.#options.group_attack === true.
    static async #navigateToNextVillage() {
        try {
            const groupKey = `farmGroupID_${Insidious.world}`;
            const groupID = (await browser.storage.local.get(groupKey))[groupKey] as string | undefined;
            if (Utils.currentGroup() !== groupID) return;

            const rightArrow = document.querySelector('a#village_switch_right span.groupRight') as HTMLSpanElement | null;
            if (rightArrow) {
                // Antes de mudar de aldeia, salva a atual como última aldeia atacante.
                if (Insidious.currentVillageID) {
                    this.#optionsParameters.last_attacking_village = Insidious.currentVillageID;
                    await browser.storage.local.set({ [`plunderOptionsParameters_${Insidious.world}`]: this.#optionsParameters });
                };

                rightArrow.click();
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static async #showPlunderedAmount() {
        try {
            const actionArea = document.querySelector('#insidious_farmActionArea');
            if (!actionArea) throw new InsidiousError('DOM: #insidious_farmActionArea');
            Manatsu.removeChildren(actionArea);

            const plundered: TotalPlundered = await browser.storage.local.get(`totalPlundered_${Insidious.world}`);
            const { wood = 0, stone = 0, iron = 0 }: SNObject = plundered[`totalPlundered_${Insidious.world}`] ?? { };

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
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static async #updatePlunderedAmount(...args: number[]) {
        const [wood, stone, iron] = args;
        const woodLabel = document.querySelector('#insidious_plundered_wood');
        const stoneLabel = document.querySelector('#insidious_plundered_stone');
        const ironLabel = document.querySelector('#insidious_plundered_iron');

        try {
            const plundered: TotalPlundered = await browser.storage.local.get(`totalPlundered_${Insidious.world}`);
            if (plundered[`totalPlundered_${Insidious.world}`]) {
                const updatedValues = {
                    wood: plundered[`totalPlundered_${Insidious.world}`].wood + wood,
                    stone: plundered[`totalPlundered_${Insidious.world}`].stone + stone,
                    iron: plundered[`totalPlundered_${Insidious.world}`].iron + iron
                };

                await browser.storage.local.set({ [`totalPlundered_${Insidious.world}`]: updatedValues });

                if (woodLabel && stoneLabel && ironLabel) {
                    woodLabel.textContent = String(updatedValues.wood);
                    stoneLabel.textContent = String(updatedValues.stone);
                    ironLabel.textContent = String(updatedValues.iron);
                };

            } else {
                await browser.storage.local.set({ [`totalPlundered_${Insidious.world}`]: {
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
            if (err instanceof Error) InsidiousError.handle(err);
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

                // 60000 milisegundos equivalem a 1 minuto.
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

    // A promise retornada por #destroyWall() resolve com um boolean.
    // Se o resultado for true, o ataque foi enviado e #sendAttack() deve pular para a próxima aldeia.
    // Se for false, #sendAttack() deve continuar a execução atual.
    static #destroyWall(village: HTMLElement, wallLevel: WallLevel) {
        return new Promise<boolean>(async (resolve, reject) => {
            // Quantidade de bárbaros.
            const axeField = document.querySelector('td[insidious-available-units="axe"]');
            if (!axeField || !axeField.textContent) throw new InsidiousError('Não foi possível determinar a quantidade de bárbaros disponíveis.');
            const axeAmount = Number.parseInt(axeField.textContent, 10);
            if (Number.isNaN(axeAmount)) throw new InsidiousError('A quantidade de bárbaros obtida é inválida.');

            // Quantidade de exploradores.
            const spyField = document.querySelector('td[insidious-available-units="spy"]');
            if (!spyField || !spyField.textContent) throw new InsidiousError('Não foi possível determinar a quantidade de exploradores disponíveis.');
            const spyAmount = Number.parseInt(spyField.textContent, 10);
            if (Number.isNaN(spyAmount)) throw new InsidiousError('A quantidade de exploradores obtida é inválida.');

            // Verifica se há tropas disponíveis para destruir a muralha.
            const canDestroy = (neededRams: number, neededAxes: number): boolean => {
                if (neededRams > (this.#ram as number) || neededAxes > axeAmount || spyAmount < 1) {
                    return false;
                };
                return true;
            };

            // Tropas necessárias para cada nível possível da muralha.
            const neededUnits = TWAssets.unitsToDestroyWall[wallLevel] as [number, number];

            // Caso a quantidade de aríetes já esteja salva, verifica se há tropas suficientes.
            // Em caso negativo, resolve a promise.
            if (typeof this.#ram === 'number' && !canDestroy(...neededUnits)) {
                resolve(false);
                return;
            };

            try {
                // Abre a janela de comando e obtém a quantidade de aríetes.
                this.#ram = await this.#openPlace(village);

                const closeButton = document.querySelector('#popup_box_popup_command a.popup_box_close') as HTMLElement | null;
                if (!closeButton) throw new InsidiousError('Não foi possível encontrar o botão para fechar a janela de comando.');

                // Caso o valor obtido seja inválido, reseta this.#ram e emite um erro.
                if (Number.isNaN(this.#ram)) {
                    this.#ram = null;
                    closeButton.click();
                    throw new InsidiousError('A quantidade de aríetes obtida é inválida.');

                } else if (canDestroy(...neededUnits)) {
                    const commandForm = document.querySelector('form#command-data-form');
                    if (!commandForm) throw new InsidiousError('A janela de comando não está presente.');

                    const ramInputField = commandForm.querySelector('#unit_input_ram.unitsInput') as HTMLInputElement | null;
                    if (!ramInputField) throw new InsidiousError('DOM: #unit_input_ram.unitsInput');

                    const axeInputField = commandForm.querySelector('#unit_input_axe.unitsInput') as HTMLInputElement | null;
                    if (!axeInputField) throw new InsidiousError('DOM: #unit_input_axe.unitsInput');

                    const spyInputField = commandForm.querySelector('#unit_input_spy.unitsInput') as HTMLInputElement | null;
                    if (!spyInputField) throw new InsidiousError('DOM: #unit_input_spy.unitsInput');

                    // Preenche os campos com a quantidade de tropas necessária.
                    const [neededRams, neededAxes] = neededUnits.map(amount => String(amount));
                    ramInputField.value = neededRams;
                    axeInputField.value = neededAxes;
                    spyInputField.value = '1';

                    // Observa até aparecer a janela de confirmação de ataque.
                    const observerTimeout = setTimeout(handleTimeout, 5000);
                    const observeCommandForm = new MutationObserver(async (mutationList) => {
                        for (const mutation of mutationList) {
                            if (mutation.type === 'childList') {
                                for (const node of Array.from(mutation.addedNodes)) {
                                    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('id') === 'command-data-form') {
                                        clearTimeout(observerTimeout);
                                        observeCommandForm.disconnect();

                                        const submitAttack = (node as Element).querySelector('#troop_confirm_submit') as HTMLInputElement | null;
                                        if (!submitAttack) throw new InsidiousError('DOM: #troop_confirm_submit');

                                        // Obtém informações a respeito das tropas que estão sendo enviadas.
                                        const confirmRamField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-ram');
                                        if (!confirmRamField || !confirmRamField.textContent) throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-ram');
                                        const confirmRamAmount = confirmRamField.textContent.replace(/\D/g, '');

                                        const confirmAxeField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-axe');
                                        if (!confirmAxeField || !confirmAxeField.textContent) throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-axe');
                                        const confirmAxeAmount = confirmAxeField.textContent.replace(/\D/g, '');

                                        const confirmSpyField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-spy');
                                        if (!confirmSpyField || !confirmSpyField.textContent) throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-spy');
                                        const confirmSpyAmount = confirmSpyField.textContent.replace(/\D/g, '');

                                        // E então verifica se a quantidade de tropas está correta.
                                        if (confirmRamAmount !== neededRams) {
                                            throw new InsidiousError(`A quantidade de aríetes(${confirmRamAmount}) não condiz com o necessário(${neededRams}).`);
                                        } else if (confirmAxeAmount !== neededAxes) {
                                            throw new InsidiousError(`A quantidade de bárbaros(${confirmAxeAmount}) não condiz com o necessário(${neededAxes}).`);
                                        } else if (confirmSpyAmount !== '1') {
                                            throw new InsidiousError(`A quantidade de exploradores(${confirmSpyAmount}) é diferente de 1.`);

                                        // Se estiver tudo certo, envia o ataque.
                                        } else {
                                            submitAttack.click();

                                            await Utils.wait();
                                            resolve(true);
                                            break;
                                        };
                                    };
                                };
                            };
                        };
                    })

                    // Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro.
                    function handleTimeout() {
                        observeCommandForm.disconnect();
                        throw new InsidiousError('TIMEOUT: O servidor demorou demais para responder.');
                    };

                    observeCommandForm.observe(document.body, { subtree: true, childList: true });
                    
                    const formAttackButton = commandForm.querySelector('#target_attack') as HTMLInputElement | null;
                    if (!formAttackButton) throw new InsidiousError('DOM: #target_attack');

                    // É preciso esperar um breve intervalo antes de emitir o clique.
                    // Do contrário, o servidor não tem tempo suficiente para processar o comando.
                    await Utils.wait();
                    formAttackButton.click();

                } else {
                    closeButton.click();
                    resolve(false);
                };

            } catch (err) {
                const closeButton = document.querySelector('#popup_box_popup_command a.popup_box_close') as HTMLElement | null;
                if (!closeButton) throw new InsidiousError('Não foi possível encontrar o botão para fechar a janela de comando.');

                closeButton.click();
                reject(err);
            };
        });
    };

    static #openPlace(village: HTMLElement) {
        return new Promise<number>((resolve) => {
            let villageID: string | null = village.getAttribute('id');
            if (!villageID) throw new InsidiousError('Não foi possível obter o id da aldeia.');
            villageID = villageID.replace(/\D/g, '');

            const placeButton = village.querySelector(`td a[insidious-place-btn="place_${villageID}"]`) as HTMLElement | null;
            if (!placeButton) throw new InsidiousError('Não foi possível encontrar o botão da praça de reunião.');

            // Observa até detectar a abertura da janela de comando.
            const observerTimeout = setTimeout(handleTimeout, 5000);
            const observeRams = new MutationObserver((mutationList) => {
                for (const mutation of mutationList) {
                    if (mutation.type === 'childList') {
                        for (const node of Array.from(mutation.addedNodes)) {
                            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('id') === 'command-data-form') {
                                clearTimeout(observerTimeout);
                                observeRams.disconnect();

                                const ramField = (node as Element).querySelector('#units_entry_all_ram');
                                if (!ramField || !ramField.textContent) throw new InsidiousError('O campo com a quantidade de aríetes não está presente.');

                                let ramAmount: string | null = ramField.textContent;
                                if (!ramAmount) throw new InsidiousError('Não foi possível determinar a quantidade de aríetes disponíveis.');
                                ramAmount = ramAmount.replace(/\D/g, '');

                                resolve(Number.parseInt(ramAmount, 10));
                                break;
                            };
                        };
                    };
                };
            });

            // Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro.
            function handleTimeout() {
                observeRams.disconnect();
                throw new InsidiousError('TIMEOUT: O servidor demorou demais para responder.');
            };

            observeRams.observe(document.body, { subtree: true, childList: true });
            placeButton.click();
        });
    };

    static #areThereVillagesUnderAttack() {
        const includeVillagesUnderAttack = document.querySelector('input#attacked_checkbox') as HTMLInputElement | null;
        if (!includeVillagesUnderAttack) throw new InsidiousError('DOM: input#attacked_checkbox');

        return new Promise<boolean>((resolve) => {
            if (includeVillagesUnderAttack.checked === true) {
                Utils.modal('Insidious');
                const modalWindow = document.querySelector('#insidious_modal') as HTMLDivElement | null;
                if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

                const warningMessages = [
                    'Não é possível atacar com o Insidious enquanto a opção \"incluir relatórios de aldeias ' +
                    'que você está atacando\" estiver ativada.',
                    'Deseja desativá-la?',
                    'Em caso negativo, o Insidious será encerrado.'
                ];

                const warningMessageElements = Manatsu.repeat(3, modalWindow, { class: 'insidious_farmWarningMessage' }, true);
                Manatsu.addTextContent(warningMessageElements, warningMessages);

                const messageModalCtrl = new AbortController();
                const modalButtonArea = new Manatsu(modalWindow, { class: 'insidious_modalButtonArea' }).create();

                new Manatsu('button', { class: 'insidious_modalButton', text: 'Sim' }, modalButtonArea).create()
                    .addEventListener('click', async () => {
                        messageModalCtrl.abort();
                        Manatsu.removeChildren(modalWindow, ['.insidious_farmWarningMessage', '.insidious_modalButtonArea']);
                        new Manatsu({ text: 'A página será recarregada em alguns instantes. Por favor, aguarde.'}, modalWindow).create();
                        includeVillagesUnderAttack.click();

                        await Utils.wait();
                        window.location.reload();
                    }, { signal: messageModalCtrl.signal });

                new Manatsu('button', { class: 'insidious_modalButton', text: 'Não' }, modalButtonArea).create()
                    .addEventListener('click', () => {
                        messageModalCtrl.abort();
                        document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
                        resolve(true);
                }, { signal: messageModalCtrl.signal });

            } else {
                resolve(false);
            };
        });
    };

    static async #forceStopPlunder() {
        await browser.storage.local.set({ [`isPlunderActive_${Insidious.world}`]: false });

        const startPlunderBtn = document.querySelector('#insidious_startPlunderBtn');
        if (startPlunderBtn) startPlunderBtn.textContent = 'Saquear';

        this.#eventTarget.dispatchEvent(new Event('stopplundering'));
        this.#eventTarget.dispatchEvent(new Event('cancelautoreload'));

        const actionArea = document.querySelector('#insidious_farmActionArea');
        if (actionArea) Manatsu.removeChildren(actionArea);
    };

    static get optionsParameters() {return this.#optionsParameters};
    static get start() {return this.#start};
};

class FarmAbort {
    #reason: InsidiousError | null;
    
    constructor(reason?: string) {
        this.#reason = typeof reason === 'string' ? new InsidiousError(reason) : null;
    };

    get reason() {return this.#reason};
};