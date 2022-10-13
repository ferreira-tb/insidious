class Plunder extends TWFarm {
    /** Modelo A do assistente de saque. */
    private static amodel: AvailableFarmUnits;
    /** Modelo B do assistente de saque. */
    private static bmodel: AvailableFarmUnits;
    /** Capacidade de carga de cada modelo. */
    private static carry: CarryCapacity;
    /** Quantia saqueada durante o processo atual do Plunder. */
    private static plundered: TotalPlundered | undefined;
    /** Quantidade de aríetes disponível na aldeia. */
    private static ram: number | null = null;

    /** Opções de configuração do Plunder. */
    static options: PlunderOptions;
    /** Parâmetros auxiliares para manejo das opções do Plunder. */
    static optionsParameters: PlunderOptionsParameters;
    
    /** Ajuda a controlar o estado das promises. */
    private static readonly eventTarget = new EventTarget();

    static async start() {
        try {
            // Exibe a quantidade de recursos saqueado durante o período em que o plunder estiver ativo.
            // A função #updatePlunderedAmount() atualiza essa informação após cada ataque feito.
            await this.showPlunderedAmount();

            // Informações sobre cada tipo de unidade do jogo.
            if (!Insidious.unitInfo) {
                await Store.remove(Keys.worldConfig);
                throw new InsidiousError('Não foi possível obter as informações sobre as unidades do jogo.');
            };

            // Opções do plunder.
            this.options = await Store.get(Keys.plunderOptions) as PlunderOptions ?? {};

            // Parâmetros das opções.
            this.optionsParameters = await Store.get(Keys.plunderParameters) as PlunderOptionsParameters ?? {};

            // Prepara os ataques usando o grupo Insidious.
            if (this.options.group_attack === true) await GroupAttack.start();

            // Modelos de saque do usuário.
            this.amodel = await Store.get(Keys.plunderA) as AvailableFarmUnits;
            this.bmodel = await Store.get(Keys.plunderB) as AvailableFarmUnits;
            if (!this.amodel) throw new InsidiousError('Os dados do modelo A não estão presentes no banco de dados.');
            if (!this.bmodel) throw new InsidiousError('Os dados do modelo B não estão presentes no banco de dados.');

            this.carry = this.getCarryCapacity();

            // Alea iacta est.
            this.sendAttack();

            // Após vários minutos, recarrega a página.
            // Como isPlunderActive === true, o plunder voltará a atacar automaticamente.
            this.setPlunderTimeout().catch((err: unknown) => {
                if (err instanceof FarmAbort) {
                    if (err.reason) InsidiousError.handle(err.reason);
                    return;
                };
            });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /** Envia um ataque usando os modelos A e B. */
    private static async sendAttack(): Promise<void> {
        try {
            // Se a opção de exibir aldeias sob ataque estiver ativa, exibe um aviso.
            // O usuário poderá ou desativá-la ou encerrar o Plunder.
            const areThereVillagesUnderAttack = await this.areThereVillagesUnderAttack();
            if (areThereVillagesUnderAttack) {
                this.forceStopPlunder();
                return;
            };
            
            /** Array com todas as linhas da tabela. */
            const villageRows = Array.from(document.querySelectorAll('tr[insidious-tr-farm="true"]')) as HTMLElement[];
            for (const village of villageRows) {
                // Ignora a linha caso ela esteja oculta.
                // Elas automaticamente ficam ocultas assim que são atacadas.
                if (village.getAttribute('style')?.includes('display: none')) continue;
                
                // Caso não hajam informações obtidas por exploradores, a linha é ignorada.
                // No entanto, emite um erro caso a função addInfo() tenha falhado em criar o atributo.
                const spyStatus = village.getAttribute('insidious-spy-status');
                if (spyStatus === null || spyStatus === '') {
                    throw new InsidiousError('A linha não possui atributo indicando se foi explorada ou não.');
                } else if (spyStatus === 'false') {
                    continue;
                };

                // Representa a quantidade total de recursos disponível na aldeia alvo.
                const resourceAmount = Number.parseInt(village.getAttribute('insidious-resources') as string, 10);
                if (Number.isNaN(resourceAmount)) throw new InsidiousError('Não foi possível obter a quantidade de recursos da aldeia.');

                // Determina o nível da muralha.
                let wallLevel: string | number | null = village.getAttribute('insidious-wall');
                if (!wallLevel) throw new InsidiousError('Não foi possível determinar o nível da muralha.');

                wallLevel = Number.parseInt(wallLevel, 10)
                if (!Number.isInteger(wallLevel)) throw new InsidiousError('O nível da muralha é inválido.');

                // Envia aríetes caso a aldeia possua muralha e "demolir muralha" esteja ativo.
                // Se o ataque for enviado com sucesso, pula para a próxima aldeia.
                // Em hipótese alguma "destroy_wall" pode estar após "ignore_wall".
                if (this.options.destroy_wall === true && wallLevel !== 0) {
                    const skipToNextVillage = await this.destroyWall(village, wallLevel as WallLevel);
                    if (skipToNextVillage === true) continue;
                };

                // A aldeia é ignorada caso possua muralha e "ignorar muralha" esteja ativo.
                if (this.options.ignore_wall === true && wallLevel !== 0) continue;

                let { ratioIsOk, bestRatio, otherRatio } = this.verifyRatio(resourceAmount);
                // Verifica o modelo mais adequado e em seguida se há tropas disponíveis.
                if (ratioIsOk) {
                    // Retorna uma função, que então é guardada em checkAvailability.
                    // Essa nova função guarda o escopo de this.getAvailableTroops.
                    const checkAvailability = this.getAvailableTroops();
                    
                    // Modelo escolhido pela função verifyRatio.
                    const bestModel = this[`${bestRatio}model`] as AvailableFarmUnits;

                    // Esse boolean determina se o ataque é enviado ou não.
                    let attackIsPossible: boolean = checkAvailability(bestModel);

                    // Caso não hajam tropas disponíveis, verifica se um ataque usando o outro modelo seria aceitável.
                    if (otherRatio !== null && !attackIsPossible) {
                        const otherModel = this[`${otherRatio}model`];
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
                                this.forceStopPlunder();
                                reject(new FarmAbort());
                                return;   
                            };

                            const attackCtrl = new AbortController();
                            const timerID = setTimeout(async () => {
                                try {
                                    // Envia o ataque e espera até que o servidor dê uma resposta.
                                    await this.handleAttack(village, bestRatio);
                                    const expectedResources = new ExpectedResources(village, this.carry[bestRatio]);
                                    await this.updatePlunderedAmount(expectedResources);
                                    attackCtrl.abort();
                                    resolve();

                                } catch (err) {
                                    attackCtrl.abort();
                                    reject(err);
                                };

                            // O jogo possui um limite de cinco ações por segundo.
                            }, Utils.generateIntegerBetween(250, 350));

                            this.eventTarget.addEventListener('stopplundering', () => {
                                Store.remove(Keys.plunderParameters)
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

                        }).then(() => this.sendAttack()).catch((err: unknown) => {
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
            // Se não houverem outras páginas ou tropas disponíveis, navega para a próxima aldeia caso this.options.group_attack === true.
            setTimeout(() => this.navigateToNextPlunderPage(), Utils.generateIntegerBetween(2000, 3000));

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /**
     * O plunder cumpre sua tarefa bem mais rápido que o servidor consegue responder.
     * No entanto, como ele depende do número de tropas ditado pelo jogo, é necessário esperar o valor ser atualizado.
     */ 
    private static handleAttack(village: Element, bestRatio: AB) {
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

    /**
     * Determina qual modelo usar com base na capacidade de cada um e nos recursos disponíveis.
     * Caso modelo nenhum seja adequado, o ataque não é enviado.
     * @param resourceAmount - Recursos disponíveis na aldeia alvo.
     */
    private static verifyRatio(resourceAmount: number) {
        let bestRatio: ABNull = null, otherRatio: ABNull = null;

        const bigger: AB = this.carry.a >= this.carry.b ? 'a' : 'b';
        const smaller: AB = this.carry.a < this.carry.b ? 'a' : 'b';

        let ratioIsOk: boolean = false;
        // Se ambos são menores que a quantidade de recursos, basta mandar o maior.
        // A diferença entre a carga do maior e a quantidade de recursos não é relevante nesse caso.
        if (resourceAmount >= this.carry[bigger]) {
            bestRatio = bigger;
            otherRatio = smaller;
            ratioIsOk = true;

        // Se os dois são maiores, descartam-se aqueles que estejam fora da zona aceitável.
        // Se todos forem descartados, não haverá ataque.
        } else if (resourceAmount <= this.carry[smaller]) {
            bestRatio = resourceAmount / this.carry[smaller] >= 0.8 ? smaller : null;
            otherRatio = resourceAmount / this.carry[bigger] >= 0.8 ? bigger : null;
            if (bestRatio !== null) ratioIsOk = true;

        // Nesse caso, a quantidade de recursos é maior que a carga de um, mas menor que a de outro.
        } else {
            // Razão em relação ao maior (será sempre MENOR que 1).
            const ratioBigger = resourceAmount / this.carry[bigger];
            // Razão em relação ao menor (será sempre MAIOR que 1).
            const ratioSmaller = resourceAmount / this.carry[smaller];

            // O de maior carga é descartado caso seja grande demais.
            // O menor é dado como válido pois valores menores são sempre adequados.
            if (ratioBigger < 0.8) {
                bestRatio = smaller;
                otherRatio = null;
                ratioIsOk = true;

            // Caso o maior seja válido, verifica-se qual está mais próximo da quantidade de recursos.
            } else {
                bestRatio = (1 - ratioBigger) <= (ratioSmaller - 1) ? bigger : smaller;
                otherRatio = (1 - ratioBigger) > (ratioSmaller - 1) ? bigger : smaller;
                ratioIsOk = true;
            };
        };

        if (ratioIsOk === true && bestRatio === null) {
            throw new InsidiousError('Devido a uma falha, não foi possível determinar qual modelo utilizar.');
        };

        return {
            ratioIsOk: ratioIsOk,
            bestRatio: bestRatio as AB,
            otherRatio: otherRatio
        };
    };

    private static getCarryCapacity(): CarryCapacity {
        // Calcula a capacidade total de carga com base nos dados salvos.
        const calcEachCarryCapacity = (unitModel: SNObject) => {
            let result: number = 0;
            for (const key in unitModel) {
                // Ignora o explorador, já que ele não pode carregar recursos.
                if (key !== 'spy') result += unitModel[key] * Insidious.unitInfo[key as UnitList].carry;
            };

            if (!Number.isInteger(result)) {
                throw new InsidiousError('O valor calculado para a capacidade de carga é inválido.');
            };
            return result;
        };

        const capacityA: number = calcEachCarryCapacity(this.amodel);
        const capacityB: number = calcEachCarryCapacity(this.bmodel);

        // Caso o valor seja zero, surge uma divisão por zero no cálculo da razão.
        // Qualquer valor dividido por Infinity se torna zero, o que o torna a melhor opção lá.
        return {
            a: capacityA === 0 ? Infinity : capacityA,
            b: capacityB === 0 ? Infinity : capacityB,
        };
    };

    /** Retorna uma função que permite verificar a quantidade de tropas disponíveis. */
    private static getAvailableTroops() {
        if (!Insidious.worldInfo.game) {
            Store.remove(Keys.worldConfig).catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });

            throw new InsidiousError('Não foi possível obter as configurações do mundo.');
        };

        /** Lista das tropas disponíveis. */
        let availableTroops: AvailableFarmUnits;

        // Caso o mundo tenha arqueiros, adiciona-os à lista.
        if (Insidious.worldInfo.game.archer === 1) {
            availableTroops = new PlunderAvailableTroops(TWAssets.list.farm_units_archer) as AvailableFarmUnits;

        } else {
            availableTroops = new PlunderAvailableTroops(TWAssets.list.farm_units) as AvailableFarmUnits;
        };

        return function(model: AvailableFarmUnits): boolean {
            for (const [key, value] of Object.entries(availableTroops)) {
                // Se houver menos tropas do que consta no modelo, a função deve ser interrompida.
                if (value < model[key as FarmUnits]) return false;
            };
            
            return true;
        };
    };

    private static navigateToNextPlunderPage() {
        // Antes de ir para a próxima página, verifica se há tropas disponíveis em algum dos modelos.
        const checkAvailability = this.getAvailableTroops();
        // this.#getCarryCapacity atribui Infinity caso a capacidade seja igual a zero.
        // Isso é feito para evitar divisões por zero.
        let statusA: boolean = false, statusB: boolean = false;
        if (checkAvailability(this.amodel) && this.carry.a !== Infinity) statusA = true;
        if (checkAvailability(this.bmodel) && this.carry.b !== Infinity) statusB = true;
        if (statusA === false && statusB === false) {
            // Caso a aldeia se torne a última num grupo dinâmico, a seta de navegação continua ativa.
            // Em decorrência disso, o plunder fica navegando para a mesma aldeia repetidas vezes.
            // Para impedir isso, é necessário verificar qual foi a última aldeia que realizou um ataque.
            // O valor de last_attacking_village só é atualizado durante a execução de navigateToNextVillage().
            // Como isso ocorre somente após a verificação, não há risco envolvido.
            if (this.optionsParameters.last_attacking_village === Game.village) return;
            if (this.options.group_attack === true) this.navigateToNextVillage();
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
                    if (this.options.group_attack === true) this.navigateToNextVillage();
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

    // Navega para a próxima aldeia caso this.options.group_attack === true.
    private static async navigateToNextVillage() {
        try {
            const groupID = (await browser.storage.local.get(Keys.farmGroup))[Keys.farmGroup] as string | undefined;
            if (Game.group !== groupID) return;

            const rightArrow = document.querySelector('a#village_switch_right span.groupRight') as HTMLSpanElement | null;
            if (rightArrow) {
                // Antes de mudar de aldeia, salva a atual como última aldeia atacante.
                if (Game.village) {
                    this.optionsParameters.last_attacking_village = Game.village;
                    await Store.set({ [Keys.plunderParameters]: this.optionsParameters });
                };

                rightArrow.click();
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static async showPlunderedAmount() {
        try {
            const actionArea = document.querySelector('#insidious_farmActionArea');
            if (!actionArea) throw new InsidiousError('DOM: #insidious_farmActionArea');
            Manatsu.removeChildren(actionArea);

            this.plundered = await Store.get(Keys.totalPlundered) as TotalPlundered | undefined;
            if (!this.plundered) this.plundered = { wood: 0, stone: 0, iron: 0, attack_amount: 0 };
            const { wood = 0, stone = 0, iron = 0 } = this.plundered;

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

    private static async updatePlunderedAmount(resources: ExpectedResources) {
        const woodLabel = document.querySelector('#insidious_plundered_wood');
        const stoneLabel = document.querySelector('#insidious_plundered_stone');
        const ironLabel = document.querySelector('#insidious_plundered_iron');

        try {
            if (this.plundered) {
                this.plundered = new PlunderedAmount(resources, false);
                await Store.set({ [Keys.totalPlundered]: this.plundered });
                
            } else {
                // Caso ainda não exista, entende que o ataque atual é o primeiro.
                this.plundered = new PlunderedAmount(resources, true);
                await Store.set({ [Keys.totalPlundered]: this.plundered });
            };

            if (woodLabel && stoneLabel && ironLabel) {
                woodLabel.textContent = String(this.plundered.wood);
                stoneLabel.textContent = String(this.plundered.stone);
                ironLabel.textContent = String(this.plundered.iron);
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static setPlunderTimeout() {
        return new Promise<void>((resolve, reject) => {
            const autoReloadCtrl = new AbortController();

            const plunderTimeoutID = setTimeout(() => {
                // Interrompe qualquer atividade no plunder e inicia a preparação para o recarregamento.
                this.eventTarget.dispatchEvent(new Event('stopplundering'));
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

            this.eventTarget.addEventListener('cancelautoreload', () => {
                clearTimeout(plunderTimeoutID);
                autoReloadCtrl.abort();
                resolve();
            }, { signal: autoReloadCtrl.signal });
        });
    };

    /**
     * A promise retornada por #destroyWall() resolve com um boolean.
     * Se o resultado for true, o ataque foi enviado e #sendAttack() deve pular para a próxima aldeia.
     * Se for false, #sendAttack() deve continuar a execução atual.
     */
    private static destroyWall(village: HTMLElement, wallLevel: WallLevel) {
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

            /** Verifica se há tropas disponíveis para destruir a muralha. */
            const canDestroy = (neededRams: number, neededAxes: number): boolean => {
                if (neededRams > (this.ram as number) || neededAxes > axeAmount || spyAmount < 1) {
                    return false;
                };
                return true;
            };

            /** Tropas necessárias para cada nível possível da muralha. */
            const neededUnits = TWAssets.unitsToDestroyWall[wallLevel] as [number, number];

            // Caso a quantidade de aríetes já esteja salva, verifica se há tropas suficientes.
            // Em caso negativo, resolve a promise.
            if (typeof this.ram === 'number' && !canDestroy(...neededUnits)) {
                resolve(false);
                return;
            };

            try {
                // Abre a janela de comando e obtém a quantidade de aríetes.
                this.ram = await this.openPlace(village);

                const closeButton = document.querySelector('#popup_box_popup_command a.popup_box_close') as HTMLElement | null;
                if (!closeButton) throw new InsidiousError('Não foi possível encontrar o botão para fechar a janela de comando.');

                // Caso o valor obtido seja inválido, reseta this.#ram e emite um erro.
                if (Number.isNaN(this.ram)) {
                    this.ram = null;
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
                                        if (!confirmRamField || !confirmRamField.textContent) {
                                            throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-ram')
                                        };
                                        
                                        const confirmAxeField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-axe');
                                        if (!confirmAxeField || !confirmAxeField.textContent) {
                                            throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-axe')
                                        };
                                        
                                        const confirmSpyField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-spy');
                                        if (!confirmSpyField || !confirmSpyField.textContent) {
                                            throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-spy')
                                        };

                                        const confirmRamAmount = confirmRamField.textContent.replace(/\D/g, '');
                                        const confirmAxeAmount = confirmAxeField.textContent.replace(/\D/g, '');
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
                                            const destroyedWalls = await Store.get(Keys.plunderWalls) as number | undefined;
                                            if (!destroyedWalls) {
                                                await Store.set({ [Keys.plunderWalls]: wallLevel });
                                            } else {
                                                await Store.set({ [Keys.plunderWalls]: destroyedWalls + wallLevel });
                                            };

                                            await Utils.wait();
                                            resolve(true);
                                            break;
                                        };
                                    };
                                };
                            };
                        };
                    })

                    /** Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro. */
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

    /** Abre a janela para envio de comandos. */
    private static openPlace(village: HTMLElement) {
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

            /** Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro. */
            function handleTimeout() {
                observeRams.disconnect();
                throw new InsidiousError('TIMEOUT: O servidor demorou demais para responder.');
            };

            observeRams.observe(document.body, { subtree: true, childList: true });
            placeButton.click();
        });
    };

    /** Verifica se a opção que exibe aldeias sob ataque está ativada. */
    private static areThereVillagesUnderAttack() {
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

    private static async forceStopPlunder() {
        await this.setGlobalPlundered();
        await Store.set({ [Keys.plunder]: false });

        const startPlunderBtn = document.querySelector('#insidious_startPlunderBtn');
        if (startPlunderBtn) startPlunderBtn.textContent = 'Saquear';

        this.eventTarget.dispatchEvent(new Event('stopplundering'));
        this.eventTarget.dispatchEvent(new Event('cancelautoreload'));

        const actionArea = document.querySelector('#insidious_farmActionArea');
        if (actionArea) Manatsu.removeChildren(actionArea);
    };

    static get amount() {return this.plundered};
};

class FarmAbort {
    readonly reason: InsidiousError | null;

    constructor(reason?: string) {
        this.reason = typeof reason === 'string' ? new InsidiousError(reason) : null;
    };
};