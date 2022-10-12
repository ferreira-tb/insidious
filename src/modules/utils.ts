class Utils {
    /** Retorna o mundo atual. */
    static currentWorld(): string | null {
        if (!location.hostname.includes('.tribalwars')) return null;

        const index = location.hostname.indexOf('.tribalwars');
        const thisWorld = location.hostname.substring(0, index);

        if (thisWorld.length === 0) return null;
        return thisWorld;
    };

    private static currentField(fieldName: string) {
        return function(url?: string) {
            if (url !== undefined && typeof url !== 'string') throw new InsidiousError('A URL fornecida é inválida.');

            const urlToGetFieldsFrom = url ?? location.search;
            const urlFields: string[] = (urlToGetFieldsFrom.replace('\?', '')).split('\&');
            for (const field of urlFields) {
                if (field.includes(`${fieldName}=`)) return field.replace(`${fieldName}=`, '');
            };
            return null;
        };
    };

    static readonly currentGroup = this.currentField('group');
    static readonly currentScreen = this.currentField('screen');
    static readonly currentMode = this.currentField('mode');
    static readonly currentSubType = this.currentField('subtype');

    /** Retorna o ID da aldeia atual. */
    static currentVillage(): string | null {
        // Não é seguro obter o id da aldeia diretamente da barra de endereços.
        const villageLinkElement = document.querySelector('tr#menu_row2 td#menu_row2_village a[href*="village" i]');
        if (!villageLinkElement) throw new InsidiousError('DOM: tr#menu_row2 td#menu_row2_village a[href*="village" i]');

        const villageLink = villageLinkElement.getAttribute('href');
        if (!villageLink) throw new InsidiousError('Não foi possível obter o link para a aldeia atual.');

        const linkFields: string[] = (villageLink.replaceAll('\?', '\&')).split('\&');
        for (const field of linkFields) {
            if (field.includes('village=')) return field.replace(/\D/g, '');
        };
        return null;
    };

    /** Retorna o ID do jogador. */
    static currentPlayer() {
        return new Promise((resolve, reject) => {
            const village =  `v${this.currentVillage()}_${Insidious.world}`;
            Store.get(village)
                .then((result: VillageInfo) => resolve(result.player))
                .catch((err: unknown) => reject(err));
        });
    };

    /** 
     * Corrige os nomes codificados.
     * 
     * "Aldeia+de+b%C3%A1rbaros" se torna "Aldeia de bárbaros").
     */
    static urlDecode(url: string): string {
        return decodeURIComponent(url.replace(/\+/g, ' '));
    };

    /** Calcula distância em campos entre duas coordenadas. */
    static calcDistance(...args: number[]) {
        const [originX, originY, destinationX, destinationY] = args;
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
            Store.set({ lastCaptcha: new Date().getTime() });
            return true;
        };

        return false;
    };

    /** Retorna o tempo de resposta do servidor */
    static getResponseTime(): number {
        const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const responseTime = navigationTiming.responseEnd - navigationTiming.fetchStart;

        if (!Number.isInteger(responseTime) || responseTime <= 0) return 500;
        return responseTime;
    };

    /** Cria um breve atraso tendo como base o tempo de resposta do servidor. */
    static wait(extra?: number) {
        if (extra && Number.isInteger(extra)) {
            return new Promise((stopWaiting) => setTimeout(stopWaiting, this.getResponseTime() + extra));
        } else {
            return new Promise((stopWaiting) => setTimeout(stopWaiting, this.getResponseTime()));
        };
    };

    /**
     * Cria uma janela modal.
     * @param modalTitle - Título do modal.
     * @param caller - Referência à classe que invocou o modal.
     */
    static modal(modalTitle: string, caller?: string) {
        const blurBG = new Manatsu({ id: 'insidious_blurBG' }, document.body).create();
        const modalWindow = new Manatsu({ id: 'insidious_modal' }, document.body).create();
        if (caller && typeof caller === 'string') modalWindow.setAttribute('insidious-modal-caller', caller);

        const modalCtrl = new AbortController();
        blurBG.addEventListener('closemodal', () => {
            modalCtrl.abort();
            document.body.removeChild(modalWindow);
            document.body.removeChild(blurBG);
        }, {signal: modalCtrl.signal});

        const titleContainer = new Manatsu(modalWindow).create();
        new Manatsu('h1', { id: 'insidious_modal_h1', text: modalTitle }, titleContainer).create();
    };
};