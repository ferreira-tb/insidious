class Plunder extends TWFarm {
    /** Modelo A do assistente de saque. */
    static amodel: AvailableFarmUnits;
    /** Modelo B do assistente de saque. */
    static bmodel: AvailableFarmUnits;
    /** Capacidade de carga de cada modelo. */
    static carry: CarryCapacity;
    /** Quantia saqueada durante o processo atual do Plunder. */
    private static plundered: TotalPlundered | undefined;
    /** Quantidade de aríetes disponível na aldeia. */
    private static ram: number | null = null;

    /** Opções de configuração do Plunder. */
    static options: PlunderOptions;
    /** Registra o histórico de navegação entre aldeias quando se está atacando com um grupo. */
    static navigation = new PlunderGroupNavigation();
    
    /** Ajuda a controlar o estado das promises. */
    static readonly eventTarget = new EventTarget();

    static async start() {
        try {
            const isFirstPage = await this.checkIfIsFirstPage();
            if (isFirstPage === false) this.goBackToFirstPage();

            // Exibe a quantidade de recursos saqueado durante o período em que o plunder estiver ativo.
            // A função updatePlunderedAmount() atualiza essa informação após cada ataque feito.
            await this.showPlunderedAmount();

            // Informações sobre cada tipo de unidade do jogo.
            if (!Game.unitInfo) {
                await Store.remove(Keys.worldConfig);
                throw new InsidiousError('Não foi possível obter as informações sobre as unidades do jogo.');
            };

            // Opções do plunder.
            this.options = await Store.get(Keys.plunderOptions) as PlunderOptions ?? {};

            if (this.options.group_attack === true) {
                // Histórico de navegação entre aldeias.
                const plunderNavigation = await Store.get(Keys.plunderNavigation) as PlunderGroupNavigation | undefined;
                if (plunderNavigation) {
                    if ((Date.now() - plunderNavigation.date) < (3000 + Utils.responseTime)) {
                        this.navigation = plunderNavigation;
                    } else {
                        // Se o registro for antigo, ele é removido.
                        await Store.remove(Keys.plunderNavigation);
                    };
                };

                // Prepara os ataques usando o grupo Insidious.
                await GroupAttack.start();
            };

            // Modelos de saque do usuário.
            this.amodel = await Store.get(Keys.plunderA) as AvailableFarmUnits;
            this.bmodel = await Store.get(Keys.plunderB) as AvailableFarmUnits;
            if (!this.amodel) throw new InsidiousError('Os dados do modelo A não estão presentes no banco de dados.');
            if (!this.bmodel) throw new InsidiousError('Os dados do modelo B não estão presentes no banco de dados.');

            // Capacidade de carga de cada modelo.
            this.carry = new CarryCapacity();

            // Alea iacta est.
            this.handleAttack();

            // Após vários minutos, recarrega a página.
            // Como isPlunderActive === true, o plunder voltará a atacar automaticamente.
            this.setPlunderTimeout().catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /** Envia um ataque usando os modelos A e B. */
    private static async handleAttack(): Promise<void> {
        try {
            // Se a opção de exibir aldeias sob ataque estiver ativa, exibe um aviso.
            // O usuário poderá ou desativá-la ou encerrar o Plunder.
            const areThereVillagesUnderAttack = await this.areThereVillagesUnderAttack();
            if (areThereVillagesUnderAttack) {
                TWFarm.togglePlunder();
                return;
            };
            
            /** Array com todas as linhas da tabela. */
            const villageRows = Array.from(document.querySelectorAll('tr[insidious-tr-farm="true"]')) as HTMLElement[];
            for (const village of villageRows) {
                // Ignora a linha caso ela esteja oculta, removendo-a da tabela.
                // Elas automaticamente ficam ocultas assim que são atacadas.
                if (village.getAttribute('style')?.includes('display: none')) {
                    Manatsu.remove(village);
                    continue;
                };
                
                // Caso não hajam informações obtidas por exploradores, a linha é ignorada.
                // No entanto, emite um erro caso a função addInfo() tenha falhado em criar o atributo.
                const spyStatus = village.getAttribute('insidious-spy-status');
                switch (spyStatus) {
                    case 'false': continue;
                    case null: throw new InsidiousError('A aldeia não foi corretamente identificada.');
                };

                // Informações sobre o ataque atual.
                const attack = new PlunderAttack(village);

                // Envia aríetes caso a aldeia possua muralha e "demolir muralha" esteja ativo.
                // Se o ataque for enviado com sucesso, pula para a próxima aldeia.
                // Em hipótese alguma "destroy_wall" pode estar após "ignore_wall".
                if (this.options.destroy_wall === true && attack.wall_level > 0) {
                    const skipToNextVillage = await this.destroyWall(attack.id, attack.wall_level as WallLevel);
                    if (skipToNextVillage === true) continue;
                };

                // A aldeia é ignorada caso possua muralha e "ignorar muralha" esteja ativo.
                if (this.options.ignore_wall === true && attack.wall_level !== 0) continue;

                // Verifica se o Plunder deve ou não usar o modelo C.
                // Em caso positivo, também verifica se o botão está ativado.
                if (this.options.use_c === true) {
                    if (attack.c_button === 'off') continue;
                    const expectedResources = new ExpectedResources(village, 'c');
                    return this.prepareAttack(attack.id, expectedResources)
                        .then(() => Manatsu.remove(village))
                        .then(() => this.handleAttack())
                        .catch((err: unknown) => {
                            if (err instanceof Error) InsidiousError.handle(err);
                        });
                };

                let { ratioIsOk, bestRatio, otherRatio } = new ModelRatio(attack.resources);
                // Verifica o modelo mais adequado e em seguida se há tropas disponíveis.
                if (ratioIsOk) {
                    if (!bestRatio) throw new InsidiousError('Não foi possível determinar qual modelo utilizar.');

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
                        const expectedResources = new ExpectedResources(village, bestRatio);
                        // Esse return não pode ser removido, caso contrário o código após o FOR será executado indevidamente.
                        return this.prepareAttack(attack.id, expectedResources)
                            .then(() => Manatsu.remove(village))
                            .then(() => this.handleAttack())
                            .catch((err: unknown) => {
                                if (err instanceof Error) InsidiousError.handle(err);
                            });
                    };
                };
            };

            // Caso, em toda tabela, não haja aldeia adequada para envio do ataque, verifica se há mais páginas.
            // Em caso positivo, navega para a próxima após um breve delay.
            // Se não houverem outras páginas ou tropas disponíveis, navega para a próxima aldeia caso options.group_attack === true.
            setTimeout(() => this.navigateToNextPlunderPage(), Utils.generateIntegerBetween(1000, 2000));

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static prepareAttack(villageID: string, resources: ExpectedResources) {
        return new Promise<void>((resolve, reject) => {
            if (Utils.isThereCaptcha()) {
                TWFarm.togglePlunder();
                reject(new InsidiousError('Não é possível saquear enquanto há um captcha ativo.'));
                return;
            };

            const attackCtrl = new AbortController();
            const attackTimeout = setTimeout(() => {
                this.sendAttack(villageID, resources.model)
                    .then(() => this.updatePlunderedAmount(resources))
                    .then(() => resolve())
                    .catch((err: unknown) => reject(err))
                    .finally(() => attackCtrl.abort());

            // O jogo possui um limite de cinco ações por segundo.
            }, Utils.generateIntegerBetween(200, 300));

            Plunder.eventTarget.addEventListener('stopplundering', () => {
                clearTimeout(attackTimeout);
                attackCtrl.abort();
                reject();
            }, { signal: attackCtrl.signal });

            // É preciso também ter um evento no botão.
            // Do contrário, existe a possibilidade do Plunder continuar atacando.
            document.querySelector('#insidious_plunderButton')?.addEventListener('click', () => {
                clearTimeout(attackTimeout);
                attackCtrl.abort();
                reject();
            }, { signal: attackCtrl.signal });
        });
    };

    /**
     * O Plunder cumpre sua tarefa bem mais rápido que o servidor consegue responder.
     * No entanto, como ele depende do número de tropas ditado pelo jogo, é necessário esperar o valor ser atualizado.
     * @param villageID ID da aldeia.
     * @param model Modelo escolhido para o ataque.
     */
    private static sendAttack(villageID: string, model: ABC) {
        return new Promise<void>((resolve, reject) => {
            const observerTimeout = setTimeout(handleTimeout, 5000);
            const observeTroops = new MutationObserver(() => {
                clearTimeout(observerTimeout);
                observeTroops.disconnect();
                resolve();
            });

            // Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro.
            function handleTimeout() {
                observeTroops.disconnect();
                reject(new InsidiousError('TIMEOUT: O servidor demorou demais para responder (sendAttack).'));
            };

            const unitTable = document.querySelector('tr[insidious-available-unit-table="true"]');
            if (!unitTable) throw new InsidiousError('DOM: tr[insidious-available-unit-table]');
            observeTroops.observe(unitTable, { subtree: true, childList: true });

            // Como a promise superior está esperando a resolução dessa, o plunder só irá continuar após isso acontecer.
            const selector = `a[insidious-farm-btn^="${model}" i][insidious-farm-btn$="${villageID}"]`;
            const attackButton = document.querySelector(selector) as HTMLAnchorElement | null;
            if (!attackButton) throw new InsidiousError(`O botão ${model.toUpperCase()} não foi encontrado.`);

            attackButton.click();
        });
    };

    /** Retorna uma função que permite verificar a quantidade de tropas disponíveis. */
    private static getAvailableTroops() {
        if (!Game.worldInfo.game) {
            Store.remove(Keys.worldConfig).catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });

            throw new InsidiousError('Não foi possível obter as configurações do mundo.');
        };

        /** Lista das tropas disponíveis. */
        let availableTroops: AvailableFarmUnits;

        // Caso o mundo tenha arqueiros, adiciona-os à lista.
        if (Game.worldInfo.game.archer === 1) {
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

    /**
     * Verifica se existem outras páginas de aldeias no assistente de saque.
     * Se houver alguma outra e ainda existam tropas disponíveis, navega para ela.
     */
    private static async navigateToNextPlunderPage() {
        try {
            // Antes de ir para a próxima página, verifica se há tropas disponíveis em algum dos modelos.
            const checkAvailability = this.getAvailableTroops();
            // this.getCarryCapacity atribui Infinity caso a capacidade seja igual a zero.
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
                if (this.navigation.last_attacking_village === Game.village) return;
                if (this.options.group_attack === true) this.navigateToNextVillage();
                return;
            };

            /** Linha da tabela com os números das páginas. */
            const plunderListNav = document.querySelector('#plunder_list_nav table tbody tr td');

            if (plunderListNav) {
                const currentPageElement = plunderListNav.querySelector('strong.paged-nav-item');

                // Analisa os links disponíveis para determinar quantos existem.
                const getPageNumber = (element: Element) => Number.parseInt(element.textContent?.replace(/\D/g, '') as string, 10);
                // A função getPageNumber é invocada em todos os elementos durante a formação da array.
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

                // Registra os detalhes sobre a troca de página.
                const plunderPageNavigation = new PlunderPageNavigation();
                await Store.set({ [Keys.plunderPage]: plunderPageNavigation });

                /** URL para navegação entre as páginas. */
                const pageURL = new PlunderPageURL(plunderListNav, currentPage);

                // Caso a página atual seja a última página, volta para a primeira.
                if (currentPage === plunderPages.at(-1)) {
                    location.assign(pageURL.first);

                // Do contrário, vai para a próxima.
                } else {
                    if (!pageURL.next) throw new InsidiousError('Não foi possível determinar a URL da próxima página.')
                    location.assign(pageURL.next);
                };
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /**
     * Verifica se a página atual do Plunder é a primeira.
     * @returns Boolean indicando se é ou não a primeira página.
     */
    private static async checkIfIsFirstPage(): Promise<boolean> {
        /** Linha da tabela com os números das páginas. */
        const plunderListNav = document.querySelector('#plunder_list_nav table tbody tr td');

        if (plunderListNav) {
            const currentPageElement = plunderListNav.querySelector('strong.paged-nav-item');
            if (!currentPageElement?.textContent) throw new InsidiousError('DOM: strong.paged-nav-item');

            // Identifica a página atual.
            const currentPage = Number.parseInt(currentPageElement.textContent.replace(/\D/g, ''), 10);
            if (Number.isNaN(currentPage)) throw new InsidiousError('Não foi possível identificar a página atual.');

            // Caso não seja a primeira página, a função verifica de onde partiu a última navegação.
            // Ela é ignorada caso tenha sido entre páginas da aldeia atual.
            if (currentPage !== 1) {
                const lastPageNavigation = await Store.get(Keys.plunderPage) as PlunderPageNavigation | undefined;
                if (lastPageNavigation) {  
                    if (lastPageNavigation.village === Game.village) return true;
                    return false;
                };
            };
        };

        return true;
    };

    /** Volta para a primeira página do Plunder. */
    private static goBackToFirstPage() {
        /** Linha da tabela com os números das páginas. */
        const plunderListNav = document.querySelector('#plunder_list_nav table tbody tr td');
        if (plunderListNav) {
            /** URL para navegação entre as páginas. */
            const pageURL = new PlunderPageURL(plunderListNav);
            location.assign(pageURL.first);
        };
    };

    // Navega para a próxima aldeia caso this.options.group_attack === true.
    private static async navigateToNextVillage() {
        try {
            const groupID = await Store.get(Keys.farmGroup) as string | undefined;
            if (Game.group !== groupID) return;

            const rightArrow = document.querySelector('a#village_switch_right span.groupRight') as HTMLSpanElement | null;
            if (rightArrow) {
                // Antes de mudar de aldeia, salva a atual como última aldeia atacante.
                this.navigation = new PlunderGroupNavigation('attack');
                await Store.set({ [Keys.plunderNavigation]: this.navigation });

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

            const container = new Manatsu('span', actionArea, { class: 'nowrap', ['insidious-custom']: 'true' }).create();

            for (const [key, value] of Object.entries(this.plundered)) {
                if (key !== 'attack_amount') {
                    new Manatsu('span', container, { class: `icon header ${key}` }).create();
                    new Manatsu('span', container, { class: 'res', id: `insidious_plundered_${key}`, text: String(value) }).create();
                };
            };

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
            } else {
                // Caso ainda não exista, entende que o ataque atual é o primeiro.
                this.plundered = new PlunderedAmount(resources, true);           
            };

            if (woodLabel && stoneLabel && ironLabel) {
                woodLabel.textContent = String(this.plundered.wood);
                stoneLabel.textContent = String(this.plundered.stone);
                ironLabel.textContent = String(this.plundered.iron);
            };

            // Salva os valores no banco de dados.
            await Store.set({ [Keys.totalPlundered]: this.plundered });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static setPlunderTimeout() {
        return new Promise<void>((resolve) => {
            const plunderListTitle = document.querySelector('div#am_widget_Farm h4');
            if (!plunderListTitle) throw new InsidiousError('DOM: div#am_widget_Farm h4');

            /** Tempo até o recarregamento automático. */
            const timeout = Utils.generateIntegerBetween((60000 * 10), (60000 * 20));
            /** Horário do próximo recarregamento automático da página. */
            const nextAutoReloadDate = new Date(Date.now() + timeout);
            const dateString = nextAutoReloadDate.toLocaleDateString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const hourString = nextAutoReloadDate.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' });
            const spanMessage = `A página será recarregada automaticamente em ${dateString} às ${hourString}`;

            // Apenas substitui o texto caso o elemento já exista.
            const spanElement = document.querySelector('#insidious_nextAutoReloadDate');
            if (spanElement) {
                spanElement.textContent = spanMessage;
            } else {
                new Manatsu('span', plunderListTitle, { text: spanMessage, id: 'insidious_nextAutoReloadDate' }).create();
            };
            
            const autoReloadCtrl = new AbortController();

            const plunderTimeout = setTimeout(() => {
                autoReloadCtrl.abort();
                setTimeout(() => location.reload(), 5000);
                resolve();       
            }, timeout);

            Plunder.eventTarget.addEventListener('cancelautoreload', () => {
                clearTimeout(plunderTimeout);
                autoReloadCtrl.abort();
                resolve();
            }, { signal: autoReloadCtrl.signal });
        });
    };

    /**
     * A promise retornada por #destroyWall() resolve com um boolean.
     * Se o resultado for true, o ataque foi enviado e handleAttack() deve pular para a próxima aldeia.
     * Se for false, handleAttack() deve continuar a execução atual.
     * @param villageID ID da aldeia.
     * @param wallLevel Nível da muralha.
     */
    private static destroyWall(villageID: string, wallLevel: WallLevel) {
        return new Promise<boolean>(async (resolve, reject) => {
            // Quantidade de bárbaros.
            const axeField = document.querySelector('td[insidious-available-units="axe"]');
            if (!axeField || !axeField.textContent) {
                throw new InsidiousError('Não foi possível determinar a quantidade de bárbaros disponíveis.')
            };

            const axeAmount = Number.parseInt(axeField.textContent, 10);
            if (Number.isNaN(axeAmount)) throw new InsidiousError('A quantidade de bárbaros obtida é inválida.');

            // Quantidade de exploradores.
            const spyField = document.querySelector('td[insidious-available-units="spy"]');
            if (!spyField || !spyField.textContent) {
                throw new InsidiousError('Não foi possível determinar a quantidade de exploradores disponíveis.')
            };

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
                this.ram = await this.openPlace(villageID);

                const closeButton = document.querySelector('#popup_box_popup_command a.popup_box_close') as HTMLElement | null;
                if (!closeButton) throw new InsidiousError('Não foi possível encontrar o botão para fechar a janela de comando.');

                // Caso o valor obtido seja inválido, reseta this.ram e emite um erro.
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
                                        throw new InsidiousError(`A quantidade de aríetes (${confirmRamAmount}) não condiz com o necessário(${neededRams}).`);
                                    } else if (confirmAxeAmount !== neededAxes) {
                                        throw new InsidiousError(`A quantidade de bárbaros (${confirmAxeAmount}) não condiz com o necessário(${neededAxes}).`);
                                    } else if (confirmSpyAmount !== '1') {
                                        throw new InsidiousError(`A quantidade de exploradores (${confirmSpyAmount}) é diferente de 1.`);

                                    // Se estiver tudo certo, envia o ataque.
                                    } else {
                                        submitAttack.click();
                                        const destroyedWalls = await Store.get(Keys.plunderWalls) as number | undefined;
                                        if (typeof destroyedWalls !== 'number') {
                                            await Store.set({ [Keys.plunderWalls]: wallLevel });
                                        } else {
                                            await Store.set({ [Keys.plunderWalls]: destroyedWalls + wallLevel });
                                        };

                                        await Utils.wait();
                                        resolve(true);
                                        return;
                                    };
                                };
                            };
                        };
                    })

                    /** Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro. */
                    function handleTimeout() {
                        observeCommandForm.disconnect();
                        InsidiousError.handle(new InsidiousError('TIMEOUT: O servidor demorou demais para responder (destroyWall).'));
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

    /**
     * Abre a janela para envio de comandos.
     * @param villageID ID da aldeia.
     * @returns A quantidade de aríetes disponíveis.
     */
    private static openPlace(villageID: string) {
        return new Promise<number>((resolve) => {
            const placeButton = document.querySelector(`td a[insidious-place-btn="place_${villageID}"]`) as HTMLElement | null;
            if (!placeButton) throw new InsidiousError(`Não foi possível encontrar o botão da praça de reunião ${villageID}.`);

            // Observa até detectar a abertura da janela de comando.
            const observerTimeout = setTimeout(handleTimeout, 5000);
            const observeRams = new MutationObserver((mutationList) => {
                for (const mutation of mutationList) {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('id') === 'command-data-form') {
                            clearTimeout(observerTimeout);
                            observeRams.disconnect();

                            const ramField = (node as Element).querySelector('#units_entry_all_ram');
                            if (!ramField || !ramField.textContent) {
                                throw new InsidiousError('O campo com a quantidade de aríetes não está presente.');
                            };

                            let ramAmount: string | null = ramField.textContent;
                            if (!ramAmount) throw new InsidiousError('Não foi possível determinar a quantidade de aríetes disponíveis.');
                            ramAmount = ramAmount.replace(/\D/g, '');

                            resolve(Number.parseInt(ramAmount, 10));
                            return;
                        };
                    };
                };
            });

            /** Caso o observer não perceber mudanças mesmo após cinco segundos, emite um erro. */
            function handleTimeout() {
                observeRams.disconnect();
                InsidiousError.handle(new InsidiousError('TIMEOUT: O servidor demorou demais para responder (openPlace).'));
            };

            observeRams.observe(document.body, { subtree: true, childList: true });
            placeButton.click();
        });
    };

    /**
     * Verifica se a opção que exibe aldeias sob ataque está ativada.
     * @returns Boolean indicando se a opção está ativada ou não.
     */
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

                const warningMessageElements = Manatsu.repeat(3, modalWindow, { class: 'insidious_modalMessage' }, true);
                Manatsu.addTextContent(warningMessageElements, warningMessages);

                const messageModalCtrl = new AbortController();
                const modalButtonArea = new Manatsu(modalWindow, { class: 'insidious_modalButtonArea' }).create();

                new Manatsu('button', { class: 'insidious_modalButton', text: 'Sim' }, modalButtonArea).create()
                    .addEventListener('click', async () => {
                        messageModalCtrl.abort();
                        Manatsu.removeChildren(modalWindow, ['.insidious_modalMessage', '.insidious_modalButtonArea']);
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

    static getCModelCarryCapacity(village: HTMLElement): number {
        const cFarmBtn = village.querySelector('td a[class*="farm_icon_c" i][data-units-forecast]');
        if (!cFarmBtn) throw new InsidiousError('Não foi possível encontrar o botão C.');

        const modelJSON = cFarmBtn.getAttribute('data-units-forecast');
        if (!modelJSON) throw new InsidiousError('Não foi possível determinar a quantia de recursos para o modelo C.');

        const cmodel = JSON.parse(modelJSON) as AvailableFarmUnits;
        const capacityC = new CarryCapacity(cmodel).c;

        return capacityC;
    };

    static get amount() {return this.plundered};
};