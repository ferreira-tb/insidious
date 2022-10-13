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