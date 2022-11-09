class Plunder {
    /** Status do Plunder. */
    static readonly status = new PlunderStatus();
    /** Dados sobre o Plunder. */
    static data: PlunderData;
    /** Modelo A do assistente de saque. */
    static amodel: AvailableFarmUnits;
    /** Modelo B do assistente de saque. */
    static bmodel: AvailableFarmUnits;
    /** Modelo C do assistente de saque. */
    static readonly cmodel: Map<string, AvailableFarmUnits> = new Map();
    /** Capacidade de carga de cada modelo. */
    static carry: CarryCapacity;
    /** Quantia saqueada durante o processo atual do Plunder. */
    private static plundered: TotalPlundered | undefined;

    /** Proxy com as opções de configuração do Plunder. */
    static options: PlunderOptions;
    /** Registra o histórico de navegação entre aldeias quando se está atacando com um grupo. */
    static navigation = new PlunderGroupNavigation();

    /** Controla a recursividade do método `sendAttackUsingC()`. */
    static readonly waitingC: Set<string> = new Set();
    
    /** Ajuda a controlar o estado das promises. */
    static readonly eventTarget = new EventTarget();

    static async start() {
        try {
            await this.updatePlunderData();
            this.data = new PlunderData();
            
            const isFirstPage = await this.checkIfIsFirstPage();
            if (isFirstPage === false) return location.assign(new PlunderPageURL().first);

            // Exibe a quantidade de recursos saqueado durante o período em que o plunder estiver ativo.
            // A função updatePlunderedAmount() atualiza essa informação após cada ataque feito.
            await this.showPlunderedAmount();

            // Informações sobre cada tipo de unidade do jogo.
            if (!Game.unitInfo) {
                await Store.remove(Keys.worldConfig);
                throw new InsidiousError('Não foi possível obter as informações sobre as unidades do jogo.');
            };

            // Opções do plunder.
            this.options = await this.setPlunderOptions();

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
            this.setPlunderTimeout()
                .catch((err: unknown) => InsidiousError.handle(err));

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    static async setPlunderOptions() {
        const options = await Store.get(Keys.plunderOptions) as PlunderOptions ?? {};
        return new Proxy(options, {
            get(target, property) {
                if (property === Keys.master) return options;

                let value = Reflect.get(target, property);
                if (value === undefined) {
                    switch (property) {
                        case 'max_distance': return 0;
                        case 'ignore_older_than': return 0;
                        case 'minutes_until_reload': return 10; 
                    };

                    const callback = (item: string) => item === property;
                    if (Assets.options.plunder_checkbox.some(callback)) return false;
                };

                if (property === 'minutes_until_reload' && value < 1) return 10;

                return value;
            },

            set(target, property, value) {
                const callback = (item: string) => item === property;
                if (Assets.options.plunder_checkbox.some(callback)) {
                    if (typeof value !== 'boolean') return false;
                };

                if (Assets.options.plunder_input.some(callback)) {
                    if (typeof value !== 'number') return false;

                    if (Number.isNaN(value)) value = 0;
                    if (Math.sign(value) === -1) value = Math.abs(value);

                    if (property === 'minutes_until_reload' && value < 1) value = 10;
                };

                return Reflect.set(target, property, value);
            }
        });
    };

    /** Atualiza os dados sobre o Plunder. */
    private static updatePlunderData() {
        return new Promise<void>((resolve) => {
            const request = async (e: MessageEvent<WindowMessageFromPage>) => {
                if (e?.data?.direction === 'from-tribalwars') {
                    window.removeEventListener('message', request);
                    
                    if (!e.data.plunder_data) throw new InsidiousError('Não foi possível obter informações sobre o Plunder.');

                    this.#raw_plunder_data = e.data.plunder_data;
                    resolve();
                };
            };

            const bridge = new Bridge('get-plunder-data');
            window.addEventListener('message', request);
            window.postMessage(bridge);
        });
    };

    /** Envia um ataque usando os modelos A e B. */
    private static async handleAttack(): Promise<void> {
        try {
            // Retorna caso o Plunder esteja inativo.
            if (Plunder.status.active === false) return;

            // Se a opção de exibir aldeias sob ataque estiver ativa, exibe um aviso.
            // O usuário poderá ou desativá-la ou encerrar o Plunder.
            const areThereVillagesUnderAttack = await this.areThereVillagesUnderAttack();
            if (areThereVillagesUnderAttack) return TWFarm.togglePlunder();
            
            /** Array com todas as linhas da tabela. */
            const villageRows = Array.from(document.querySelectorAll('tr[insidious-village]'));
            for (const village of villageRows) {
                // ID da aldeia.
                const villageID = village.getAttribute('insidious-village');
                if (!villageID) throw new InsidiousError('Não foi possível obter o id da aldeia.');

                // Ignora a linha caso ela esteja oculta, removendo-a da tabela.
                // Elas automaticamente ficam ocultas assim que são atacadas.
                if (village.getAttribute('style')?.includes('display: none')) {
                    Manatsu.remove(village);
                    TWFarm.village_info.delete(villageID);
                    continue;
                };

                // Informações sobre a aldeia.
                const info = TWFarm.village_info.get(villageID);
                if (!info) throw new InsidiousError(`Não foi encontrada informação sobre a aldeia ${villageID}.`);
                
                // Caso não hajam informações obtidas por exploradores, a linha é ignorada.
                if (info.spy_status === false) continue;

                // Ignora a aldeia caso o último ataque tenha sido há mais horas do que o indicado.
                // Zero indica que nenhuma aldeia deve ser ignorada por causa disso.
                if (this.options.ignore_older_than > 0) {
                    if (info.last_attack === 0) throw new InsidiousError(`Não foi possível determinar a data do último ataque (${villageID}).`);
                    const hoursSinceLast = (Date.now() - info.last_attack) / 3600000;
                    if (hoursSinceLast > this.options.ignore_older_than) continue;
                };

                // Envia aríetes caso a aldeia possua muralha e "demolir muralha" esteja ativo.
                // Se o ataque for enviado com sucesso, pula para a próxima aldeia.
                // Em hipótese alguma "destroy_wall" pode estar após "ignore_wall".
                if (this.options.destroy_wall === true && info.wall > 0) {
                    const skipToNextVillage = await this.destroyWall(villageID, info.wall);
                    if (skipToNextVillage === true) continue;
                };

                // A aldeia é ignorada caso possua muralha e "ignorar muralha" esteja ativo.
                if (this.options.ignore_wall === true && info.wall > 0) continue;

                // Verifica se o Plunder deve ou não usar o modelo C.
                // Em caso positivo, também verifica se o botão está ativado.
                if (info.c_button && this.options.use_c === true) {
                    if (info.c_status === false) continue;
                    // ExpectedResources chama getCModelCarryCapacity() para descobrir quanto o modelo C pode carregar.
                    // É durante a execução dessa função que o modelo C é salvo no mapa cmodel.
                    // Sendo assim, ExpectedResources obrigatoriamente precisa estar no início do IF.
                    const expectedResourcesC = new ExpectedResources(villageID, 'c');

                    const cmodel = this.cmodel.get(villageID);
                    if (!cmodel) throw new InsidiousError('Não foi possível obter o modelo C armazenado no mapa.');

                    const checkAvailability = await this.getAvailableFarmUnits();
                    if (!checkAvailability(cmodel)) continue;

                    // Adiciona o ID da aldeia atual ao Set que controla os ataques usando o modelo C.
                    this.waitingC.add(villageID);

                    return this.prepareAttack(villageID, expectedResourcesC)
                        .then(() => Manatsu.remove(village))
                        .then(() => this.handleAttack())
                        .catch((err: unknown) => InsidiousError.handle(err));
                };

                let { ratioIsOk, bestRatio, otherRatio } = new ModelRatio(info.total);
                // Verifica o modelo mais adequado e em seguida se há tropas disponíveis.
                if (ratioIsOk) {
                    if (!bestRatio) throw new InsidiousError('Não foi possível determinar qual modelo utilizar.');
 
                    // Modelo escolhido pela função verifyRatio.
                    const bestModel = this[`${bestRatio}model`] as AvailableFarmUnits;

                    // Retorna uma função, que então é guardada em checkAvailability.
                    // Essa nova função guarda o escopo de this.getAvailableTroops.
                    const checkAvailability = await this.getAvailableFarmUnits();
                    // Esse boolean determina se o ataque pode ser enviado ou não.
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
                        const expectedResources = new ExpectedResources(villageID, bestRatio);
                        // Esse return não pode ser removido, caso contrário o código após o FOR será executado indevidamente.
                        return this.prepareAttack(villageID, expectedResources)
                            .then(() => Manatsu.remove(village))
                            .then(() => this.handleAttack())
                            .catch((err: unknown) => InsidiousError.handle(err));
                    };
                };
            };
            
            // Caso, em toda tabela, não haja aldeia adequada para envio do ataque, verifica se há mais páginas.
            // Em caso positivo, navega para a próxima após um breve delay.
            // Se não houverem outras páginas ou tropas disponíveis, navega para a próxima aldeia caso options.group_attack === true.
            setTimeout(() => this.navigateToNextPlunderPage(), Utils.generateIntegerBetween(1000, 2000));

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static async prepareAttack(villageID: string, resources: ExpectedResources) {
        // Atrasa o envio do ataque caso seja o primeiro após o carregamento da página.
        if (Plunder.status.firstAttack === true) await Plunder.status.waitAsFirstAttack();

        return new Promise<void>((resolve, reject) => {
            if (Utils.isThereCaptcha()) {
                TWFarm.togglePlunder();
                reject(new InsidiousError('Não é possível saquear enquanto há um captcha ativo.'));
                return;
            };

            const attackCtrl = new AbortController();
            const delay = Plunder.options.no_delay === true ? 0 : Utils.generateIntegerBetween(200, 300);
            const attackTimeout = setTimeout(() => {
                this.sendAttack(villageID, resources.model)
                    .then(() => this.updatePlunderedAmount(resources))
                    .then(() => resolve())
                    .catch((err: unknown) => reject(err))
                    .finally(() => attackCtrl.abort());
            // O jogo possui um limite de cinco ações por segundo.
            }, delay);

            Plunder.eventTarget.addEventListener('stopplundering', () => {
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
        // Se for o modelo C, o MutationObserver precisa ser bastante diferente.
        // Além disso, a natureza recursiva de sendAttackUsingC() torna necessário
        // impedir que a função seja executada mais de uma vez.
        if (model === 'c' && this.waitingC.has(villageID)) return this.sendAttackUsingC(villageID);

        return new Promise<void>((resolve, reject) => {
            const observeTroops = new MutationObserver(() => {
                observeTroops.disconnect();
                resolve();
            });

            const selector = 'form#farm_units table#units_home';
            const unitTable = document.querySelector(selector);
            if (!unitTable) throw new InsidiousError(`DOM: ${selector}`);
            observeTroops.observe(unitTable, { subtree: true, childList: true });

            const attackButton = TWFarm.village_info.get(villageID)?.[`${model}_button`];
            if (!attackButton) throw new InsidiousError(`O botão ${model.toUpperCase()} não foi encontrado.`);
            attackButton.click();

            // Caso o observer não perceber mudanças mesmo após três segundos, emite um erro.
            Utils.wait(3000)
                .then(() => observeTroops.disconnect())
                .then(() => reject(new InsidiousError('TIMEOUT: O servidor demorou demais para responder.')));
        });
    };

    private static sendAttackUsingC(villageID: string): Promise<void> {
        // Remove a aldeia da lista de espera.
        this.waitingC.delete(villageID);

        // Resolverá onde primeiro houver a mutação correta.
        return Promise.any([
            this.attackObservingAutoHideBox(),
            this.sendAttack(villageID, 'c')
        ]);
    };

    private static attackObservingAutoHideBox() {
        return new Promise<void>((resolve, reject) => {
            const observeTroops = new MutationObserver((mutationList) => {
                for (const mutation of mutationList) {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const nodeClass = (node as Element).getAttribute('class')?.toLowerCase();
                            if (!nodeClass || !(nodeClass.includes('autohidebox'))) continue;

                            observeTroops.disconnect();
                            return resolve();
                        };
                    };
                };
            });

            observeTroops.observe(document.body, { subtree: true, childList: true });

            Utils.wait(3000)
                .then(() => observeTroops.disconnect())
                .then(() => reject(new InsidiousError('TIMEOUT: O servidor demorou demais para responder.')));
        });
    };

    /** Retorna uma função que permite verificar a quantidade de tropas disponíveis. */
    private static async getAvailableFarmUnits() {
        await this.updatePlunderData();
        Plunder.data = new PlunderData();

        /** Lista com as tropas disponíveis para saque. */
        const available = new AvailableFarmUnits();

        return function(model: AvailableFarmUnits): boolean {
            // Se houver menos tropas do que consta no modelo, a função deve ser interrompida.
            for (const [key, value] of Object.entries(available)) {
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
            const checkAvailability = await this.getAvailableFarmUnits();
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
                // Analisa os links disponíveis para determinar quantos existem.
                const getPageNumber = (element: Element) => Number.parseInt(element.textContent?.replace(/\D/g, '') as string, 10);
                // A função getPageNumber é invocada em todos os elementos durante a formação da array.
                let plunderPages: number[] = Array.from(plunderListNav.querySelectorAll('a.paged-nav-item'), getPageNumber);
                plunderPages = plunderPages.filter((item) => !Number.isNaN(item));

                if (plunderPages.length === 0) {
                    if (this.options.group_attack === true) this.navigateToNextVillage();
                    return;
                };

                // Anexa a página atual na array e em seguida a ordena.
                plunderPages.push(Plunder.data.page);
                plunderPages.sort((a, b) => a - b);

                // Registra os detalhes sobre a troca de página.
                const plunderPageNavigation = new PlunderPageNavigation();
                await Store.set({ [Keys.plunderPage]: plunderPageNavigation });

                /** URL para navegação entre as páginas. */
                const pageURL = new PlunderPageURL();

                // Caso a página atual seja a última página, volta para a primeira.
                if (Plunder.data.page === plunderPages.at(-1)) {
                    return location.assign(pageURL.first);
                } else {
                    if (!pageURL.next) throw new InsidiousError('Não foi possível determinar a URL da próxima página.');
                    return location.assign(pageURL.next);
                };
            };

        } catch (err) {
            InsidiousError.handle(err);
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
            // Caso não seja a primeira página, a função verifica de onde partiu a última navegação.
            // Ela é ignorada caso tenha sido entre páginas da aldeia atual.
            if (Plunder.data.page !== 0) {
                const lastPageNavigation = await Store.get(Keys.plunderPage) as PlunderPageNavigation | undefined;
                if (lastPageNavigation) {  
                    if (lastPageNavigation.village === Game.village) return true;
                    return false;
                };
            };
        };

        return true;
    };

    // Navega para a próxima aldeia caso this.options.group_attack === true.
    private static async navigateToNextVillage() {
        try {
            const groupID = await Store.get(Keys.farmGroup) as string | undefined;
            if (Game.group !== groupID) return;

            const rightArrow = document.querySelector('a#village_switch_right span.groupRight');
            if (rightArrow) {
                // Antes de mudar de aldeia, salva a atual como última aldeia atacante.
                this.navigation = new PlunderGroupNavigation('attack');
                await Store.set({ [Keys.plunderNavigation]: this.navigation });
                
                (rightArrow as HTMLSpanElement).click();
            };

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static async showPlunderedAmount() {
        try {
            Manatsu.removeChildren(TWFarm.menu.section.action);

            this.plundered = await Store.get(Keys.totalPlundered) as TotalPlundered | undefined;
            if (!this.plundered) this.plundered = new NothingPlundered();

            const container = new Manatsu('span', TWFarm.menu.section.action, { class: 'nowrap' }).create();
            Utils.showResourceIcons(this.plundered, container, true);

        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static async updatePlunderedAmount(resources: ExpectedResources) {
        try {
            // Caso ainda não exista, entende que o ataque atual é o primeiro.
            if (!this.plundered) {
                this.plundered = new PlunderedAmount(resources, true);
            } else {
                this.plundered = new PlunderedAmount(resources, false);           
            };

            [...Assets.list.resources, 'total'].forEach((item: keyof TotalPlundered) => {
                const label = document.querySelector(`#ins_plundered_${item}`);
                if (label) label.textContent = this.plundered![item].toLocaleString('pt-br');
            });

            // Salva os valores no banco de dados.
            await Store.set({ [Keys.totalPlundered]: this.plundered });
    
        } catch (err) {
            InsidiousError.handle(err);
        };
    };

    private static setPlunderTimeout() {
        return new Promise<void>((resolve) => {
            const plunderListTitle = document.querySelector('div#am_widget_Farm h4');
            if (!plunderListTitle) throw new InsidiousError('DOM: div#am_widget_Farm h4');

            /** Horário do próximo recarregamento automático da página. */
            const timeout = Plunder.options.minutes_until_reload * 60000;
            const nextAutoReloadDate = new Date(Date.now() + timeout);

            const dateString = nextAutoReloadDate.toLocaleDateString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const hourString = nextAutoReloadDate.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' });
            const spanMessage = `A página será recarregada automaticamente em ${dateString} às ${hourString}`;

            // Apenas substitui o texto caso o elemento já exista.
            const spanElement = document.querySelector('#ins_next_auto_reload');
            if (spanElement) {
                spanElement.textContent = spanMessage;
            } else {
                new Manatsu('span', plunderListTitle, { text: spanMessage, id: 'ins_next_auto_reload' }).create();
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
     * @param wall Nível da muralha.
     */
    private static destroyWall(villageID: string, wall: WallLevel) {
        return new Promise<boolean>(async (resolve, reject) => {
            await this.updatePlunderData();
            Plunder.data = new PlunderData();

            const axe = Plunder.data.current_units.axe;
            const spy = Plunder.data.current_units.spy;
            const ram = Plunder.data.current_units.ram;

            /** Verifica se há tropas disponíveis para destruir a muralha. */
            const canDestroy = (neededRams: number, neededAxes: number): boolean => {
                if (neededRams > ram || neededAxes > axe || spy < 1) return false;
                return true;
            };

            /** Tropas necessárias para cada nível possível da muralha. */
            const neededUnits = Assets.unitsToDestroyWall[wall] as [number, number];

            // Se não houverem unidades o suficiente, resolve a promise.
            if (!canDestroy(...neededUnits)) return resolve(false);

            try {
                // Abre a janela de comando e obtém a quantidade de aríetes.
                await this.openPlace(villageID);

                const closeButton = document.querySelector('#popup_box_popup_command a.popup_box_close') as HTMLElement | null;
                if (!closeButton) throw new InsidiousError('Não foi possível encontrar o botão para fechar a janela de comando.');

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
                const observeCommandForm = new MutationObserver(async (mutationList) => {
                    for (const mutation of mutationList) {
                        for (const node of Array.from(mutation.addedNodes)) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                const form = node as Element;
                                if (form.getAttribute('id') !== 'command-data-form') continue;

                                observeCommandForm.disconnect();
                                await this.sendRamAttack(neededRams, neededAxes, wall);
                                return resolve(true);
                            };
                        };
                    };
                });

                observeCommandForm.observe(document.body, { subtree: true, childList: true });
                
                const formAttackButton = commandForm.querySelector('#target_attack') as HTMLInputElement | null;
                if (!formAttackButton) throw new InsidiousError('DOM: #target_attack');

                // É preciso esperar um breve intervalo antes de emitir o clique.
                // Do contrário, o servidor não tem tempo suficiente para processar o comando.
                await Utils.wait();
                formAttackButton.click();

                /** Caso o observer não perceber mudanças mesmo após três segundos, emite um erro. */
                Utils.wait(3000)
                    .then(() => observeCommandForm.disconnect())
                    .then(() => reject(new InsidiousError('TIMEOUT: O servidor demorou demais para responder.')));

            } catch (err) {
                const closeButton = document.querySelector('#popup_box_popup_command a.popup_box_close');
                if (closeButton) (closeButton as HTMLElement).click();
                reject(err);
            };
        });
    };

    /**
     * Abre a janela para envio de comandos.
     * @param villageID ID da aldeia.
     */
    private static openPlace(villageID: string) {
        return new Promise<void>((resolve, reject) => {
            const placeButton = TWFarm.village_info.get(villageID)?.place;
            if (!placeButton) throw new InsidiousError(`Não foi possível encontrar o botão da praça de reunião (${villageID}).`);

            // Observa até detectar a abertura da janela de comando.
            const observeRams = new MutationObserver((mutationList) => {
                for (const mutation of mutationList) {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if ((node as Element).getAttribute('id') !== 'command-data-form') continue;
                            observeRams.disconnect();
                            return resolve();
                        };
                    };
                };
            });

            observeRams.observe(document.body, { subtree: true, childList: true });
            placeButton.click();

            Utils.wait(3000)
                .then(() => observeRams.disconnect())
                .then(() => reject(new InsidiousError('TIMEOUT: O servidor demorou demais para responder.')))
        });
    };

    private static async sendRamAttack(rams: string, axes: string, wall: number) {
        const submitAttack = document.querySelector('#troop_confirm_submit[class*="troop_confirm_go" i]');
        if (!submitAttack) throw new InsidiousError('DOM: #troop_confirm_submit[class*="troop_confirm_go" i]');

        // Obtém informações a respeito das tropas que estão sendo enviadas.
        const confirmRamField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-ram');
        if (!confirmRamField) throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-ram');
        
        const confirmAxeField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-axe');
        if (!confirmAxeField) throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-axe');
        
        const confirmSpyField = document.querySelector('#place_confirm_units tbody tr.units-row td.unit-item-spy');
        if (!confirmSpyField) throw new InsidiousError('DOM: #place_confirm_units tbody tr.units-row td.unit-item-spy');

        const ramAmount = confirmRamField.textContent?.replace(/\D/g, '');
        const axeAmount = confirmAxeField.textContent?.replace(/\D/g, '');
        const spyAmount = confirmSpyField.textContent?.replace(/\D/g, '');

        // E então verifica se a quantidade de tropas está correta.
        if (ramAmount !== rams) {
            throw new InsidiousError(`A quantidade de aríetes (${ramAmount}) não condiz com o necessário(${rams}).`);
        } else if (axeAmount !== axes) {
            throw new InsidiousError(`A quantidade de bárbaros (${axeAmount}) não condiz com o necessário(${axes}).`);
        } else if (spyAmount !== '1') {
            throw new InsidiousError(`A quantidade de exploradores (${spyAmount}) é diferente de 1.`);
        };

        // Se estiver tudo certo, envia o ataque.
        (submitAttack as HTMLInputElement).click();
        const destroyedWalls = await Store.get(Keys.plunderWalls);
        if (!Number.isInteger(destroyedWalls)) {
            await Store.set({ [Keys.plunderWalls]: wall });
        } else {
            await Store.set({ [Keys.plunderWalls]: (destroyedWalls as number) + wall});
        };

        await Utils.wait();
    };

    /**
     * Verifica se a opção que exibe aldeias sob ataque está ativada.
     * Se estiver, solicita que o jogador desative-a.
     * @returns Boolean indicando se a opção está ativada ou não.
     */
    private static areThereVillagesUnderAttack() {
        const showAttacked = document.querySelector('input#attacked_checkbox') as HTMLInputElement | null;
        if (!showAttacked) throw new InsidiousError('DOM: input#attacked_checkbox');

        return new Promise<boolean>((resolve) => {
            if (Plunder.data.hide_attacked === false) {
                Utils.createModal('Insidious', false);
                const modalWindow = document.querySelector('#ins_modal') as HTMLDivElement | null;
                if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');

                const warningMessages = [
                    'Não é possível atacar enquanto a opção \"incluir relatórios de aldeias ' +
                    'que você está atacando\" estiver ativa.',
                    'Deseja desativá-la?',
                    'Em caso negativo, o Insidious será encerrado.'
                ];

                const warningMessageElements = Manatsu.repeat(3, modalWindow, { class: 'ins_modal_msg' }, true);
                Manatsu.addTextContent(warningMessageElements, warningMessages);

                const messageModalCtrl = new AbortController();
                const modalButtonArea = new Manatsu(modalWindow, { class: 'ins_modalButtonArea' }).create();

                new Manatsu('button', { class: 'ins_modal_btn', text: 'Sim' }, modalButtonArea).create()
                    .addEventListener('click', async () => {
                        messageModalCtrl.abort();
                        Manatsu.removeChildren(modalWindow, ['.ins_modal_msg', '.ins_modalButtonArea']);
                        new Manatsu({ text: 'A página será recarregada em alguns instantes. Por favor, aguarde.'}, modalWindow).create();
                        showAttacked.click();

                        await Utils.wait();
                        window.location.reload();
                    }, { signal: messageModalCtrl.signal });

                new Manatsu('button', { class: 'ins_modal_btn', text: 'Não' }, modalButtonArea).create()
                    .addEventListener('click', () => {
                        messageModalCtrl.abort();
                        Utils.closeModal();
                        resolve(true);
                    }, { signal: messageModalCtrl.signal });

            } else {
                resolve(false);
            };
        });
    };

    static getCModelCarryCapacity(villageID: string): number {
        const cFarmBtn = TWFarm.village_info.get(villageID)?.c_button;
        if (!cFarmBtn) throw new InsidiousError(`Não foi possível encontrar o botão C (${villageID}).`);

        const modelJSON = cFarmBtn.getAttribute('data-units-forecast');
        if (!modelJSON) throw new InsidiousError('Não foi possível determinar a capacidade de carga do modelo C.');

        const cmodel = JSON.parse(modelJSON) as AvailableFarmUnits;
        this.cmodel.set(villageID, cmodel);

        return new CarryCapacity(cmodel).c;
    };

    static get amount() { return this.plundered };

    static #raw_plunder_data: TribalWarsPlunderData;
    static get raw_plunder_data() { return this.#raw_plunder_data };
};