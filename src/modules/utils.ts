class Utils {
    static #currentWorld(): string | null {
        if (!location.origin.includes('tribalwars')) return null;

        const thisWorld = location.origin.replace(/\D/g, '');
        if (thisWorld.length === 0) throw new InsidiousError('Não foi possível determinar o mundo atual.');
        return thisWorld;
    };

    static readonly currentScreen = this.#currentField('screen');
    static readonly currentGroup = this.#currentField('group');

    static #currentField(fieldName: string) {
        return function() {
            const urlFields: string[] = (location.search.replace('\?', '')).split('\&');
            for (const field of urlFields) {
                if (field.includes(`${fieldName}=`)) return field.replace(`${fieldName}=`, '');
            };
            return null;
        };
    };

    static #currentVillage(): string | null {
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

    static #currentPlayer() {
        return new Promise((resolve, reject) => {
            const village =  `v${this.#currentVillage()}_${Insidious.world}`;
            browser.storage.local.get(village)
                .then((result: any) => resolve(result[village]?.player))
                .catch((err: unknown) => reject(err));
        });
    };

    // Corrige os nomes codificados ("Aldeia+de+b%C3%A1rbaros" se torna "Aldeia de bárbaros").
    static #urlDecode(url: string): string {
        return decodeURIComponent(url.replace(/\+/g, ' '));
    };

    // Calcula distância em campos entre duas coordenadas.
    static #calcDistance(...args: number[]) {
        const [originX, originY, destinationX, destinationY] = args;
        return Math.sqrt(((destinationX - originX) ** 2) + ((destinationY - originY) ** 2));
    };

    // Gera um número inteiro entre dois outros inteiros.
    static #generateIntegerBetween(min: number, max: number) {
        return Math.floor(Math.random() * (max - min) + min);
    };

    static #isThereCaptcha() {
        const botCheck = document.querySelector('#bot_check');
        const hcaptcha = document.querySelector('.captcha');
        const hcaptchaFrame = document.querySelector('iframe[data-title*="hCaptcha" i]');

        if (botCheck || hcaptcha || hcaptchaFrame) {
            browser.storage.local.set({ lastCaptcha: new Date().getTime() });
            return true;
        };

        return false;
    };

    static #getResponseTime(): number {
        const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const responseTime = navigationTiming.responseEnd - navigationTiming.fetchStart;

        if (!Number.isInteger(responseTime)) return 500;
        return responseTime;
    };

    static #modal(modalTitle: string) {
        const blurBG = new Manatsu({ id: 'insidious_blurBG' }, document.body).create();
        const modalWindow = new Manatsu({ id: 'insidious_modal' }, document.body).create();

        const modalCtrl = new AbortController();
        blurBG.addEventListener('closemodal', () => {
            modalCtrl.abort();
            document.body.removeChild(modalWindow);
            document.body.removeChild(blurBG);
        }, {signal: modalCtrl.signal});

        const titleContainer = new Manatsu(modalWindow).create();
        new Manatsu('h1', { id: 'insidious_modal_h1', text: modalTitle }, titleContainer).create();
    };

    // DADOS
    static get currentWorld() {return this.#currentWorld};
    static get currentVillage() {return this.#currentVillage};
    static get currentPlayer() {return this.#currentPlayer};

    // MODAL
    static get modal() {return this.#modal};

    // OUTROS
    static get urlDecode() {return this.#urlDecode};
    static get calcDistance() {return this.#calcDistance};
    static get generateIntegerBetween() {return this.#generateIntegerBetween};
    static get isThereCaptcha() {return this.#isThereCaptcha};
    static get getResponseTime() {return this.#getResponseTime};
};