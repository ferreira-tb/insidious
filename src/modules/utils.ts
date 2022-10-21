class Utils {
    /** Tempo de resposta do servidor. */
    static readonly responseTime: number = this.getResponseTime();
    
    /** Retorna o tempo de resposta do servidor */
    private static getResponseTime(): number {
        const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const responseTime = navigationTiming.responseEnd - navigationTiming.fetchStart;

        if (!Number.isInteger(responseTime) || responseTime <= 0) return 500;
        return responseTime;
    };

    /** Obtém o valor de algum campo da URL. */
    private static currentField(fieldName: string) {
        return function(url: string) {
            if (typeof url !== 'string') throw new InsidiousError('A URL fornecida é inválida.');

            const urlFields = (url.replace('\?', '')).split('\&');
            for (const field of urlFields) {
                if (field.includes(`${fieldName}=`)) return field.replace(`${fieldName}=`, '');
            };
            return null;
        };
    };

    static readonly currentScreen = this.currentField('screen');
    static readonly currentMode = this.currentField('mode');
    static readonly currentSubType = this.currentField('subtype');
    
    /** Calcula distância em campos entre duas coordenadas. */
    static calcDistance(originX: number, originY: number, destinationX: number, destinationY: number) {
        return Math.sqrt(((destinationX - originX) ** 2) + ((destinationY - originY) ** 2));
    };

    /** Gera um número inteiro entre dois outros inteiros. */
    static generateIntegerBetween(min: number, max: number) {
        return Math.floor(Math.random() * (max - min) + min);
    };

    /** Verifica se há algum captcha ativo. */
    static isThereCaptcha() {
        const botCheck = document.querySelector('#bot_check');
        const hcaptcha = document.querySelector('.captcha');
        const hcaptchaFrame = document.querySelector('iframe[data-title*="hCaptcha" i]');

        if (botCheck || hcaptcha || hcaptchaFrame) {
            Store.set({ lastCaptcha: Date.now() })
                .catch((err: unknown) => InsidiousError.handle(err));

            return true;
        };

        return false;
    };

    /** Cria um breve atraso tendo como base o tempo de resposta do servidor. */
    static wait(extra?: number) {
        if (extra && Number.isInteger(extra)) {
            return new Promise((stopWaiting) => setTimeout(stopWaiting, this.responseTime + extra));
        } else {
            return new Promise((stopWaiting) => setTimeout(stopWaiting, this.responseTime));
        };
    };

    /**
     * Cria uma janela modal.
     * @param modalTitle - Título do modal.
     * @param clickOutside - Se `true`, um clique fora do modal o fechará.
     * @param options - Atributos para se adicionar à janela modal.
     */
    static createModal(modalTitle: string, clickOutside: boolean = true, options?: SSObject) {
        const blurBG = new Manatsu({ id: 'insidious_blurBG' }, document.body).create();
        let modalWindow: HTMLElement;

        if (options) {
            const beforeCreating = new Manatsu(options, document.body);
            modalWindow = beforeCreating.addOptions({ id: 'insidious_modal' }, true).create();
        } else {
            modalWindow = new Manatsu({ id: 'insidious_modal' }, document.body).create();
        };

        const modalCtrl = new AbortController();
        const closeIt = () => {
            modalCtrl.abort();
            Manatsu.remove([blurBG, modalWindow]);
        };

        blurBG.addEventListener('closemodal', closeIt, {signal: modalCtrl.signal});
        if (clickOutside === true) blurBG.addEventListener('click', closeIt, {signal: modalCtrl.signal});

        const titleContainer = new Manatsu(modalWindow).create();
        new Manatsu('h1', { text: modalTitle }, titleContainer).create();
    };
    
    /**
     * Fecha qualquer modal que tenha sido aberto pela Manatsu.
     * @returns Retorna `true` caso o modal tenha sido fechado, do contrário, retorna `false`.
     */
    static closeModal(): boolean {
        const blurBG = document.querySelector('#insidious_blurBG');
        if (!blurBG) return false;

        blurBG.dispatchEvent(new Event('closemodal'));

        // Verifica se o elemento ainda existe.
        if (document.querySelector('#insidious_blurBG')) return false;
        return true;
    };

    static queryXMLTags(configXML: XMLDocument) {
        return function(tag: XMLTags): number {
            const valueField = configXML.querySelector(tag);
            if (!valueField) {
                // Caso não exista campo para arqueiros, assume que o mundo não possui arqueiros.
                if (tag.includes('archer')) return 0;
                throw new InsidiousError(`O campo \"${tag}\" não foi encontrado no documento XML.`);
            };

            if (valueField.textContent === null) {
                throw new InsidiousError(`O campo \"${tag}\" foi encontrado no documento XML, mas está vazio.`);
            };

            const result = Number.parseFloat(valueField.textContent);
            if (Number.isNaN(result)) throw new InsidiousError(`O valor de \"${tag}\" obtido no documento XML é inválido.`);
            return result;
        };
    };

    /**
     * @param resources Objeto contendo a quantidade de recursos.
     * @param parent Local onde os elementos serão criados.
     * @param total Determina se a quantia total deve ser incluída.
     */
    static showResourceIcons(resources: TotalPlundered, parent: HTMLElement, total: boolean = false) {
        for (const [key, value] of Object.entries(resources)) {
            if (Assets.list.resources.includes(key as ResourceList)) {
                const amount = value.toLocaleString('pt-br')
                new Manatsu('span', parent, { class: `ins_icon ins_${key}` }).create();
                new Manatsu('span', parent, { class: 'res', id: `insidious_plundered_${key}`, text: amount }).create();
            };
        };

        if (total === true) {
            const totalAmount = resources.total.toLocaleString('pt-br');
            new Manatsu('span', parent, { class: 'ins_icon ins_storage' }).create();
            new Manatsu('span', parent, { class: 'res', id: 'insidious_plundered_total', text: totalAmount }).create();
        };
    };

    /**
     * Obtém a data atual no formato ISO.
     * @param extra Tempo extra a ser adicionado à data.
     * @returns A data atual no formato YYYY-MM-DDTHH:mm:ss.sssZ.
     */
    static getDateString(extra: number) {
        const timezoneOffset = new Date().getTimezoneOffset() * 60000;
        const ISODate = Date.now() - timezoneOffset + extra;
        return new Date(ISODate).toISOString().split('Z')[0];
    };
};